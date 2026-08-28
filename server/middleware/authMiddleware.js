// server/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabaseClient');

// Simple in-memory profile cache (TTL: 5 minutes)
const profileCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function getCachedProfile(userId) {
  const entry = profileCache.get(userId);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  profileCache.delete(userId);
  return null;
}

function setCachedProfile(userId, data) {
  // Limit cache size to prevent memory leaks
  if (profileCache.size > 500) {
    const oldestKey = profileCache.keys().next().value;
    profileCache.delete(oldestKey);
  }
  profileCache.set(userId, { data, ts: Date.now() });
}

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or malformed Authorization header.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'avento_super_secret_key_12345');

    // Fetch user profile from Supabase (with cache)
    let profileData = getCachedProfile(decoded.id);
    if (!profileData) {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', String(decoded.id))
          .maybeSingle();

        if (data) {
          profileData = data;
        } else if (decoded.email) {
          const { data: dataByEmail } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', String(decoded.email).toLowerCase())
            .maybeSingle();
          if (dataByEmail) profileData = dataByEmail;
        }
        if (profileData) setCachedProfile(decoded.id, profileData);
      } catch (supErr) {
        console.warn('Supabase authMiddleware profile fetch warning:', supErr.message);
      }
    }

    if (!profileData) {
      return res.status(401).json({ message: 'User profile not found.' });
    }

    if (profileData.status === 'inactive') {
      return res.status(403).json({ message: 'Account is deactivated. Please contact administrator.' });
    }

    const email = profileData.email || decoded.email;
    const rawRole = profileData.role || 'student';
    let roles = [rawRole];
    if (rawRole === 'organizer') {
      roles.push('student');
    }

    // Ensure admin role for specific email
    if (email === 'admin.avento@gmail.com' && !roles.includes('admin')) {
      roles = ['admin'];
    }

    let userRollNo = profileData.roll_number || null;

    req.user = {
      id: profileData.id || decoded.id,
      email: email,
      name: profileData.name || email.split('@')[0],
      fullName: profileData.name || email.split('@')[0],
      roles: roles,
      employeeId: profileData.employee_id || null,
      rollNumber: userRollNo,
      roll_number: userRollNo,
      department: profileData.department || null,
      first_login: profileData.first_login === true,
      avatarUrl: profileData.avatar_url || null,
      avatar_url: profileData.avatar_url || null,
      phone: profileData.phone || null,
      gender: profileData.gender || null,
      degreeProgram: profileData.degree_program || null,
      degree_program: profileData.degree_program || null,
      yearOfStudy: profileData.year_of_study || null,
      year_of_study: profileData.year_of_study || null,
      collegeName: profileData.college_name || null,
      college_name: profileData.college_name || null,
    };

    // Enforce first_login on backend for all protected routes except profile and change-password
    if (profileData.first_login && !roles.includes('admin')) {
      const allowedWhileFirstLogin = ['/api/auth/profile', '/api/auth/change-password', '/api/users/profile'];
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
