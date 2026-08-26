// server/controllers/authController.js
// Supabase-only authentication controller (no MongoDB)
const supabase = require('../config/supabaseClient');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const { validatePasswordStrength } = require('../utils/passwordValidator');
const { sendPasswordResetEmail } = require('../services/notificationService');

const ALLOWED_DOMAINS = ['@cse.suh.edu.in', '@aiml.suh.edu.in', '@suh.edu.in'];

const getRoleFromEmail = (email) => {
  const e = email.toLowerCase();
  if (e.endsWith('@cse.suh.edu.in') || e.endsWith('@aiml.suh.edu.in')) return 'student';
  if (e.endsWith('@suh.edu.in')) return 'faculty';
  return null;
};

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

    // Verify OTP from Supabase table (with 5-min TTL check)
    const { data: otpRecord, error: otpFetchErr } = await supabase
      .from('otps')
      .select('otp, created_at')
      .eq('email', emailLower)
      .maybeSingle();

    if (otpFetchErr) throw otpFetchErr;
    if (!otpRecord) {
      return res.status(400).json({ message: 'OTP expired or not requested. Please request a new OTP.' });
    }

    // Check 5-minute TTL
    const otpAge = (new Date() - new Date(otpRecord.created_at)) / 1000;
    if (otpAge > 300) {
      await supabase.from('otps').delete().eq('email', emailLower);
      return res.status(400).json({ message: 'OTP expired. Please request a new OTP.' });
    }

    if (otpRecord.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP. Please try again.' });
    }

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

    let employeeId = null;
    let rollNumber = null;
    if (role === 'faculty') {
      const matches = emailLower.match(/^faculty(\d+)/i);
      employeeId = matches ? `EMP00${matches[1]}` : `EMP_${Math.floor(100 + Math.random() * 900)}`;
    } else if (role === 'student') {
      const matches = emailLower.match(/^(\d+)/);
      rollNumber = matches ? matches[1] : `2203A${Math.floor(100000 + Math.random() * 900000)}`;
    }

    await upsertProfile(userId, emailLower, fullName, role, employeeId, rollNumber);

    // Remove OTP after successful registration
    await supabase.from('otps').delete().eq('email', emailLower);

    return res.status(201).json({
      message: 'Registration successful. You can now log in.',
      user: {
        id: userId,
        fullName: fullName,
        email: emailLower,
        roles: [role],
      }
    });
  } catch (err) {
    if (err.code === '23505') {
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

    // Use Supabase Auth for password verification
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: emailLower,
      password: password,
    });

    if (authError || !authData?.user) {
      console.log(`[AUTH] Login Failed for '${emailLower}':`, authError?.message || 'No user returned');
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const supaUser = authData.user;

    // Check status in Supabase profiles
    const { data: profileData, error: profileErr } = await supabase
      .from('profiles')
      .select('status, first_login')
      .eq('email', emailLower)
      .single();

    if (profileErr) {
      console.warn('[AUTH] Profile lookup error:', profileErr.message);
    }

    if (profileData && profileData.status === 'inactive') {
      return res.status(403).json({ message: 'Account is deactivated. Please contact administrator.' });
    }

    // Role from profile (authoritative), fallback to auth metadata
    let userRole = profileData?.role || supaUser.user_metadata?.role || 'student';

    // Admin override
    if (emailLower === 'admin.avento@gmail.com') {
      userRole = 'admin';
      if (profileData?.role !== 'admin') {
        await supabase.from('profiles').update({ role: 'admin' }).eq('id', supaUser.id);
      }
    }

    let roles = [userRole];
    if (userRole === 'organizer') {
      roles.push('student');
    }

    const fullName = profileData?.name || supaUser.user_metadata?.full_name || emailLower.split('@')[0];

    // Generate JWT
    const token = jwt.sign(
      { id: supaUser.id, email: supaUser.email, role: userRole },
      process.env.JWT_SECRET || 'avento_super_secret_key_12345',
      { expiresIn: '30d' }
    );

    return res.json({
      token,
      user: {
        id: supaUser.id,
        email: supaUser.email,
        fullName: fullName,
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

// ─── SEND PASSWORD RESET ────────────────────────────────────────────────────
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
    return res.json({ user: req.user });
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching profile.', error: err.message });
  }
};

// ─── SEND OTP ───────────────────────────────────────────────────────────────
exports.sendOtp = async (req, res) => {
  let emailLower = '';
  let otp = '';

  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    emailLower = email.toLowerCase().trim();

    // Check if user already exists in Supabase profiles
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', emailLower)
      .maybeSingle();

    if (existingProfile) {
      return res.status(400).json({ message: 'User already exists with this email.' });
    }

    // Also check Supabase Auth
    const { data: usersData } = await supabase.auth.admin.listUsers();
    const existingAuth = usersData?.users?.find((u) => u.email.toLowerCase() === emailLower);
    if (existingAuth) {
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

    console.log(`[OTP] Saving OTP to Supabase...`);
    const { error: otpUpsertErr } = await supabase
      .from('otps')
      .upsert({ email: emailLower, otp, created_at: new Date().toISOString() }, { onConflict: 'email' });
    if (otpUpsertErr) throw otpUpsertErr;
    console.log(`[OTP] OTP saved successfully.`);

    console.log(`[OTP] Initializing email transporter...`);

    console.log(`[OTP] EMAIL_USER configured:`, !!process.env.EMAIL_USER);
    console.log(`[OTP] EMAIL_PASS configured:`, !!process.env.EMAIL_PASS);

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error(`[OTP] CRITICAL ERROR: SMTP credentials missing in environment variables.`);
      return res.status(500).json({ message: 'Server configuration error: Email credentials missing.' });
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
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
        <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.08);">
          <tr>
            <td style="height: 8px; background: linear-gradient(135deg, #7C3AED, #8B5CF6);"></td>
          </tr>
          <tr>
            <td style="padding: 40px 20px 10px 20px; text-align: center; background-color: #ffffff;">
              <img src="https://joekmqnkpfjuptcgzpmh.supabase.co/storage/v1/object/public/public-assets/avento-logo-public.png" alt="Avento Logo" width="60" style="display: block; margin: 0 auto 15px auto; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
              <h1 style="margin: 0; font-size: 32px; letter-spacing: 1px;">
                <span style="background-color: #F5D76E; color: #1e293b; padding: 2px 10px; border-radius: 4px; display: inline-block;">AVENTO</span>
              </h1>
              <p style="margin: 12px 0 0 0; color: #7C3AED; font-size: 20px; font-weight: 600; letter-spacing: 1px;">Verification Code</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #334155; line-height: 1.6;">Hello,</p>
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #334155; line-height: 1.6;">Welcome to <strong>Avento</strong> — your university's smart campus events platform.</p>
              <p style="margin: 0 0 35px 0; font-size: 16px; color: #334155; line-height: 1.6;">Thank you for registering with Avento. To complete your registration and secure your account, please verify your email address using the One-Time Password (OTP) below.</p>
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <div style="background-color: #f1f5f9; border-radius: 12px; padding: 24px; display: inline-block; min-width: 200px;">
                      <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1e293b; text-align: center; margin-left: 8px;">${otp}</div>
                    </div>
                    <p style="margin: 15px 0 0 0; font-size: 14px; color: #64748b; text-align: center;">This code is valid for 5 minutes.</p>
                  </td>
                </tr>
              </table>
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
exports.syncPassword = async (req, res) => {
  try {
    const { access_token, password } = req.body;
    if (!access_token || !password) {
      return res.status(400).json({ message: 'Missing token or password' });
    }

    const { data: { user }, error } = await supabase.auth.getUser(access_token);
    if (error || !user) {
      return res.status(401).json({ message: 'Invalid or expired session' });
    }

    if (!validatePasswordStrength(password)) {
      return res.status(400).json({ message: 'Password does not meet strength requirements.' });
    }

    // Update password in Supabase Auth only
    const { error: authError } = await supabase.auth.admin.updateUserById(user.id, { password });
    if (authError) {
      return res.status(500).json({ message: 'Failed to update password in authentication provider', error: authError.message });
    }

    // Ensure first_login flag is cleared in profiles
    await supabase.from('profiles').update({ first_login: false }).eq('id', user.id);

    res.json({ success: true, message: 'Password synced successfully' });
  } catch (err) {
    console.error('syncPassword error:', err.message);
    res.status(500).json({ message: 'Server error syncing password', error: err.message });
  }
};
