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
        createdAt: user.created_at
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
        createdAt: user.createdAt
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

    await transporter.sendMail(mailOptions);

    res.json({ message: 'Your message has been sent successfully.' });
  } catch (err) {
    console.error('submitContactForm error:', err.message);
    res.status(500).json({ message: 'Server error sending message.', error: err.message });
  }
};
