// server/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const supabase = require('../config/supabaseClient'); // Keep for events check if needed

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or malformed Authorization header.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'avento_super_secret_key_12345');
    
    // Fetch authoritative role from MongoDB
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'User not found.' });
    }

    let roles = [user.role];
    if (user.role === 'organizer') {
      roles.push('student');
    }

    // Ensure admin role for specific email
    if (user.email === 'admin.avento@gmail.com' && !roles.includes('admin')) {
      roles = ['admin'];
    }

    // Check status in Supabase profiles (safely catch missing column / PostgREST errors)
    let profileData = null;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user._id)
        .maybeSingle();

      if (!error && data) {
        profileData = data;
      }
    } catch (supErr) {
      console.warn('Supabase profile fetch warning:', supErr.message);
    }

    if (profileData && profileData.status === 'inactive') {
      return res.status(403).json({ message: 'Account is deactivated. Please contact administrator.' });
    }

    req.user = {
      id: user._id,
      email: user.email,
      fullName: user.name,
      roles: roles,
      employeeId: user.employeeId || null,
      rollNumber: (profileData && profileData.roll_number) ? profileData.roll_number : (user.rollNumber || null),
      department: (profileData && profileData.department) ? profileData.department : (user.department || null),
      first_login: profileData ? (profileData.first_login !== false) : false,
      avatarUrl: (profileData && profileData.avatar_url) ? profileData.avatar_url : (user.avatarUrl || null),
      phone: (profileData && profileData.phone) ? profileData.phone : (user.phone || null),
      gender: (profileData && profileData.gender) ? profileData.gender : (user.gender || null),
      degreeProgram: (profileData && profileData.degree_program) ? profileData.degree_program : (user.degreeProgram || null),
      yearOfStudy: (profileData && profileData.year_of_study) ? profileData.year_of_study : (user.yearOfStudy || null),
      collegeName: (profileData && profileData.college_name) ? profileData.college_name : (user.collegeName || null),
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
