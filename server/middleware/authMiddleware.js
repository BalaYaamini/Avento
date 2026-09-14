// server/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabaseClient');

// Simple in-memory profile cache (TTL: 5 minutes)
const profileCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function getCachedProfile(key) {
  if (!key) return null;
  const entry = profileCache.get(String(key).toLowerCase());
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  profileCache.delete(String(key).toLowerCase());
  return null;
}

function setCachedProfile(key, data) {
  if (!key || !data) return;
  // Limit cache size to prevent memory leaks
  if (profileCache.size > 500) {
    const oldestKey = profileCache.keys().next().value;
    profileCache.delete(oldestKey);
  }
  profileCache.set(String(key).toLowerCase(), { data, ts: Date.now() });
}

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or malformed Authorization header.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    let decoded = null;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'avento_super_secret_key_12345');
    } catch (jwtErr) {
      // If verification with custom secret fails, try resolving with Supabase Auth (e.g. Supabase access token)
      try {
        const { data: supaUser } = await supabase.auth.getUser(token);
        if (supaUser?.user) {
          decoded = {
            id: supaUser.user.id,
            email: supaUser.user.email,
            role: supaUser.user.user_metadata?.role || 'student'
          };
        }
      } catch (sErr) {
        // Ignore fallback error
      }
      if (!decoded) {
        if (jwtErr.name === 'TokenExpiredError') {
          return res.status(401).json({ message: 'Token expired. Please login again.' });
        }
        return res.status(401).json({ message: 'Invalid or expired token.' });
      }
    }

    const userId = decoded.id || decoded._id || decoded.sub;
    const userEmail = decoded.email ? String(decoded.email).toLowerCase().trim() : null;

    // Fetch user profile from Supabase (check cache first)
    let profileData = getCachedProfile(userId) || getCachedProfile(userEmail);

    if (!profileData) {
      try {
        // 1. Try lookup by profile ID
        if (userId) {
          const { data, error: idErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', String(userId))
            .maybeSingle();
          if (!idErr && data) {
            profileData = data;
          }
        }

        // 2. Fallback: lookup by email
        if (!profileData && userEmail) {
          const { data: dataByEmail, error: emailErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', userEmail)
            .maybeSingle();
          if (!emailErr && dataByEmail) {
            profileData = dataByEmail;
          }
        }

        // 3. Fallback: Check Supabase Auth users to resolve or auto-heal missing profile
        if (!profileData && (userId || userEmail)) {
          let authUser = null;
          if (userId) {
            try {
              const { data: aData } = await supabase.auth.admin.getUserById(String(userId));
              if (aData?.user) authUser = aData.user;
            } catch (e) {}
          }
          if (!authUser && userEmail) {
            try {
              const { data: listData } = await supabase.auth.admin.listUsers();
              authUser = listData?.users?.find(u => u.email?.toLowerCase() === userEmail);
            } catch (e) {}
          }

          if (authUser) {
            const authEmail = (authUser.email || userEmail || '').toLowerCase().trim();
            // Check if profile exists by auth user's email
            const { data: pByAuthEmail } = await supabase
              .from('profiles')
              .select('*')
              .eq('email', authEmail)
              .maybeSingle();

            if (pByAuthEmail) {
              profileData = pByAuthEmail;
              // If profile ID differed, sync to authUser ID
              if (pByAuthEmail.id !== authUser.id) {
                await supabase.from('profiles').update({ id: authUser.id }).eq('id', pByAuthEmail.id).catch(() => {});
                profileData.id = authUser.id;
              }
            } else {
              // Auto-create missing active student profile for authenticated user
              const fullName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || authEmail.split('@')[0];
              const role = authEmail === 'admin.avento@gmail.com' ? 'admin' : (authUser.user_metadata?.role || 'student');
              const newProfile = {
                id: authUser.id,
                email: authEmail,
                name: fullName,
                role: role,
                status: 'active',
                first_login: false,
                registration_method: authUser.app_metadata?.provider === 'google' ? 'google' : 'otp',
                created_at: new Date().toISOString()
              };
              const { data: createdProf, error: insErr } = await supabase
                .from('profiles')
                .upsert(newProfile, { onConflict: 'id' })
                .select()
                .single();
              if (!insErr && createdProf) {
                profileData = createdProf;
              } else {
                profileData = newProfile;
              }
            }
          }
        }

        // Cache the profile under both ID and Email
        if (profileData) {
          if (profileData.id) setCachedProfile(profileData.id, profileData);
          if (profileData.email) setCachedProfile(profileData.email, profileData);
          if (userId) setCachedProfile(userId, profileData);
        }
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

    const email = (profileData.email || userEmail || '').toLowerCase();
    const rawRole = profileData.role || 'student';
    let roles = [rawRole];
    if (rawRole === 'organizer' || rawRole === 'student_organizer') {
      if (!roles.includes('student')) roles.push('student');
    }
    if (rawRole === 'faculty_organizer') {
      if (!roles.includes('faculty')) roles.push('faculty');
    }

    // Ensure admin role for specific email
    if (email === 'admin.avento@gmail.com' && !roles.includes('admin')) {
      roles = ['admin'];
    }

    let userRollNo = profileData.roll_number || null;

    req.user = {
      id: profileData.id || userId,
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
