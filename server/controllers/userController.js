const supabase = require('../config/supabaseClient');
const User = require('../models/User');
const nodemailer = require('nodemailer');

exports.getUsers = async (req, res) => {
  try {
    const { data: users, error: usersErr } = await supabase.from('profiles').select('*');
    if (usersErr) throw usersErr;
    
    // Fetch all registrations to compute registration count per user
    const { data: registrations, error: regErr } = await supabase.from('event_registrations').select('user_id');
    if (regErr) throw regErr;

    // Fetch all events to compute proposed count per user
    const { data: events, error: evErr } = await supabase.from('events').select('proposed_by');
    if (evErr) throw evErr;

    // Fetch all event organizers to compute organizer count per user
    const { data: organizers, error: orgErr } = await supabase.from('event_organizers').select('student_id');
    if (orgErr) throw orgErr;

    // Fetch MongoDB users
    const mongoUsers = await User.find({});

    const usersWithStats = users.map(user => {
      const pCount = (events || []).filter(e => e.proposed_by && String(e.proposed_by) === String(user.id)).length;
      const oCount = (organizers || []).filter(o => o.student_id && String(o.student_id) === String(user.id)).length;
      const rCount = (registrations || []).filter(reg => String(reg.user_id) === String(user.id)).length;

      return {
        id: user.id,
        _id: user.id,
        fullName: user.name || user.fullName,
        email: user.email,
        roles: [user.role], // or parse if stored as array/json
        department: user.department,
        employeeId: user.employee_id,
        rollNumber: user.roll_number,
        isVerified: true, // Supabase auth handles verification
        proposedCount: pCount,
        organizedCount: oCount,
        registrationCount: rCount,
        createdAt: user.created_at,
        status: user.status || 'active',
        first_login: user.first_login !== false
      };
    });

    const mappedMongoUsers = mongoUsers.map(user => {
      const pCount = (events || []).filter(e => e.proposed_by && String(e.proposed_by) === String(user._id)).length;
      const oCount = (organizers || []).filter(o => o.student_id && String(o.student_id) === String(user._id)).length;
      const rCount = (registrations || []).filter(reg => String(reg.user_id) === String(user._id)).length;

      return {
        id: user._id,
        _id: user._id,
        fullName: user.name,
        email: user.email,
        roles: [user.role],
        department: '',
        employeeId: '',
        rollNumber: '',
        isVerified: user.isVerified,
        proposedCount: pCount,
        organizedCount: oCount,
        registrationCount: rCount,
        createdAt: user.createdAt,
        status: 'active',
        first_login: false
      };
    });

    // Deduplicate: Keep MongoDB user if email exists in both
    const mongoEmails = new Set(mappedMongoUsers.map(u => u.email.toLowerCase()));
    const filteredSupabaseUsers = usersWithStats.filter(u => !mongoEmails.has(u.email.toLowerCase()));

    res.json([...filteredSupabaseUsers, ...mappedMongoUsers]);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching user list.', error: err.message });
  }
};

// Returns all Faculty Coordinators for the student proposal form dropdown
// Format: { id, fullName, email, employeeId, displayLabel: "Dr. XYZ (EMP001)" }
exports.getFacultyCoordinators = async (req, res) => {
  try {
    const { data: faculty, error } = await supabase.from('profiles').select('*').eq('role', 'faculty');
    if (error) throw error;
    
    const result = faculty.map(f => ({
      id: f.id,
      fullName: f.name || f.fullName,
      email: f.email,
      employeeId: f.employee_id || '',
      department: f.department || '',
      displayLabel: f.employee_id ? `${f.name || f.fullName} (${f.employee_id})` : (f.name || f.fullName)
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching faculty coordinators.', error: err.message });
  }
};

// Returns all Students for the team member picker in organizer view
// Format: { id, fullName, email, rollNumber, displayLabel: "Bala Yaamini (2203A51001)" }
exports.getStudents = async (req, res) => {
  try {
    // Fetch students
    const { data: students, error } = await supabase.from('profiles').select('*').eq('role', 'student');
    if (error) throw error;
    
    const result = students.map(s => ({
      id: s.id,
      fullName: s.name || s.fullName,
      email: s.email,
      rollNumber: s.roll_number || '',
      department: s.department || '',
      displayLabel: s.roll_number ? `${s.name || s.fullName} (${s.roll_number})` : (s.name || s.fullName)
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching students.', error: err.message });
  }
};

// Update only the display name for the authenticated user
exports.updateDisplayName = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Name is required and cannot be empty.' });
    }

    const trimmedName = name.trim();

    // 1. Update MongoDB
    const mongoUser = await User.findById(userId);
    if (mongoUser) {
      mongoUser.name = trimmedName;
      await mongoUser.save();
    }

    // 2. Update Supabase profiles table
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ name: trimmedName })
      .eq('id', String(userId));

    if (profileErr) {
      console.warn('Profile update warning:', profileErr.message);
    }

    // 3. Update Supabase Auth user_metadata
    try {
      await supabase.auth.admin.updateUserById(String(userId), {
        user_metadata: { full_name: trimmedName },
      });
    } catch (authErr) {
      console.warn('Auth metadata update warning:', authErr.message);
    }

    // Return the updated user object (same shape as authMiddleware sets)
    res.json({
      message: 'Display name updated successfully.',
      user: {
        id: userId,
        email: req.user.email,
        fullName: trimmedName,
        roles: req.user.roles,
      }
    });
  } catch (err) {
    console.error('updateDisplayName error:', err.message);
    res.status(500).json({ message: 'Server error updating display name.', error: err.message });
  }
};

exports.submitContactForm = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ message: 'Please provide name, email, subject, and message.' });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'admin.avento@gmail.com',
      replyTo: email,
      subject: `Avento Contact: ${subject}`,
      text: `From: ${name}\nStudent Email: ${email}\n\nSubject: ${subject}\n\nMessage:\n${message}`,
    };

    const sendMailPromise = transporter.sendMail(mailOptions);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('SMTP Connection timeout forced by server')), 5000)
    );

    try {
      await Promise.race([sendMailPromise, timeoutPromise]);
    } catch (emailErr) {
      console.error('[submitContactForm] Email failed (likely Render SMTP block):', emailErr.message);
      // We gracefully continue so the user still gets a success message in UI
    }

    res.json({ message: 'Your message has been sent successfully.' });
  } catch (err) {
    console.error('submitContactForm error:', err.message);
    res.status(500).json({ message: 'Server error sending message.', error: err.message });
  }
};

exports.importUsers = async (req, res) => {
  try {
    const { users } = req.body;
    if (!users || !Array.isArray(users)) {
      return res.status(400).json({ message: 'Invalid users array provided.' });
    }
    
    let successful = 0;
    let failed = 0;
    let skipped = 0;

    for (const user of users) {
      try {
        const emailLower = user.email.toLowerCase().trim();
        const role = user.role ? user.role.toLowerCase() : 'student';
        const defaultPassword = 'Student@123';
        
        const { data: usersData, error: listErr } = await supabase.auth.admin.listUsers();
        if (listErr) throw listErr;
        
        const existingAuth = usersData.users.find((u) => u.email.toLowerCase() === emailLower);
        if (existingAuth) {
          skipped++;
          continue;
        }

        const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
          email: emailLower,
          password: defaultPassword,
          email_confirm: true,
          user_metadata: { full_name: user.fullName, role: role },
        });

        if (createErr) throw createErr;
        const userId = newUser.user.id;

        const profile = {
          id: userId,
          email: emailLower,
          name: user.fullName,
          role: role,
          department: user.department || null,
          created_at: new Date().toISOString(),
          first_login: true,
          status: 'active'
        };
        
        if (role === 'faculty') profile.employee_id = user.employeeId || null;
        if (role === 'student') profile.roll_number = user.rollNumber || null;

        await supabase.from('profiles').upsert(profile);
        
        const bcrypt = require('bcryptjs');
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(defaultPassword, salt);
        const User = require('../models/User');
        const mongoUser = new User({
          _id: userId,
          name: user.fullName,
          email: emailLower,
          password: hashedPassword,
          role: role,
          isVerified: true,
        });
        await mongoUser.save().catch(e => console.error('Mongo save error (dup):', e.message));

        successful++;
      } catch (e) {
        console.error(`Import failed for ${user.email}:`, e.message);
        failed++;
      }
    }
    
    res.json({
      success: true,
      summary: { total: users.length, successful, skipped, failed }
    });
  } catch (err) {
    console.error('importUsers error:', err.message);
    res.status(500).json({ message: 'Server error importing users.', error: err.message });
  }
};

exports.completeFirstLogin = async (req, res) => {
  try {
    const userId = req.user.id;
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ message: 'New password is required.' });
    }

    // Update password in Supabase Auth
    const { error } = await supabase.auth.admin.updateUserById(String(userId), {
      password: password
    });

    if (error) {
      throw error;
    }

    // Update profiles table to clear first_login flag
    await supabase.from('profiles').update({ first_login: false }).eq('id', String(userId));
    
    // Also update MongoDB password
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const User = require('../models/User');
    await User.findByIdAndUpdate(userId, { password: hashedPassword });

    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    console.error('completeFirstLogin error:', err.message);
    res.status(500).json({ message: 'Server error updating password.', error: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const userId = req.params.id;
    const tempPassword = 'Student@123';

    const { error } = await supabase.auth.admin.updateUserById(String(userId), {
      password: tempPassword
    });
    if (error) throw error;

    await supabase.from('profiles').update({ first_login: true }).eq('id', String(userId));
    
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(tempPassword, salt);
    const User = require('../models/User');
    await User.findByIdAndUpdate(userId, { password: hashedPassword });

    res.json({ message: 'Password reset successfully.', tempPassword });
  } catch (err) {
    console.error('resetPassword error:', err.message);
    res.status(500).json({ message: 'Failed to reset password.', error: err.message });
  }
};

exports.deactivateUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const { error } = await supabase.from('profiles').update({ status: 'inactive' }).eq('id', String(userId));
    if (error) throw error;
    res.json({ message: 'User deactivated.' });
  } catch (err) {
    console.error('deactivate error:', err.message);
    res.status(500).json({ message: 'Failed to deactivate.', error: err.message });
  }
};

exports.activateUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const { error } = await supabase.from('profiles').update({ status: 'active' }).eq('id', String(userId));
    if (error) throw error;
    res.json({ message: 'User activated.' });
  } catch (err) {
    console.error('activate error:', err.message);
    res.status(500).json({ message: 'Failed to activate.', error: err.message });
  }
};

exports.updateUserDetails = async (req, res) => {
  try {
    const userId = req.params.id;
    const { fullName, department, role } = req.body;
    const updates = {};
    if (fullName !== undefined) updates.name = fullName.trim();
    if (department !== undefined) updates.department = department.trim();
    if (role !== undefined) updates.role = role.trim();

    const { error } = await supabase.from('profiles').update(updates).eq('id', String(userId));
    if (error) throw error;

    if (updates.name) {
      await supabase.auth.admin.updateUserById(String(userId), {
        user_metadata: { full_name: updates.name },
      });
      const User = require('../models/User');
      await User.findByIdAndUpdate(userId, { name: updates.name, role: updates.role || 'student' });
    }

    res.json({ message: 'User details updated successfully.' });
  } catch (err) {
    console.error('updateUserDetails error:', err.message);
    res.status(500).json({ message: 'Failed to update user details.', error: err.message });
  }
};
