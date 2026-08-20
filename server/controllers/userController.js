const supabase = require('../config/supabaseClient');
const User = require('../models/User');
const nodemailer = require('nodemailer');

exports.getUsers = async (req, res) => {
  try {
    // Paginate to fetch ALL profiles (Supabase default limit is 1000)
    let users = [];
    let page = 0;
    const PAGE_SIZE = 1000;
    while (true) {
      const { data, error } = await supabase.from('profiles').select('*').range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      users.push(...(data || []));
      if (!data || data.length < PAGE_SIZE) break;
      page++;
    }
    
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
      
      const supUser = usersWithStats.find(u => u.email.toLowerCase() === user.email.toLowerCase());

      return {
        id: user._id,
        _id: user._id,
        fullName: user.name,
        email: user.email,
        roles: [user.role],
        department: supUser ? supUser.department : '',
        employeeId: supUser ? supUser.employeeId : '',
        rollNumber: supUser ? supUser.rollNumber : '',
        isVerified: user.isVerified,
        proposedCount: pCount,
        organizedCount: oCount,
        registrationCount: rCount,
        createdAt: user.createdAt,
        status: supUser ? supUser.status : 'active',
        first_login: supUser ? supUser.first_login : false
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
    let faculty = [];
    let page = 0;
    const PAGE_SIZE = 1000;
    while (true) {
      const { data, error } = await supabase.from('profiles').select('*').eq('role', 'faculty').range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      faculty.push(...(data || []));
      if (!data || data.length < PAGE_SIZE) break;
      page++;
    }
    
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

exports.searchUsers = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.json([]);

    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, name, email, department, role, roll_number, employee_id, status')
      .or(`name.ilike.%${query}%,email.ilike.%${query}%,department.ilike.%${query}%`)
      .limit(20);
    
    if (error) throw error;
    // Exclude inactive users as requested
    const activeProfiles = (profiles || []).filter(p => p.status !== 'inactive');
    res.json(activeProfiles);
  } catch (err) {
    res.status(500).json({ message: 'Server error searching users.', error: err.message });
  }
};

// Returns all Students for the team member picker in organizer view
// Format: { id, fullName, email, rollNumber, displayLabel: "Bala Yaamini (2203A51001)" }
exports.getStudents = async (req, res) => {
  try {
    let students = [];
    let page = 0;
    const PAGE_SIZE = 1000;
    while (true) {
      const { data, error } = await supabase.from('profiles').select('*').eq('role', 'student').range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      students.push(...(data || []));
      if (!data || data.length < PAGE_SIZE) break;
      page++;
    }
    
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

    const { sendEmailNotification, sendInAppNotification } = require('../services/notificationService');

    // Automatically derive roll number from email prefix (everything before @)
    const studentRollNo = email.trim().split('@')[0];

    const adminEmail = process.env.ADMIN_EMAIL || process.env.BREVO_SENDER_EMAIL || 'admin.avento@gmail.com';
    const emailSubject = `[Avento Support Ticket] ${subject} - From ${name} (${studentRollNo})`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 24px; color: #1e293b; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        <div style="margin-bottom: 20px;">
          <span style="background-color: #f3e8ff; color: #7c3aed; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: bold; text-transform: uppercase;">Avento Contact Support</span>
        </div>
        <h2 style="color: #0f172a; margin: 0 0 16px 0; font-size: 22px;">New Support Ticket Message</h2>
        <div style="background-color: #f8fafc; padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
          <p style="margin: 0 0 8px 0; font-size: 14px;"><strong>Sender Name:</strong> ${name}</p>
          <p style="margin: 0 0 8px 0; font-size: 14px;"><strong>Email ID:</strong> <a href="mailto:${email}" style="color: #7c3aed;">${email}</a></p>
          <p style="margin: 0 0 8px 0; font-size: 14px;"><strong>Roll Number / ID:</strong> ${studentRollNo}</p>
          <p style="margin: 0; font-size: 14px;"><strong>Subject:</strong> ${subject}</p>
        </div>
        <div style="background-color: #ffffff; padding: 16px; border-radius: 12px; border-left: 4px solid #7c3aed; border-top: 1px solid #f1f5f9; border-right: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9;">
          <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b; font-weight: bold; text-transform: uppercase;">Message Content:</p>
          <p style="margin: 0; white-space: pre-wrap; font-size: 14px; line-height: 1.6; color: #334155;">${message}</p>
        </div>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;" />
        <p style="font-size: 12px; color: #94a3b8; margin: 0;">This email notification was sent to ${adminEmail} for the AVENTO support ticket system.</p>
      </div>
    `;

    const textContent = `New Contact Support Ticket:\n\nFrom: ${name}\nEmail: ${email}\nRoll Number: ${studentRollNo}\nSubject: ${subject}\n\nMessage:\n${message}`;

    // 1. Send via Brevo / Notification Service
    await sendEmailNotification({
      recipientEmail: adminEmail,
      subject: emailSubject,
      htmlBody: htmlContent
    });

    // 2. Also attempt Nodemailer fallback if EMAIL_USER and EMAIL_PASS are set
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: adminEmail,
          replyTo: email,
          subject: emailSubject,
          text: textContent,
          html: htmlContent,
        });
      } catch (nodemailerErr) {
        console.warn('[submitContactForm] Nodemailer send failed:', nodemailerErr.message);
      }
    }

    // 3. Notify Admin in-app if admin profiles exist
    try {
      const { data: adminProfiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin');

      if (adminProfiles && adminProfiles.length > 0) {
        for (const admin of adminProfiles) {
          await sendInAppNotification({
            recipientId: admin.id,
            title: `Support Ticket: ${subject}`,
            message: `New message from ${name} (${studentRollNo !== 'N/A' ? studentRollNo : email}): "${message.slice(0, 100)}${message.length > 100 ? '...' : ''}"`,
            type: 'info'
          });
        }
      }
    } catch (inAppErr) {
      console.warn('[submitContactForm] In-app admin notification error:', inAppErr.message);
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
    const errors = [];

    const studentDomains = ['@cse.suh.edu.in', '@aiml.suh.edu.in', '@sap.suh.edu.in', '@ds.suh.edu.in', '@cs.suh.edu.in'];
    const facultyDomain = '@suh.edu.in';

    for (const user of users) {
      try {
        const emailLower = user.email.toLowerCase().trim();
        
        let role = user.role;
        if (!role) {
          if (studentDomains.some(domain => emailLower.endsWith(domain))) {
            role = 'student';
          } else if (emailLower.endsWith(facultyDomain)) {
            role = 'faculty';
          }
        }

        if (!role) {
          failed++;
          errors.push({ email: emailLower, reason: 'Unsupported domain' });
          continue;
        }

        let defaultPassword = 'Student@123';
        if (role === 'faculty' || role === 'faculty_organizer') {
          defaultPassword = 'Faculty@123';
        } else if (role === 'student' || role === 'student_organizer') {
          defaultPassword = 'Student@123';
        }
        
        let derivedDepartment = user.department || null;
        let derivedRollNumber = user.rollNumber || null;

        if (role === 'student' || role === 'student_organizer') {
          if (!derivedRollNumber && emailLower.includes('@')) {
            derivedRollNumber = emailLower.split('@')[0].trim();
          }

          if (!derivedDepartment) {
            if (emailLower.endsWith('@cse.suh.edu.in')) derivedDepartment = 'CSE';
            else if (emailLower.endsWith('@aiml.suh.edu.in')) derivedDepartment = 'AIML';
            else if (emailLower.endsWith('@sap.suh.edu.in')) derivedDepartment = 'SAP';
            else if (emailLower.endsWith('@cs.suh.edu.in')) derivedDepartment = 'CS';
            else if (emailLower.endsWith('@ds.suh.edu.in')) derivedDepartment = 'DS';
          }
        }
        
        const { data: usersData, error: listErr } = await supabase.auth.admin.listUsers();
        if (listErr) throw listErr;
        
        const existingAuth = usersData.users.find((u) => u.email.toLowerCase() === emailLower);
        if (existingAuth) {
          skipped++;
          errors.push({ email: emailLower, reason: 'User already exists (skipped)' });
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
          department: derivedDepartment,
          created_at: new Date().toISOString(),
          first_login: true,
          status: 'active'
        };
        
        if (role === 'faculty') profile.employee_id = user.employeeId || null;
        if (role === 'student' || role === 'student_organizer') profile.roll_number = derivedRollNumber;

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
        errors.push({ 
          email: user.email ? user.email.toLowerCase().trim() : 'Unknown', 
          reason: e.message 
        });
      }
    }
    
    res.json({
      success: true,
      summary: { total: users.length, successful, skipped, failed },
      errors
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
    const User = require('../models/User');
    const userRecord = await User.findById(userId);

    if (!userRecord) {
      return res.status(404).json({ message: 'User not found' });
    }

    let tempPassword = 'Student@123';
    if (userRecord.role === 'faculty' || userRecord.role === 'faculty_organizer') {
      tempPassword = 'Faculty@123';
    } else if (userRecord.role === 'admin') {
      tempPassword = 'Admin@123';
    }

    const { error } = await supabase.auth.admin.updateUserById(String(userId), {
      password: tempPassword
    });
    if (error) throw error;

    await supabase.from('profiles').update({ first_login: true }).eq('id', String(userId));
    
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(tempPassword, salt);
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
    
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', String(userId)).single();
    if (profile && profile.role === 'admin') {
      return res.status(403).json({ message: 'Action restricted: Cannot deactivate an administrator account.' });
    }

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
    
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', String(userId)).single();
    if (profile && profile.role === 'admin') {
      return res.status(403).json({ message: 'Action restricted: Cannot modify administrator account status.' });
    }

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
    const { fullName, department } = req.body;
    const updates = {};
    if (fullName !== undefined) updates.name = fullName.trim();
    if (department !== undefined) updates.department = department.trim();

    const { error } = await supabase.from('profiles').update(updates).eq('id', String(userId));
    if (error) throw error;

    if (updates.name) {
      await supabase.auth.admin.updateUserById(String(userId), {
        user_metadata: { full_name: updates.name },
      });
      const User = require('../models/User');
      // Only update name in MongoDB. Role is immutable.
      await User.findByIdAndUpdate(userId, { name: updates.name });
    }

    res.json({ message: 'User details updated successfully.' });
  } catch (err) {
    console.error('updateUserDetails error:', err.message);
    res.status(500).json({ message: 'Failed to update user details.', error: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Protect Admin Accounts
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', String(userId)).single();
    if (profile && profile.role === 'admin') {
      return res.status(403).json({ message: 'Action restricted: Cannot delete an administrator account.' });
    }
    
    // Delete from Supabase Auth (this usually cascades to profiles)
    const { error: authErr } = await supabase.auth.admin.deleteUser(String(userId));
    if (authErr) {
      console.warn('Supabase Auth delete warning:', authErr.message);
    }
    
    // Explicitly delete from profiles just in case
    await supabase.from('profiles').delete().eq('id', String(userId));
    
    // Delete from MongoDB
    const User = require('../models/User');
    await User.findByIdAndDelete(userId);
    
    res.json({ message: 'User deleted successfully.' });
  } catch (err) {
    console.error('deleteUser error:', err.message);
    res.status(500).json({ message: 'Failed to delete user.', error: err.message });
  }
};

exports.bulkDeleteUsers = async (req, res) => {
  try {
    const { userIds } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'No user IDs provided for bulk deletion.' });
    }

    // Fetch target profiles to strictly protect Admin accounts
    const { data: targetProfiles, error: profErr } = await supabase
      .from('profiles')
      .select('id, role')
      .in('id', userIds.map(String));

    if (profErr) throw profErr;

    // Filter out any admin accounts
    const eligibleUserIds = (targetProfiles || [])
      .filter(p => p.role !== 'admin')
      .map(p => p.id);

    if (eligibleUserIds.length === 0) {
      return res.status(400).json({ message: 'No eligible non-admin users found for deletion.' });
    }

    const User = require('../models/User');
    let deletedCount = 0;

    for (const uId of eligibleUserIds) {
      const idStr = String(uId);

      // Supabase Auth deletion
      try {
        await supabase.auth.admin.deleteUser(idStr);
      } catch (authErr) {
        console.warn(`Supabase Auth bulk delete warning for ${idStr}:`, authErr.message);
      }

      // Supabase profiles deletion
      await supabase.from('profiles').delete().eq('id', idStr);

      // MongoDB deletion
      try {
        await User.findByIdAndDelete(idStr);
      } catch (mongoErr) {
        console.warn(`MongoDB bulk delete warning for ${idStr}:`, mongoErr.message);
      }

      deletedCount++;
    }

    res.json({
      message: `Successfully deleted ${deletedCount} user account(s). Admin accounts remain completely protected.`,
      deletedCount
    });
  } catch (err) {
    console.error('bulkDeleteUsers error:', err.message);
    res.status(500).json({ message: 'Failed to perform bulk user deletion.', error: err.message });
  }
};
