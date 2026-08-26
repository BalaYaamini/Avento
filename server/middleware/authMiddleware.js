// server/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabaseClient');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or malformed Authorization header.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'avento_super_secret_key_12345');

    // Fetch user profile from MongoDB first
    const user = await User.findById(decoded.id);

    // Fetch user profile from Supabase
    let profileData = null;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', String(decoded.id))
        .maybeSingle();

      if (!error && data) {
        profileData = data;
      }
    } catch (supErr) {
      console.warn('Supabase authMiddleware profile fetch warning:', supErr.message);
    }

    if (!user && !profileData) {
      return res.status(401).json({ message: 'User not found.' });
    }

    if (profileData && profileData.status === 'inactive') {
      return res.status(403).json({ message: 'Account is deactivated. Please contact administrator.' });
    }

    const email = profileData?.email || user?.email;
    const rawRole = profileData?.role || user?.role || 'student';
    let roles = [rawRole];
    if (rawRole === 'organizer') {
      roles.push('student');
    }

    // Ensure admin role for specific email
    if (email === 'admin.avento@gmail.com' && !roles.includes('admin')) {
      roles = ['admin'];
    }

    req.user = {
      id: decoded.id,
      email: email,
      fullName: profileData?.name || user?.name,
      roles: roles,
      employeeId: user?.employeeId || null,
      rollNumber: profileData?.roll_number || user?.rollNumber || null,
      department: profileData?.department || user?.department || null,
      first_login: profileData ? (profileData.first_login !== false) : false,
      avatarUrl: profileData?.avatar_url || user?.avatarUrl || null,
      phone: profileData?.phone || user?.phone || null,
      gender: profileData?.gender || user?.gender || null,
      degreeProgram: profileData?.degree_program || user?.degreeProgram || null,
      yearOfStudy: profileData?.year_of_study || user?.yearOfStudy || null,
      collegeName: profileData?.college_name || user?.collegeName || null,
    };

    // Enforce first_login on backend for all protected routes except profile and change-password
    if (profileData && profileData.first_login && !roles.includes('admin')) {
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
