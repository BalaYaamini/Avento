const supabase = require('../config/supabaseClient');
const nodemailer = require('nodemailer');

exports.getUsers = async (req, res) => {
  try {
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

    const { data: registrations, error: regErr } = await supabase.from('event_registrations').select('user_id');
    if (regErr) throw regErr;

    const { data: events, error: evErr } = await supabase.from('events').select('proposed_by');
    if (evErr) throw evErr;

    const { data: organizers, error: orgErr } = await supabase.from('event_organizers').select('student_id');
    if (orgErr) throw orgErr;

    const usersWithStats = users.map(user => {
      const pCount = (events || []).filter(e => e.proposed_by && String(e.proposed_by) === String(user.id)).length;
      const oCount = (organizers || []).filter(o => o.student_id && String(o.student_id) === String(user.id)).length;
      const rCount = (registrations || []).filter(reg => String(reg.user_id) === String(user.id)).length;

      return {
        id: user.id,
        _id: user.id,
        fullName: user.name || user.fullName,
        email: user.email,
        roles: [user.role],
        department: user.department,
        employeeId: user.employee_id,
        rollNumber: user.roll_number,
        isVerified: true,
        proposedCount: pCount,
        organizedCount: oCount,
        registrationCount: rCount,
        createdAt: user.created_at,
        status: user.status || 'active',
        first_login: user.first_login !== false,
        registrationMethod: user.registration_method || 'imported',
      };
    });

    res.json(usersWithStats);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching user list.', error: err.message });
  }
};

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
    const activeProfiles = (profiles || []).filter(p => p.status !== 'inactive');
    res.json(activeProfiles);
  } catch (err) {
    res.status(500).json({ message: 'Server error searching users.', error: err.message });
  }
};

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

// Update profile details for the authenticated user
exports.updateProfileDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, phone, gender, degreeProgram, yearOfStudy, collegeName, rollNumber, department } = req.body;

    // ── 1. Display Name Validation ──
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Display Name is required.' });
    }
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 80) {
      return res.status(400).json({ message: 'Display Name must be between 2 and 80 characters long.' });
    }
    if (/<[^>]*>|http:\/\/|https:\/\/|www\.|&[a-z0-9]+;/i.test(trimmedName)) {
      return res.status(400).json({ message: 'Display Name cannot contain links or HTML tags.' });
    }
    if (!/^[a-zA-Z\u00C0-\u024F\s\.\'\-]+$/.test(trimmedName)) {
      return res.status(400).json({ message: 'Display Name can only contain letters, spaces, initials, hyphens (-), and apostrophes (\').' });
    }

    // ── 2. Institution / College Name Validation ──
    if (!collegeName || !collegeName.trim()) {
      return res.status(400).json({ message: 'Institution / College Name is required.' });
    }
    const trimmedCollege = collegeName.trim();
    if (trimmedCollege.length < 2 || trimmedCollege.length > 150) {
      return res.status(400).json({ message: 'Institution name must be between 2 and 150 characters long.' });
    }
    if (!/[a-zA-Z\u00C0-\u024F]/.test(trimmedCollege)) {
      return res.status(400).json({ message: 'Institution name must contain letters and cannot consist only of numbers or special characters.' });
    }

    // ── 3. Roll Number Validation ──
    const isStudent = req.user?.roles?.includes('student');
    let finalRollNumber = null;
    if (rollNumber !== undefined && rollNumber !== null) {
      const trimmedRoll = rollNumber.trim();
      if (isStudent && !trimmedRoll) {
        return res.status(400).json({ message: 'College Roll Number is required for students.' });
      }
      if (trimmedRoll) {
        if (!/^[a-zA-Z0-9\-\/]+$/.test(trimmedRoll)) {
          return res.status(400).json({ message: 'Roll Number can only contain letters, numbers, hyphens (-), and slashes (/).' });
        }
        finalRollNumber = trimmedRoll.toUpperCase();
      }
    } else if (isStudent) {
      return res.status(400).json({ message: 'College Roll Number is required for students.' });
    }

    // ── 4. Phone Validation ──
    let cleanPhone = null;
    if (phone !== undefined && phone !== null && phone !== '') {
      const cleaned = phone.replace(/[\s\-\(\)]/g, '').replace(/^(\+91|91|0)/, '');
      if (!/^[6-9]\d{9}$/.test(cleaned)) {
        return res.status(400).json({ message: 'Please enter a valid 10-digit Indian mobile number.' });
      }
      cleanPhone = cleaned;
    }

    // Build Supabase profile update object
    const profileUpdate = {
      name: trimmedName,
      college_name: trimmedCollege,
    };
    if (phone !== undefined) profileUpdate.phone = cleanPhone;
    if (gender !== undefined) profileUpdate.gender = gender || null;
    if (degreeProgram !== undefined) profileUpdate.degree_program = degreeProgram ? degreeProgram.trim() : null;
    if (yearOfStudy !== undefined) profileUpdate.year_of_study = yearOfStudy || null;
    if (rollNumber !== undefined) profileUpdate.roll_number = finalRollNumber;
    if (department !== undefined) profileUpdate.department = department ? department.trim() : null;

    // 1. Update Supabase profiles table (by ID, fallback to Email)
    const { error: profileErr } = await supabase
      .from('profiles')
      .update(profileUpdate)
      .eq('id', String(userId));

    if (profileErr && req.user?.email) {
      await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('email', String(req.user.email).toLowerCase());
    }

    // 3. Update Supabase Auth user_metadata
    try {
      await supabase.auth.admin.updateUserById(String(userId), {
        user_metadata: { full_name: trimmedName },
      });
    } catch (authErr) {
      console.warn('Auth metadata update warning:', authErr.message);
    }

    // Return updated user object
    res.json({
      message: 'Profile updated successfully.',
      user: {
        id: userId,
        email: req.user.email,
        fullName: trimmedName,
        roles: req.user.roles,
        phone: profileUpdate.phone !== undefined ? profileUpdate.phone : req.user.phone,
        gender: profileUpdate.gender !== undefined ? profileUpdate.gender : req.user.gender,
        degreeProgram: profileUpdate.degree_program !== undefined ? profileUpdate.degree_program : req.user.degreeProgram,
        yearOfStudy: profileUpdate.year_of_study !== undefined ? profileUpdate.year_of_study : req.user.yearOfStudy,
        collegeName: profileUpdate.college_name !== undefined ? profileUpdate.college_name : req.user.collegeName,
        rollNumber: profileUpdate.roll_number !== undefined ? profileUpdate.roll_number : req.user.rollNumber,
        department: profileUpdate.department !== undefined ? profileUpdate.department : req.user.department,
      }
    });
  } catch (err) {
    console.error('updateProfileDetails error:', err.message);
    res.status(500).json({ message: 'Server error updating profile.', error: err.message });
  }
};

exports.updateDisplayName = exports.updateProfileDetails;

// Upload profile photo for the authenticated user
// Pipeline: validate magic bytes → correct orientation → convert to JPEG → resize 1200×1200 → compress 82%
exports.uploadProfilePhoto = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ message: 'No photo file provided.' });
    }

    const file = req.file;

    // 5 MB limit
    if (file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ message: 'File too large. Maximum size is 5 MB.' });
    }

    // ── Step 1: Validate actual file type using magic bytes ──
    // file-type v20+ is ESM-only, so we use dynamic import
    const { fileTypeFromBuffer } = await import('file-type');
    const detectedType = await fileTypeFromBuffer(file.buffer);

    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/webp',
      'image/heic', 'image/heif'
    ];
    // Also accept by extension for HEIC/HEIF files that may not be detected by magic bytes
    const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];
    const fileExt = (file.originalname || '').split('.').pop().toLowerCase();

    const mimeOk = detectedType && allowedMimes.includes(detectedType.mime);
    const extOk = allowedExts.includes(fileExt);

    if (!mimeOk && !extOk) {
      return res.status(400).json({
        message: 'Invalid file type. Only JPG, JPEG, PNG, WebP, HEIC, and HEIF images are accepted.'
      });
    }

    // ── Step 2: Process image with sharp ──
    // - Auto-rotate using EXIF orientation
    // - Convert HEIC/HEIF/PNG/WebP → JPEG
    // - Resize to fit within 1200×1200 (maintain aspect ratio)
    // - Compress at 82% JPEG quality
    const sharp = require('sharp');

    let processedBuffer;
    try {
      processedBuffer = await sharp(file.buffer)
        .rotate()                          // Auto-correct EXIF orientation
        .resize(1200, 1200, {
          fit: 'inside',                   // Fit within 1200×1200, maintain aspect ratio
          withoutEnlargement: true         // Don't upscale smaller images
        })
        .jpeg({ quality: 82, mozjpeg: true }) // Convert to JPEG, 82% quality, mozjpeg for better compression
        .toBuffer();
    } catch (sharpErr) {
      console.error('Sharp processing error:', sharpErr.message);
      return res.status(400).json({
        message: 'Failed to process image. Please ensure the file is a valid image.'
      });
    }

    // ── Step 3: Upload processed image to Supabase Storage ──
    const storagePath = `avatars/${userId}_${Date.now()}.jpg`;
    let photoUrl = null;

    try {
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(storagePath, processedBuffer, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (uploadErr) {
        console.warn('Storage upload warning, using data URI fallback:', uploadErr.message);
        const base64 = processedBuffer.toString('base64');
        photoUrl = `data:image/jpeg;base64,${base64}`;
      } else {
        const { data: publicUrlData } = supabase.storage.from('documents').getPublicUrl(storagePath);
        photoUrl = publicUrlData.publicUrl;
      }
    } catch (storageErr) {
      console.warn('Storage upload exception, using data URI fallback:', storageErr.message);
      const base64 = processedBuffer.toString('base64');
      photoUrl = `data:image/jpeg;base64,${base64}`;
    }

    // ── Step 4: Update avatar_url in Supabase profiles table ──
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ avatar_url: photoUrl })
      .eq('id', String(userId));

    if (profileErr && req.user?.email) {
      await supabase
        .from('profiles')
        .update({ avatar_url: photoUrl })
        .eq('email', String(req.user.email).toLowerCase());
    }

    res.json({
      message: 'Profile photo updated successfully.',
      avatarUrl: photoUrl
    });
  } catch (err) {
    console.error('uploadProfilePhoto error:', err.message);
    res.status(500).json({ message: 'Server error uploading profile photo.', error: err.message });
  }
};

exports.submitContactForm = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ message: 'Please provide name, email, subject, and message.' });
    }

    const { sendEmailNotification, sendInAppNotification } = require('../services/notificationService');

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

    await sendEmailNotification({
      recipientEmail: adminEmail,
      subject: emailSubject,
      htmlBody: htmlContent
    });

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
          // Do not auto-fill roll number from email
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
          status: 'active',
          registration_method: 'imported',
        };

        if (role === 'faculty') profile.employee_id = user.employeeId || null;
        if (role === 'student' || role === 'student_organizer') profile.roll_number = derivedRollNumber;

        await supabase.from('profiles').upsert(profile);

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

    const { error } = await supabase.auth.admin.updateUserById(String(userId), {
      password: password
    });

    if (error) {
      throw error;
    }

    await supabase.from('profiles').update({ first_login: false }).eq('id', String(userId));

    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    console.error('completeFirstLogin error:', err.message);
    res.status(500).json({ message: 'Server error updating password.', error: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const userId = req.params.id;

    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', String(userId))
      .single();

    if (profErr || !profile) {
      return res.status(404).json({ message: 'User not found' });
    }

    let tempPassword = 'Student@123';
    if (profile.role === 'faculty' || profile.role === 'faculty_organizer') {
      tempPassword = 'Faculty@123';
    } else if (profile.role === 'admin') {
      tempPassword = 'Admin@123';
    }

    const { error } = await supabase.auth.admin.updateUserById(String(userId), {
      password: tempPassword
    });
    if (error) throw error;

    await supabase.from('profiles').update({ first_login: true }).eq('id', String(userId));

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

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', String(userId)).single();
    if (profile && profile.role === 'admin') {
      return res.status(403).json({ message: 'Action restricted: Cannot delete an administrator account.' });
    }

    // Clean up related records first (avoid FK constraint errors)
    await supabase.from('event_registrations').delete().eq('user_id', String(userId));
    await supabase.from('team_email_invites').delete().eq('invited_by', String(userId));
    await supabase.from('team_email_invites').delete().eq('email', profile?.email || '');

    // Delete from Supabase Auth
    const { error: authErr } = await supabase.auth.admin.deleteUser(String(userId));
    if (authErr) {
      console.warn('Supabase Auth delete warning:', authErr.message);
    }

    // Delete profile
    const { error: profileErr } = await supabase.from('profiles').delete().eq('id', String(userId));
    if (profileErr) {
      console.error('Profile delete error:', profileErr.message);
      return res.status(500).json({ message: 'Failed to delete user profile.', error: profileErr.message });
    }

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

    const { data: targetProfiles, error: profErr } = await supabase
      .from('profiles')
      .select('id, role')
      .in('id', userIds.map(String));

    if (profErr) throw profErr;

    const eligibleUserIds = (targetProfiles || [])
      .filter(p => p.role !== 'admin')
      .map(p => p.id);

    if (eligibleUserIds.length === 0) {
      return res.status(400).json({ message: 'No eligible non-admin users found for deletion.' });
    }

    let deletedCount = 0;

    for (const uId of eligibleUserIds) {
      const idStr = String(uId);

      // Clean up related records first
      await supabase.from('event_registrations').delete().eq('user_id', idStr);
      await supabase.from('team_email_invites').delete().eq('invited_by', idStr);
      const { data: p } = await supabase.from('profiles').select('email').eq('id', idStr).single();
      if (p?.email) {
        await supabase.from('team_email_invites').delete().eq('email', p.email);
      }

      try {
        await supabase.auth.admin.deleteUser(idStr);
      } catch (authErr) {
        console.warn(`Supabase Auth bulk delete warning for ${idStr}:`, authErr.message);
      }

      const { error: delErr } = await supabase.from('profiles').delete().eq('id', idStr);
      if (delErr) {
        console.error(`Profile bulk delete error for ${idStr}:`, delErr.message);
        continue;
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

// ─── UPDATE FULL PROFILE (photo, phone, college, gender) ──────────────────
exports.updateFullProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { phone, college, gender, avatar_url } = req.body;

    const updates = {};
    if (phone !== undefined) updates.phone = phone;
    if (college !== undefined) updates.college = college;
    if (gender !== undefined) updates.gender = gender;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No fields to update.' });
    }

    const { error } = await supabase.from('profiles').update(updates).eq('id', String(userId));
    if (error) throw error;

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, email, phone, college, gender, avatar_url, role')
      .eq('id', String(userId))
      .single();

    res.json({
      message: 'Profile updated successfully.',
      user: {
        id: profile.id,
        fullName: profile.name,
        email: profile.email,
        phone: profile.phone,
        college: profile.college,
        gender: profile.gender,
        avatarUrl: profile.avatar_url,
        roles: [profile.role],
      }
    });
  } catch (err) {
    console.error('updateFullProfile error:', err.message);
    res.status(500).json({ message: 'Failed to update profile.', error: err.message });
  }
};

// ─── GET FULL PROFILE ─────────────────────────────────────────────────────
exports.getFullProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, name, email, phone, college, gender, avatar_url, role, department, roll_number')
      .eq('id', String(userId))
      .single();

    if (error || !profile) {
      return res.status(404).json({ message: 'Profile not found.' });
    }

    res.json({
      id: profile.id,
      fullName: profile.name,
      email: profile.email,
      phone: profile.phone,
      college: profile.college,
      gender: profile.gender,
      avatarUrl: profile.avatar_url,
      roles: [profile.role],
      department: profile.department,
      rollNumber: profile.roll_number,
    });
  } catch (err) {
    console.error('getFullProfile error:', err.message);
    res.status(500).json({ message: 'Failed to fetch profile.', error: err.message });
  }
};
