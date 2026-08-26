// server/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabaseClient');

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or malformed Authorization header.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'avento_super_secret_key_12345');

    // Fetch user profile from Supabase (single source of truth)
    const { data: profileData, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', decoded.id)
      .single();

    if (profileErr || !profileData) {
      return res.status(401).json({ message: 'User not found.' });
    }

    let roles = [profileData.role];
    if (profileData.role === 'organizer') {
      roles.push('student');
    }

    // Ensure admin role for specific email
    if (profileData.email === 'admin.avento@gmail.com' && !roles.includes('admin')) {
      roles = ['admin'];
    }

    // Check status in Supabase profiles
    const { data: profileData } = await supabase
      .from('profiles')
      .select('status, first_login')
      .eq('id', user._id)
      .single();

    if (profileData && profileData.status === 'inactive') {
      return res.status(403).json({ message: 'Account is deactivated. Please contact administrator.' });
    }

    req.user = {
      id: profileData.id,
      email: profileData.email,
      fullName: profileData.name,
      roles: roles,
      employeeId: null,
      rollNumber: null,
      first_login: profileData ? profileData.first_login : false,
    };

    // Enforce first_login on backend for all protected routes except profile and change-password
    if (profileData.first_login && !roles.includes('admin')) {
      const allowedWhileFirstLogin = ['/api/auth/profile', '/api/auth/change-password'];
      const isAllowed = allowedWhileFirstLogin.some((route) => req.originalUrl.startsWith(route));
      if (!isAllowed) {
        return res.status(403).json({
          message: 'Please change your default password before accessing Avento features.',
          code: 'FIRST_LOGIN_REQUIRED'
        });
      }
    }

    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};
