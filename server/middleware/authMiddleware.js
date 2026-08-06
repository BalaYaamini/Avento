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
      id: user._id,
      email: user.email,
      fullName: user.name,
      roles: roles,
      employeeId: null,
      rollNumber: null,
      first_login: profileData ? profileData.first_login : false,
    };

    // Enforce first_login on backend for all protected routes except the profile endpoint itself
    if (profileData && profileData.first_login && !roles.includes('admin')) {
      if (req.originalUrl !== '/api/auth/profile') {
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
