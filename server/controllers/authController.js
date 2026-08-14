// server/controllers/authController.js
// Supabase-based authentication controller
const supabase = require('../config/supabaseClient');
const User = require('../models/User');
const Otp = require('../models/Otp');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const { validatePasswordStrength } = require('../utils/passwordValidator');
const { sendPasswordResetEmail } = require('../services/notificationService');

// Allowed registration domains (gmail is blocked for public registration)
const ALLOWED_DOMAINS = ['@cse.suh.edu.in', '@aiml.suh.edu.in', '@suh.edu.in'];

// Determine role from email domain
const getRoleFromEmail = (email) => {
  const e = email.toLowerCase();
  if (e.endsWith('@cse.suh.edu.in') || e.endsWith('@aiml.suh.edu.in')) return 'student';
  if (e.endsWith('@suh.edu.in')) return 'faculty';
  return null; // blocked
};

// Helper: create/update profile row in public.profiles
const upsertProfile = async (userId, email, name, role, employeeId = null, rollNumber = null) => {
  const profile = {
    id: userId,
    email,
    name,
    role,
    created_at: new Date().toISOString(),
  };
  if (role === 'faculty' && employeeId) profile.employee_id = employeeId;
  if (role === 'student' && rollNumber) profile.roll_number = rollNumber;

  const { error } = await supabase
    .from('profiles')
    .upsert(profile, { onConflict: 'id' });
  if (error) throw error;
  return profile;
};

// ─── REGISTER ───────────────────────────────────────
// Expects: fullName, email, password, otp
exports.register = async (req, res) => {
  try {
    const { fullName, email, password, otp } = req.body;
    if (!fullName || !email || !password || !otp) {
      return res.status(400).json({ message: 'Please provide fullName, email, password, and OTP.' });
    }

    const emailLower = email.toLowerCase().trim();

    const isAllowed = ALLOWED_DOMAINS.some((d) => emailLower.endsWith(d));
    if (!isAllowed) {
      return res.status(400).json({
        message: 'Registration allowed only for institutional email addresses (@cse.suh.edu.in, @aiml.suh.edu.in, @suh.edu.in).'
      });
    }

    if (!validatePasswordStrength(password)) {
      return res.status(400).json({ message: 'Password does not meet strength requirements.' });
    }

    const role = getRoleFromEmail(emailLower);
    if (!role) {
      return res.status(403).json({ message: 'Registration not allowed for this email domain.' });
    }

    // Verify OTP
    const otpRecord = await Otp.findOne({ email: emailLower });
    if (!otpRecord) {
      return res.status(400).json({ message: 'OTP expired or not requested. Please request a new OTP.' });
    }
    if (otpRecord.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP. Please try again.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user in Supabase Auth
    let userId;
    const { data: usersData, error: listErr } = await supabase.auth.admin.listUsers();
    if (listErr) throw listErr;
    const existingAuth = usersData.users.find((u) => u.email.toLowerCase() === emailLower);

    if (existingAuth) {
      userId = existingAuth.id;
      await supabase.auth.admin.updateUserById(userId, {
        password: password,
        email_confirm: true,
        user_metadata: { full_name: fullName, role: role },
      });
    } else {
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email: emailLower,
        password: password,
        email_confirm: true,
        user_metadata: { full_name: fullName, role: role },
      });
      if (createErr) throw createErr;
      userId = newUser.user.id;
    }

    // Auto-detect employeeId or rollNumber from email domain if possible
    let employeeId = null;
    let rollNumber = null;
    if (role === 'faculty') {
      const matches = emailLower.match(/^faculty(\d+)/i);
      employeeId = matches ? `EMP00${matches[1]}` : `EMP_${Math.floor(100 + Math.random() * 900)}`;
    } else if (role === 'student') {
      const matches = emailLower.match(/^(\d+)/);
      rollNumber = matches ? matches[1] : `2203A${Math.floor(100000 + Math.random() * 900000)}`;
    }

    // Upsert profile in Supabase profiles
    await upsertProfile(userId, emailLower, fullName, role, employeeId, rollNumber);

    // Save user to MongoDB with the generated Supabase UUID
    const user = new User({
      _id: userId,
      name: fullName,
      email: emailLower,
      password: hashedPassword,
      role: role,
      isVerified: true,
    });
    await user.save();

    // Remove OTP after successful registration
    await Otp.deleteOne({ email: emailLower });

    return res.status(201).json({
      message: 'Registration successful. You can now log in.',
      user: {
        id: user._id,
        fullName: user.name,
        email: user.email,
        roles: [user.role],
      }
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'User already exists with this email.' });
    }
    console.error('Register error:', err.message);
    res.status(500).json({ message: 'Server error during registration.', error: err.message });
  }
};

// ─── LOGIN ─────────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password.' });
    }

    const emailLower = email.toLowerCase().trim();
    console.log('[AUTH] Incoming login attempt for email:', emailLower);

    // Find user in MongoDB
    const user = await User.findOne({ email: emailLower });
    
    if (!user) {
      console.log(`[AUTH] Login Failed: User '${emailLower}' was NOT FOUND in the MongoDB database.`);
      console.log(`[AUTH] Debug: This usually means the production database is empty, or the MONGO_URI is pointing to the wrong database (e.g. 'test' instead of 'avento').`);
      return res.status(401).json({ message: 'Invalid credentials' });
    } else {
      console.log(`[AUTH] User '${emailLower}' found in DB. Document ID:`, user._id);
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    console.log(`[AUTH] bcrypt.compare() match result for '${emailLower}':`, isMatch);

    if (!isMatch) {
      console.log(`[AUTH] Login Failed: Password mismatch for user '${emailLower}'.`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Ensure verified
    if (!user.isVerified) {
      return res.status(401).json({ message: 'Please verify OTP before login' });
    }

    // Check status in Supabase profiles
    const { data: profileData, error: profileErr } = await supabase
      .from('profiles')
      .select('status, first_login')
      .eq('email', emailLower)
      .single();

    if (profileData && profileData.status === 'inactive') {
      return res.status(403).json({ message: 'Account is deactivated. Please contact administrator.' });
    }

    // Role override for admin
    let userRole = user.role;
    if (emailLower === 'admin.avento@gmail.com') {
      userRole = 'admin';
      let needsSave = false;
      if (user.role !== 'admin') {
        user.role = 'admin';
        needsSave = true;
      }
      if (!user.name) {
        user.name = 'Administrator';
        needsSave = true;
      }
      if (needsSave) {
        await user.save();
      }
    }

    let roles = [userRole];
    if (userRole === 'organizer') {
      roles.push('student');
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, email: user.email, role: userRole },
      process.env.JWT_SECRET || 'avento_super_secret_key_12345',
      { expiresIn: '1d' }
    );

    return res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.name,
        roles: roles,
        employeeId: null, // Update when employee ID is supported in MongoDB
        rollNumber: null, // Update when roll number is supported in MongoDB
        first_login: profileData ? profileData.first_login : false
      }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Server error during login.', error: err.message });
  }
};

// Generate the recovery token with Supabase, but deliver the email through Brevo.
exports.sendPasswordReset = async (req, res) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    const redirectTo = String(req.body.redirectTo || '').trim();

    if (!email || !redirectTo) {
      return res.status(400).json({ message: 'Email and redirect URL are required.' });
    }

    const role = getRoleFromEmail(email) || (email === 'admin.avento@gmail.com' ? 'admin' : null);
    if (!role) {
      return res.status(400).json({ message: 'Only registered users can reset passwords.' });
    }

    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    });
    if (error || !data?.properties?.action_link) {
      throw error || new Error('Could not generate password reset link.');
    }

    await sendPasswordResetEmail({
      recipientEmail: email,
      resetUrl: data.properties.action_link,
    });

    return res.json({ message: `Password reset link sent to ${email}. Please check your inbox.` });
  } catch (err) {
    console.error('Password reset email error:', err.message);
    return res.status(500).json({ message: 'Failed to send reset link. Please try again.' });
  }
};

// ─── GET PROFILE ────────────────────────────────────────────────────────────
exports.getProfile = async (req, res) => {
  try {
    // req.user is populated by authMiddleware
    return res.json({ user: req.user });
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching profile.', error: err.message });
  }
};

// ─── SEND OTP ───────────────────────────────────────────────────────────────
// Sends a 6-digit OTP to the exact email address provided via Nodemailer.
exports.sendOtp = async (req, res) => {
  let emailLower = '';
  let otp = '';
  
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    emailLower = email.toLowerCase().trim();

    // Check if user already exists in MongoDB
    const existingUser = await User.findOne({ email: emailLower });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email.' });
    }

    // Domain validation
    const isAllowed = ALLOWED_DOMAINS.some((d) => emailLower.endsWith(d));
    if (!isAllowed) {
      return res.status(400).json({
        message: 'Only institutional email addresses are allowed (@cse.suh.edu.in, @aiml.suh.edu.in, @suh.edu.in).'
      });
    }

    console.log(`[OTP] Generating OTP for ${emailLower}...`);
    otp = Math.floor(100000 + Math.random() * 900000).toString();

    console.log(`[OTP] Saving OTP to MongoDB...`);
    await Otp.findOneAndUpdate(
      { email: emailLower },
      { otp },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`[OTP] OTP saved successfully in MongoDB.`);

    console.log(`[OTP] Initializing email transporter...`);
    
    // Add logging to check if environment variables are present (without logging the password itself)
    console.log(`[OTP] EMAIL_USER configured:`, !!process.env.EMAIL_USER);
    console.log(`[OTP] EMAIL_PASS configured:`, !!process.env.EMAIL_PASS);

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error(`[OTP] CRITICAL ERROR: SMTP credentials missing in environment variables.`);
      return res.status(500).json({ message: 'Server configuration error: Email credentials missing.' });
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      requireTLS: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    console.log(`[OTP] Sending OTP via Nodemailer API to ${emailLower}...`);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: emailLower,
      subject: 'Avento Verification Code',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Avento Verification Code</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F8FAFC; padding: 40px 20px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.08);">
          
          <!-- Subtle Gradient Header Bar -->
          <tr>
            <td style="height: 8px; background: linear-gradient(135deg, #7C3AED, #8B5CF6);"></td>
          </tr>
          
          <!-- Header Content -->
          <tr>
            <td style="padding: 40px 20px 10px 20px; text-align: center; background-color: #ffffff;">
              <img src="https://joekmqnkpfjuptcgzpmh.supabase.co/storage/v1/object/public/public-assets/avento-logo-public.png" alt="Avento Logo" width="60" style="display: block; margin: 0 auto 15px auto; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
              <h1 style="margin: 0; font-size: 32px; letter-spacing: 1px;">
                <span style="background-color: #F5D76E; color: #1e293b; padding: 2px 10px; border-radius: 4px; display: inline-block;">AVENTO</span>
              </h1>
              <p style="margin: 12px 0 0 0; color: #7C3AED; font-size: 20px; font-weight: 600; letter-spacing: 1px;">Verification Code</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 30px 40px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #334155; line-height: 1.6;">
                Hello,
              </p>
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #334155; line-height: 1.6;">
                Welcome to <strong>Avento</strong> — your university's smart campus events platform.
              </p>
              <p style="margin: 0 0 35px 0; font-size: 16px; color: #334155; line-height: 1.6;">
                Thank you for registering with Avento. To complete your registration and secure your account, please verify your email address using the One-Time Password (OTP) below.
              </p>

              <!-- OTP Box -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <div style="background-color: #f1f5f9; border-radius: 12px; padding: 24px; display: inline-block; min-width: 200px;">
                      <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1e293b; text-align: center; margin-left: 8px;">
                        ${otp}
                      </div>
                    </div>
                    <p style="margin: 15px 0 0 0; font-size: 14px; color: #64748b; text-align: center;">
                      This code is valid for 10 minutes.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Security Notice & Support -->
              <div style="margin-top: 40px;">
                <p style="margin: 0 0 20px 0; font-size: 14px; color: #64748b; line-height: 1.6;">
                  <strong>Security Notice:</strong><br>
                  If you did not initiate this registration request, you may safely ignore this email.
                </p>
                <p style="margin: 0; font-size: 14px; color: #64748b; line-height: 1.6;">
                  Need assistance?<br>
                  📧 <a href="mailto:admin.avento@gmail.com" style="color: #7C3AED; text-decoration: none; font-weight: 500;">admin.avento@gmail.com</a>
                </p>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 0 0 20px 0;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.5;">
                This is an automated message from Avento.<br>
                Please do not reply directly to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`[OTP] Nodemailer send successful.`);

    return res.json({
      message: `OTP sent successfully to ${emailLower}. Please check your inbox.`,
      email: emailLower,
    });
  } catch (err) {
    console.error('[OTP] SendOtp error encountered:');
    console.error(err); 
    
    return res.status(500).json({ 
      message: 'Server error sending OTP.', 
      error: err.message,
      stack: err.stack
    });
  }
};

// ─── SYNC PASSWORD ──────────────────────────────────────────────────────────
// Synchronizes the password in MongoDB when updated via Supabase client session (e.g. Forgot Password)
exports.syncPassword = async (req, res) => {
  try {
    const { access_token, password } = req.body;
    if (!access_token || !password) {
      return res.status(400).json({ message: 'Missing token or password' });
    }

    // Verify the Supabase access token
    const { data: { user }, error } = await supabase.auth.getUser(access_token);
    if (error || !user) {
      return res.status(401).json({ message: 'Invalid or expired session' });
    }

    if (!validatePasswordStrength(password)) {
      return res.status(400).json({ message: 'Password does not meet strength requirements.' });
    }

    // Update password in Supabase via admin client
    const { error: authError } = await supabase.auth.admin.updateUserById(user.id, { password });
    if (authError) {
      return res.status(500).json({ message: 'Failed to update password in authentication provider', error: authError.message });
    }

    // Update password in MongoDB (upsert if record is missing)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const mongoUser = await User.findById(user.id);
    if (mongoUser) {
      await User.findByIdAndUpdate(user.id, { password: hashedPassword });
    } else {
      const email = user.email || '';
      const name = user.user_metadata?.full_name || email.split('@')[0];
      const role = user.user_metadata?.role || 'student';
      await User.create({ _id: user.id, name, email, password: hashedPassword, role, isVerified: true });
    }
    
    // Ensure first_login flag is cleared in profiles
    await supabase.from('profiles').update({ first_login: false }).eq('id', user.id);
    
    res.json({ success: true, message: 'Password synced successfully' });
  } catch (err) {
    console.error('syncPassword error:', err.message);
    res.status(500).json({ message: 'Server error syncing password', error: err.message });
  }
};
