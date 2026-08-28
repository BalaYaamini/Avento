// server/controllers/authController.js
// Supabase-only authentication controller (no MongoDB)
const supabase = require('../config/supabaseClient');
const jwt = require('jsonwebtoken');
const { validatePasswordStrength } = require('../utils/passwordValidator');
const { sendPasswordResetEmail, sendEmailNotification } = require('../services/notificationService');

const COLLEGE_DOMAINS = ['@cse.suh.edu.in', '@aiml.suh.edu.in', '@suh.edu.in'];

const getRoleFromEmail = (email) => {
  const e = email.toLowerCase();
  if (e === 'admin.avento@gmail.com') return 'admin';
  if (e.endsWith('@cse.suh.edu.in') || e.endsWith('@aiml.suh.edu.in')) return 'student';
  if (e.endsWith('@suh.edu.in')) return 'faculty';
  return 'student';
};

const upsertProfile = async (userId, email, name, role, employeeId = null, rollNumber = null, registrationMethod = 'imported') => {
  const profile = {
    id: userId,
    email,
    name,
    role,
    created_at: new Date().toISOString(),
    registration_method: registrationMethod,
    first_login: false,
  };
  if (role === 'faculty' && employeeId) profile.employee_id = employeeId;
  if (role === 'student' && rollNumber) profile.roll_number = rollNumber;
  if (registrationMethod === 'otp') profile.has_password = true;

  const { error } = await supabase
    .from('profiles')
    .upsert(profile, { onConflict: 'id' });
  if (error) throw error;
  return profile;
};

// ─── REGISTER ───────────────────────────────────────
exports.register = async (req, res) => {
  try {
    const { fullName, email, password, otp, phone, college, gender } = req.body;
    if (!fullName || !email || !password || !otp) {
      return res.status(400).json({ message: 'Please provide fullName, email, password, and OTP.' });
    }

    const emailLower = email.toLowerCase().trim();

    if (!validatePasswordStrength(password)) {
      return res.status(400).json({ message: 'Password does not meet strength requirements.' });
    }

    const role = getRoleFromEmail(emailLower);

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
    // Check if profile already exists (avoids expensive listUsers call)
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', emailLower)
      .maybeSingle();

    if (existingProfile) {
      userId = existingProfile.id;
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
      rollNumber = null;
    }

    const profile = await upsertProfile(userId, emailLower, fullName, role, employeeId, rollNumber, 'otp');

    if (phone || college || gender) {
      const updates = {};
      if (phone) updates.phone = phone;
      if (college) updates.college = college;
      if (gender) updates.gender = gender;
      await supabase.from('profiles').update(updates).eq('id', userId);
    }

    // Remove OTP after successful registration
    await supabase.from('otps').delete().eq('email', emailLower);

    // Auto-link pending team email invites
    try {
      const { data: pendingInvites } = await supabase
        .from('team_email_invites')
        .select('id, event_id, team_id, events(title), event_teams(name)')
        .eq('email', emailLower)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString());

      if (pendingInvites && pendingInvites.length > 0) {
        for (const invite of pendingInvites) {
          const { error: regErr } = await supabase
            .from('event_registrations')
            .insert({
              user_id: userId,
              event_id: invite.event_id,
              team_id: invite.team_id,
              status: 'pending',
              created_at: new Date().toISOString()
            });
          if (!regErr || regErr.code === '23505') {
            await supabase.from('team_email_invites').update({ status: 'accepted' }).eq('id', invite.id);
          }
        }
      }
    } catch (linkErr) {
      console.warn('[Register] Auto-link invites error:', linkErr.message);
    }

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

    // Check if user registered via Google and has no password set
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('registration_method, has_password')
      .eq('email', emailLower)
      .maybeSingle();

    if (existingProfile && existingProfile.registration_method === 'google' && !existingProfile.has_password) {
      return res.status(400).json({ 
        message: 'This account was created with Google Sign-In. Please log in with Google, or set a password first from your profile.',
        needsPassword: true
      });
    }

    // Use Supabase Auth for password verification
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: emailLower,
      password: password,
    });

    // If sign-in fails, check if this is a Google-only user without a password
    if (authError || !authData?.user) {
      // Profile with google registration already caught above.
      // If no profile exists, we can't determine provider without listing all users.
      // Just return invalid credentials — user should use Google sign-in.
      console.log(`[AUTH] Login Failed for '${emailLower}':`, authError?.message || 'No user returned');
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const supaUser = authData.user;

    // Query full profile from Supabase profiles table (single source of truth)
    const { data: profileData, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', supaUser.id)
      .maybeSingle();

    if (profileErr) {
      console.warn('[AUTH] Profile lookup warning:', profileErr.message);
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

    // Auto-link pending team email invites
    try {
      const { data: pendingInvites } = await supabase
        .from('team_email_invites')
        .select('id, event_id, team_id')
        .eq('email', emailLower)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString());

      if (pendingInvites && pendingInvites.length > 0) {
        for (const invite of pendingInvites) {
          const { error: regErr } = await supabase
            .from('event_registrations')
            .insert({
              user_id: supaUser.id,
              event_id: invite.event_id,
              team_id: invite.team_id,
              status: 'pending',
              created_at: new Date().toISOString()
            });
          if (!regErr || regErr.code === '23505') {
            await supabase.from('team_email_invites').update({ status: 'accepted' }).eq('id', invite.id);
          }
        }
      }
    } catch (linkErr) {
      console.warn('[Login] Auto-link invites error:', linkErr.message);
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
        employeeId: profileData?.employee_id || null,
        rollNumber: profileData?.roll_number || null,
        phone: profileData?.phone || null,
        gender: profileData?.gender || null,
        collegeName: profileData?.college_name || null,
        department: profileData?.department || null,
        degreeProgram: profileData?.degree_program || null,
        yearOfStudy: profileData?.year_of_study || null,
        avatarUrl: profileData?.avatar_url || null,
        first_login: profileData ? profileData.first_login : false,
        registrationMethod: profileData?.registration_method || 'imported',
        hasPassword: profileData?.has_password || false
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
    const emailLower = String(req.body.email || '').toLowerCase().trim();
    const redirectTo = String(req.body.redirectTo || '').trim();

    if (!emailLower || !redirectTo) {
      return res.status(400).json({ message: 'Email and redirect URL are required.' });
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', emailLower)
      .maybeSingle();

    if (!profileData) {
      return res.status(400).json({ message: 'No account found with this email.' });
    }

    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: emailLower,
      options: { redirectTo },
    });
    if (error || !data?.properties?.action_link) {
      throw error || new Error('Could not generate password reset link.');
    }

    await sendPasswordResetEmail({
      recipientEmail: emailLower,
      resetUrl: data.properties.action_link,
    });

    return res.json({ message: `Password reset link sent to ${emailLower}. Please check your inbox.` });
  } catch (err) {
    console.error('Password reset email error:', err.message);
    return res.status(500).json({ message: 'Failed to send reset link. Please try again.' });
  }
};

// ─── GET PROFILE ────────────────────────────────────────────────────────────
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    let freshProfile = null;

    if (userId) {
      const { data: dbProf } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', String(userId))
        .maybeSingle();
      if (dbProf) freshProfile = dbProf;
    }

    if (!freshProfile && req.user?.email) {
      const { data: byEmail } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', String(req.user.email).toLowerCase())
        .maybeSingle();
      if (byEmail) freshProfile = byEmail;
    }

    const mergedUser = {
      ...req.user,
      ...(freshProfile || {}),
      name: freshProfile?.name || req.user.name || req.user.fullName,
      fullName: freshProfile?.name || req.user.fullName || req.user.name,
      rollNumber: freshProfile?.roll_number || req.user.rollNumber || null,
      roll_number: freshProfile?.roll_number || req.user.roll_number || null,
      phone: freshProfile?.phone || req.user.phone || null,
      gender: freshProfile?.gender || req.user.gender || null,
      collegeName: freshProfile?.college_name || req.user.collegeName || null,
      college_name: freshProfile?.college_name || req.user.college_name || null,
      department: freshProfile?.department || req.user.department || null,
      degreeProgram: freshProfile?.degree_program || req.user.degreeProgram || null,
      degree_program: freshProfile?.degree_program || req.user.degree_program || null,
      yearOfStudy: freshProfile?.year_of_study || req.user.yearOfStudy || null,
      year_of_study: freshProfile?.year_of_study || req.user.year_of_study || null,
      avatarUrl: freshProfile?.avatar_url || req.user.avatarUrl || null,
      avatar_url: freshProfile?.avatar_url || req.user.avatar_url || null,
    };

    return res.json({ user: mergedUser });
  } catch (err) {
    console.error('getProfile error:', err.message);
    res.status(500).json({ message: 'Server error fetching profile.', error: err.message });
  }
};

// ─── SEND OTP ───────────────────────────────────────────────────────────────
exports.sendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const emailLower = email.toLowerCase().trim();

    // Check if user already exists in Supabase profiles
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', emailLower)
      .maybeSingle();

    if (existingProfile) {
      return res.status(400).json({ message: 'User already exists with this email.' });
    }

    console.log(`[OTP] Generating OTP for ${emailLower}...`);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    console.log(`[OTP] Saving OTP to Supabase...`);
    const { error: otpUpsertErr } = await supabase
      .from('otps')
      .upsert({ email: emailLower, otp, created_at: new Date().toISOString() }, { onConflict: 'email' });
    if (otpUpsertErr) throw otpUpsertErr;
    console.log(`[OTP] OTP saved successfully.`);

    const otpHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#F8FAFC;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#F8FAFC;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.08);">
        <tr><td style="height:8px;background:linear-gradient(135deg,#7C3AED,#8B5CF6);"></td></tr>
        <tr><td style="padding:40px 20px 10px 20px;text-align:center;background-color:#ffffff;">
          <h1 style="margin:0;font-size:32px;letter-spacing:1px;">
            <span style="background-color:#F5D76E;color:#1e293b;padding:2px 10px;border-radius:4px;display:inline-block;">AVENTO</span>
          </h1>
          <p style="margin:12px 0 0 0;color:#7C3AED;font-size:20px;font-weight:600;letter-spacing:1px;">Verification Code</p>
        </td></tr>
        <tr><td style="padding:30px 40px;">
          <p style="margin:0 0 20px 0;font-size:16px;color:#334155;line-height:1.6;">Hello,</p>
          <p style="margin:0 0 20px 0;font-size:16px;color:#334155;line-height:1.6;">Welcome to <strong>Avento</strong>! Use the code below to verify your email address.</p>
          <table width="100%" border="0" cellspacing="0" cellpadding="0"><tr><td align="center">
            <div style="background-color:#f1f5f9;border-radius:12px;padding:24px;display:inline-block;min-width:200px;">
              <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#1e293b;text-align:center;margin-left:8px;">${otp}</div>
            </div>
            <p style="margin:15px 0 0 0;font-size:14px;color:#64748b;text-align:center;">This code is valid for 5 minutes.</p>
          </td></tr></table>
          <p style="margin:25px 0 0 0;font-size:13px;color:#94a3b8;line-height:1.5;">If you did not request this, you can safely ignore this email.</p>
        </td></tr>
        <tr><td style="padding:0 40px 30px 40px;">
          <hr style="border:0;border-top:1px solid #e2e8f0;margin:0 0 20px 0;">
          <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">This is an automated message from Avento.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await sendEmailNotification({
      recipientEmail: emailLower,
      subject: 'Avento Verification Code',
      htmlBody: otpHtml,
    });

    console.log(`[OTP] OTP sent successfully to ${emailLower}.`);
    return res.json({
      message: `OTP sent successfully to ${emailLower}. Please check your inbox.`,
      email: emailLower,
    });
  } catch (err) {
    console.error('[OTP] SendOtp error:', err.message);
    return res.status(500).json({
      message: 'Server error sending OTP.',
      error: err.message,
    });
  }
};

// ─── GOOGLE LOGIN ────────────────────────────────────────────────────────
exports.googleLogin = async (req, res) => {
  try {
    const { access_token } = req.body;
    if (!access_token) {
      return res.status(400).json({ message: 'Missing Supabase access token.' });
    }

    const { data: { user: supaUser }, error: getUserErr } = await supabase.auth.getUser(access_token);
    if (getUserErr || !supaUser) {
      return res.status(401).json({ message: 'Invalid or expired session.' });
    }

    const emailLower = supaUser.email.toLowerCase().trim();
    const fullName = supaUser.user_metadata?.full_name || supaUser.user_metadata?.name || emailLower.split('@')[0];
    const avatarUrl = supaUser.user_metadata?.avatar_url || null;

    let { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', supaUser.id)
      .maybeSingle();

    if (profileData && profileData.status === 'inactive') {
      return res.status(403).json({ message: 'Account is deactivated. Please contact administrator.' });
    }

    const role = getRoleFromEmail(emailLower);

    if (!profileData) {
      const newProfile = {
        id: supaUser.id,
        email: emailLower,
        name: fullName,
        role,
        created_at: new Date().toISOString(),
        first_login: false,
        registration_method: 'google',
        has_password: false,
      };
      const { error: upsertErr } = await supabase
        .from('profiles')
        .upsert(newProfile, { onConflict: 'id' });
      if (upsertErr) {
        console.error('[Google Login] Profile upsert error:', upsertErr.message);
        return res.status(500).json({ message: 'Failed to create user profile.', error: upsertErr.message });
      }
      if (avatarUrl) {
        const { error: avatarErr } = await supabase
          .from('profiles')
          .update({ avatar_url: avatarUrl })
          .eq('id', supaUser.id);
        if (avatarErr) console.warn('[Google Login] Avatar update skipped:', avatarErr.message);
      }
      profileData = { role, status: 'active', first_login: false };
    } else if (profileData.registration_method !== 'google') {
      await supabase
        .from('profiles')
        .update({ registration_method: 'google' })
        .eq('id', supaUser.id);
    }

    let userRole = profileData.role || role;
    if (emailLower === 'admin.avento@gmail.com') {
      userRole = 'admin';
      if (profileData.role !== 'admin') {
        await supabase.from('profiles').update({ role: 'admin' }).eq('id', supaUser.id);
      }
    }

    let roles = [userRole];
    if (userRole === 'organizer') roles.push('student');

    // Auto-link pending team email invites
    try {
      const { data: pendingInvites } = await supabase
        .from('team_email_invites')
        .select('id, event_id, team_id')
        .eq('email', emailLower)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString());

      if (pendingInvites && pendingInvites.length > 0) {
        for (const invite of pendingInvites) {
          const { error: regErr } = await supabase
            .from('event_registrations')
            .insert({
              user_id: supaUser.id,
              event_id: invite.event_id,
              team_id: invite.team_id,
              status: 'pending',
              created_at: new Date().toISOString()
            });
          if (!regErr || regErr.code === '23505') {
            await supabase.from('team_email_invites').update({ status: 'accepted' }).eq('id', invite.id);
          }
        }
      }
    } catch (linkErr) {
      console.warn('[Google Login] Auto-link invites error:', linkErr.message);
    }

    const token = jwt.sign(
      { id: supaUser.id, email: emailLower, role: userRole },
      process.env.JWT_SECRET || 'avento_super_secret_key_12345',
      { expiresIn: '30d' }
    );

    return res.json({
      token,
      user: {
        id: supaUser.id,
        email: emailLower,
        fullName: profileData?.name || fullName || emailLower.split('@')[0],
        roles,
        employeeId: profileData?.employee_id || null,
        rollNumber: profileData?.roll_number || null,
        phone: profileData?.phone || null,
        gender: profileData?.gender || null,
        collegeName: profileData?.college_name || null,
        department: profileData?.department || null,
        degreeProgram: profileData?.degree_program || null,
        yearOfStudy: profileData?.year_of_study || null,
        avatarUrl: profileData?.avatar_url || null,
        first_login: profileData?.first_login || false,
        registrationMethod: profileData?.registration_method || 'google',
        hasPassword: profileData?.has_password || false,
      }
    });
  } catch (err) {
    console.error('[Google Login] Error:', err.message);
    return res.status(500).json({ message: 'Server error during Google login.', error: err.message });
  }
};

// NOTE: getProfile is already defined earlier in this file (line ~351) with full dual-casing support.
// Do NOT redefine exports.getProfile here.

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

// ─── SET PASSWORD (for Google-only users) ─────────────────────────────────
exports.setPassword = async (req, res) => {
  try {
    const { password } = req.body;
    const userId = req.user.id;

    if (!password) {
      return res.status(400).json({ message: 'Please provide a password.' });
    }

    if (!validatePasswordStrength(password)) {
      return res.status(400).json({ message: 'Password does not meet strength requirements.' });
    }

    const { error: authError } = await supabase.auth.admin.updateUserById(userId, { password });
    if (authError) {
      return res.status(500).json({ message: 'Failed to set password.', error: authError.message });
    }

    await supabase.from('profiles').update({ has_password: true }).eq('id', userId);

    res.json({ message: 'Password set successfully. You can now log in with email and password.' });
  } catch (err) {
    console.error('[SetPassword] Error:', err.message);
    res.status(500).json({ message: 'Server error setting password.', error: err.message });
  }
};

// ─── SEND SET-PASSWORD OTP (public — for Google-only users) ────────────────
exports.sendSetPasswordOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required.' });

    const emailLower = email.toLowerCase().trim();

    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('id, registration_method, has_password')
      .eq('email', emailLower)
      .maybeSingle();
    if (profErr) throw profErr;

    if (!profile) {
      return res.status(400).json({ message: 'No account found. Please sign in with Google first to set up your account.' });
    } else if (profile.registration_method !== 'google' || profile.has_password) {
      return res.status(400).json({ message: 'This account can use email/password login directly.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const { error: otpUpsertErr } = await supabase
      .from('otps')
      .upsert({ email: emailLower, otp, created_at: new Date().toISOString() }, { onConflict: 'email' });
    if (otpUpsertErr) throw otpUpsertErr;

    const otpHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#F8FAFC;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#F8FAFC;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.08);">
        <tr><td style="height:8px;background:linear-gradient(135deg,#7C3AED,#8B5CF6);"></td></tr>
        <tr><td style="padding:40px 20px 10px 20px;text-align:center;background-color:#ffffff;">
          <h1 style="margin:0;font-size:32px;letter-spacing:1px;">
            <span style="background-color:#F5D76E;color:#1e293b;padding:2px 10px;border-radius:4px;display:inline-block;">AVENTO</span>
          </h1>
          <p style="margin:12px 0 0 0;color:#7C3AED;font-size:20px;font-weight:600;letter-spacing:1px;">Set Your Password</p>
        </td></tr>
        <tr><td style="padding:30px 40px;">
          <p style="margin:0 0 20px 0;font-size:16px;color:#334155;line-height:1.6;">Hello,</p>
          <p style="margin:0 0 20px 0;font-size:16px;color:#334155;line-height:1.6;">Use the code below to set a password for your <strong>Avento</strong> account so you can also log in with email.</p>
          <table width="100%" border="0" cellspacing="0" cellpadding="0"><tr><td align="center">
            <div style="background-color:#f1f5f9;border-radius:12px;padding:24px;display:inline-block;min-width:200px;">
              <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#1e293b;text-align:center;margin-left:8px;">${otp}</div>
            </div>
            <p style="margin:15px 0 0 0;font-size:14px;color:#64748b;text-align:center;">This code is valid for 5 minutes.</p>
          </td></tr></table>
          <p style="margin:25px 0 0 0;font-size:13px;color:#94a3b8;line-height:1.5;">If you did not request this, you can safely ignore this email.</p>
        </td></tr>
        <tr><td style="padding:0 40px 30px 40px;">
          <hr style="border:0;border-top:1px solid #e2e8f0;margin:0 0 20px 0;">
          <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">This is an automated message from Avento.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await sendEmailNotification({
      recipientEmail: emailLower,
      subject: 'Avento — Set Your Password',
      htmlBody: otpHtml,
    });

    console.log(`[SetPasswordOTP] OTP sent to ${emailLower}`);
    return res.json({ message: `OTP sent to ${emailLower}. Please check your inbox.` });
  } catch (err) {
    console.error('[SetPasswordOTP] SendOtp error:', err.message);
    return res.status(500).json({ message: 'Failed to send OTP.' });
  }
};

// ─── SET PASSWORD WITH OTP (public — for Google-only users) ────────────────
exports.setPasswordWithOtp = async (req, res) => {
  try {
    const { email, otp, password } = req.body;
    if (!email || !otp || !password) {
      return res.status(400).json({ message: 'Email, OTP, and password are required.' });
    }

    const emailLower = email.toLowerCase().trim();

    if (!validatePasswordStrength(password)) {
      return res.status(400).json({ message: 'Password does not meet strength requirements.' });
    }

    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('id, registration_method, has_password')
      .eq('email', emailLower)
      .maybeSingle();
    if (profErr) throw profErr;

    if (!profile) {
      return res.status(400).json({ message: 'No account found. Please sign in with Google first to set up your account.' });
    } else if (profile.registration_method !== 'google' || profile.has_password) {
      return res.status(400).json({ message: 'This account already has a password set.' });
    }

    const { data: otpRecord, error: otpFetchErr } = await supabase
      .from('otps')
      .select('otp, created_at')
      .eq('email', emailLower)
      .maybeSingle();
    if (otpFetchErr) throw otpFetchErr;

    if (!otpRecord) {
      return res.status(400).json({ message: 'OTP expired or not requested. Please request a new one.' });
    }

    const otpAge = (new Date() - new Date(otpRecord.created_at)) / 1000;
    if (otpAge > 300) {
      await supabase.from('otps').delete().eq('email', emailLower);
      return res.status(400).json({ message: 'OTP expired. Please request a new one.' });
    }

    if (otpRecord.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP. Please try again.' });
    }

    const userId = profile.id;
    const { error: authErr } = await supabase.auth.admin.updateUserById(userId, { password });
    if (authErr) {
      return res.status(500).json({ message: 'Failed to set password.', error: authErr.message });
    }

    await supabase.from('profiles').update({ has_password: true }).eq('id', userId);
    await supabase.from('otps').delete().eq('email', emailLower);

    res.json({ message: 'Password set successfully. You can now log in with email and password.' });
  } catch (err) {
    console.error('[SetPasswordWithOtp] Error:', err.message);
    res.status(500).json({ message: 'Server error setting password.', error: err.message });
  }
};
