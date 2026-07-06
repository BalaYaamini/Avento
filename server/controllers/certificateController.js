const supabase = require('../config/supabaseClient');
const { notifyUser } = require('../services/notificationService');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

// Helper to get font size
const getFontSize = (size) => size || 24;

// Helper to generate a unique certificate ID
const generateCertId = () => {
  const year = new Date().getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `CERT-${year}-${random}`;
};

// 1. Upload Template
exports.uploadTemplate = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ message: 'No template file uploaded.' });
    }

    // Verify user is allowed (Faculty or Student Organizer of this event)
    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventErr || !event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    const isAuthorized = 
      req.user.roles.includes('admin') ||
      event.faculty_id === userId ||
      event.organizer_id === userId ||
      event.student_organizer_id === userId ||
      event.proposed_by === userId;

    if (!isAuthorized) {
      return res.status(403).json({ message: 'Not authorized to upload template for this event.' });
    }

    const templatePath = `/uploads/templates/${req.file.filename}`;
    
    // Default config (A4 Landscape roughly: 842 x 595)
    const defaultConfig = {
      STUDENT_NAME: { x: 421, y: 300, fontSize: 36, fontFamily: 'Helvetica', align: 'center', color: '#000000' },
      EVENT_NAME: { x: 421, y: 380, fontSize: 24, fontFamily: 'Helvetica', align: 'center', color: '#000000' },
      EVENT_DATE: { x: 421, y: 420, fontSize: 18, fontFamily: 'Helvetica', align: 'center', color: '#000000' },
      ISSUE_DATE: { x: 150, y: 500, fontSize: 16, fontFamily: 'Helvetica', align: 'left', color: '#000000' },
      CERTIFICATE_ID: { x: 150, y: 530, fontSize: 12, fontFamily: 'Helvetica', align: 'left', color: '#000000' }
    };

    const { error: updateErr } = await supabase
      .from('events')
      .update({
        certificate_template: templatePath,
        certificate_template_uploaded_by: userId,
        certificate_template_uploaded_at: new Date().toISOString(),
        certificate_fields_config: defaultConfig
      })
      .eq('id', eventId);

    if (updateErr) throw updateErr;

    res.status(200).json({ message: 'Template uploaded successfully', templatePath });
  } catch (err) {
    res.status(500).json({ message: 'Server error uploading template.', error: err.message });
  }
};

// 1.5 Get Template Config
exports.getTemplateConfig = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('certificate_template, certificate_fields_config')
      .eq('id', eventId)
      .single();

    if (eventErr || !event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    res.status(200).json({ 
      template: event.certificate_template, 
      config: event.certificate_fields_config 
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching config.', error: err.message });
  }
};

// 1.6 Save Template Config
exports.saveTemplateConfig = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.id;
    const { config } = req.body;

    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('faculty_id, organizer_id, student_organizer_id, proposed_by')
      .eq('id', eventId)
      .single();

    if (eventErr || !event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    const isAuthorized = 
      req.user.roles.includes('admin') ||
      event.faculty_id === userId ||
      event.organizer_id === userId ||
      event.student_organizer_id === userId ||
      event.proposed_by === userId;

    if (!isAuthorized) {
      return res.status(403).json({ message: 'Not authorized to save config for this event.' });
    }

    const { error: updateErr } = await supabase
      .from('events')
      .update({ certificate_fields_config: config })
      .eq('id', eventId);

    if (updateErr) throw updateErr;

    res.status(200).json({ message: 'Configuration saved successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error saving config.', error: err.message });
  }
};

// Internal function to generate PDF
const createPdfCertificate = async (event, student, certId) => {
  const templatePathLocal = path.join(__dirname, '..', event.certificate_template);
  if (!fs.existsSync(templatePathLocal)) {
    throw new Error('Template file not found on server.');
  }

  const ext = path.extname(templatePathLocal).toLowerCase();
  const fileBytes = fs.readFileSync(templatePathLocal);
  let pdfDoc;

  if (ext === '.pdf') {
    pdfDoc = await PDFDocument.load(fileBytes);
  } else {
    pdfDoc = await PDFDocument.create();
    let image;
    if (ext === '.png') {
      image = await pdfDoc.embedPng(fileBytes);
    } else if (ext === '.jpg' || ext === '.jpeg') {
      image = await pdfDoc.embedJpg(fileBytes);
    }
    const { width, height } = image.scale(1);
    const page = pdfDoc.addPage([width, height]);
    page.drawImage(image, { x: 0, y: 0, width, height });
  }

  const pages = pdfDoc.getPages();
  const firstPage = pages[0];
  const { width, height } = firstPage.getSize();
  
  const fonts = {
    Helvetica: await pdfDoc.embedFont(StandardFonts.Helvetica),
    'Times New Roman': await pdfDoc.embedFont(StandardFonts.TimesRoman),
    Courier: await pdfDoc.embedFont(StandardFonts.Courier)
  };

  let config = event.certificate_fields_config;
  // Handle old config format if present
  if (config && config.name) {
    config = {
      STUDENT_NAME: { x: config.name.x, y: height - config.name.y, fontSize: config.name.size, align: config.name.align, color: '#000000', fontFamily: 'Helvetica' },
      EVENT_NAME: { x: config.event.x, y: height - config.event.y, fontSize: config.event.size, align: config.event.align, color: '#000000', fontFamily: 'Helvetica' },
      EVENT_DATE: { x: config.date.x, y: height - config.date.y, fontSize: config.date.size, align: config.date.align, color: '#000000', fontFamily: 'Helvetica' },
      CERTIFICATE_ID: { x: config.certId.x, y: height - config.certId.y, fontSize: config.certId.size, align: config.certId.align, color: '#000000', fontFamily: 'Helvetica' }
    };
  } else if (!config) {
    config = {
      STUDENT_NAME: { x: width/2, y: 300, fontSize: 36, fontFamily: 'Helvetica', align: 'center', color: '#000000' },
      EVENT_NAME: { x: width/2, y: 380, fontSize: 24, fontFamily: 'Helvetica', align: 'center', color: '#000000' },
      EVENT_DATE: { x: width/2, y: 420, fontSize: 18, fontFamily: 'Helvetica', align: 'center', color: '#000000' },
      ISSUE_DATE: { x: 150, y: 500, fontSize: 16, fontFamily: 'Helvetica', align: 'left', color: '#000000' },
      CERTIFICATE_ID: { x: 150, y: 530, fontSize: 12, fontFamily: 'Helvetica', align: 'left', color: '#000000' }
    };
  }

  const hexToRgb = (hex) => {
    if (!hex) return [0,0,0];
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255
    ] : [0,0,0];
  };

  const drawText = (text, fieldKey) => {
    const fieldConfig = config[fieldKey];
    if (!text || !fieldConfig) return;
    
    const size = fieldConfig.fontSize || 24;
    const usedFont = fonts[fieldConfig.fontFamily] || fonts.Helvetica;
    const textWidth = usedFont.widthOfTextAtSize(text, size);
    
    let x = fieldConfig.x;
    if (fieldConfig.align === 'center') {
      x = x - (textWidth / 2);
    } else if (fieldConfig.align === 'right') {
      x = x - textWidth;
    }
    
    // Invert Y coordinate because pdf-lib is bottom-left (0,0) but visual editor is top-left
    const y = height - fieldConfig.y;
    
    const colorArr = hexToRgb(fieldConfig.color);
    
    firstPage.drawText(text, {
      x,
      y,
      size,
      font: usedFont,
      color: rgb(colorArr[0], colorArr[1], colorArr[2])
    });
  };

  drawText(student.name, 'STUDENT_NAME');
  drawText(event.title, 'EVENT_NAME');
  drawText(new Date(event.date).toLocaleDateString(), 'EVENT_DATE');
  drawText(new Date().toLocaleDateString(), 'ISSUE_DATE');
  drawText(certId, 'CERTIFICATE_ID');

  const pdfBytes = await pdfDoc.save();
  const certFileName = `certificate-${certId}.pdf`;
  const certPathLocal = path.join(__dirname, '../uploads/certificates', certFileName);
  fs.writeFileSync(certPathLocal, pdfBytes);

  return `/uploads/certificates/${certFileName}`;
};

// 2. Generate Certificates (Bulk)
exports.generateAllCertificates = async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const { data: event } = await supabase.from('events').select('*').eq('id', eventId).single();
    if (!event || event.status !== 'completed') {
      return res.status(400).json({ message: 'Event not found or not completed.' });
    }
    if (!event.certificate_template) {
      return res.status(400).json({ message: 'No certificate template uploaded for this event.' });
    }

    // Get all approved/registered participants
    const { data: registrations } = await supabase
      .from('event_registrations')
      .select('user_id, status')
      .eq('event_id', eventId);

    const eligibleUserIds = registrations
      .filter(r => r.status === 'approved' || r.status === 'registered' || r.status === 'attended') // depending on flow
      .map(r => r.user_id);

    if (eligibleUserIds.length === 0) {
      return res.status(400).json({ message: 'No eligible participants found.' });
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', eligibleUserIds);

    let generatedCount = 0;

    for (const profile of profiles) {
      // Check if already generated
      const { data: existing } = await supabase
        .from('certificates')
        .select('*')
        .eq('event_id', eventId)
        .eq('user_id', profile.id)
        .maybeSingle();

      if (!existing) {
        const certId = generateCertId();
        const certUrl = await createPdfCertificate(event, profile, certId);

        await supabase.from('certificates').insert({
          event_id: eventId,
          user_id: profile.id,
          certificate_id: certId,
          certificate_url: certUrl
        });
        generatedCount++;

        // Notify user about certificate
        try {
          await notifyUser({
            recipientId: profile.id,
            title: 'Certificate Available',
            message: `Your certificate for "${event.title}" is ready for download.`,
            type: 'success',
            eventId: event.id,
            emailSubject: 'Your Certificate is Ready',
            emailData: {
              eventName: event.title,
              publishDate: new Date().toLocaleDateString(),
              status: 'Published',
              instructions: "Please log into AVENTO and navigate to the Certificates dashboard to download your verified certificate."
            }
          });
        } catch (notifErr) {
          console.error('Non-fatal error sending certificate notification:', notifErr.message);
        }
      }
    }

    res.json({ message: `Successfully generated ${generatedCount} certificates.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error generating certificates.', error: err.message });
  }
};

// 3. Generate Certificate (Single)
exports.generateSingleCertificate = async (req, res) => {
  try {
    const { eventId, userId } = req.params;
    
    const { data: event } = await supabase.from('events').select('*').eq('id', eventId).single();
    if (!event || event.status !== 'completed') {
      return res.status(400).json({ message: 'Event not found or not completed.' });
    }
    if (!event.certificate_template) {
      return res.status(400).json({ message: 'No certificate template uploaded.' });
    }

    // Check if already generated
    const { data: existing } = await supabase
      .from('certificates')
      .select('*')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      return res.json({ message: 'Certificate already exists.', certificate: existing });
    }

    const { data: profile } = await supabase.from('profiles').select('id, name').eq('id', userId).single();
    if (!profile) return res.status(404).json({ message: 'User not found.' });

    const certId = generateCertId();
    const certUrl = await createPdfCertificate(event, profile, certId);

    const { data: newCert, error: insertErr } = await supabase.from('certificates').insert({
      event_id: eventId,
      user_id: userId,
      certificate_id: certId,
      certificate_url: certUrl
    }).select().single();

    if (insertErr) throw insertErr;

    // Notify user about certificate
    try {
      await notifyUser({
        recipientId: userId,
        title: 'Certificate Available',
        message: `Your certificate for "${event.title}" is ready for download.`,
        type: 'success',
        eventId: event.id,
        emailSubject: 'Your Certificate is Ready',
        emailData: {
          eventName: event.title,
          publishDate: new Date().toLocaleDateString(),
          status: 'Published',
          instructions: "Please log into AVENTO and navigate to the Certificates dashboard to download your verified certificate."
        }
      });
    } catch (notifErr) {
      console.error('Non-fatal error sending certificate notification:', notifErr.message);
    }

    res.json({ message: 'Certificate generated successfully.', certificate: newCert });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error generating certificate.', error: err.message });
  }
};

// 4. Generate TEST Certificate (Preview)
exports.generateTestCertificate = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.id;
    
    const { data: event } = await supabase.from('events').select('*').eq('id', eventId).single();
    if (!event || event.status !== 'completed') {
      return res.status(400).json({ message: 'Event not found or not completed.' });
    }
    if (!event.certificate_template) {
      return res.status(400).json({ message: 'No certificate template uploaded.' });
    }

    const { data: profile } = await supabase.from('profiles').select('id, name').eq('id', userId).single();
    if (!profile) return res.status(404).json({ message: 'User not found.' });

    // Use a dummy ID for the test certificate
    const certId = 'CERT-TEST-PREVIEW';
    const certUrl = await createPdfCertificate(event, profile, certId);

    // Return the URL directly without saving to the DB
    res.json({ message: 'Test certificate generated successfully.', certificate_url: certUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error generating test certificate.', error: err.message });
  }
};

// 5. Get My Certificates
exports.getMyCertificates = async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: certificates, error } = await supabase
      .from('certificates')
      .select(`
        *,
        eventId:events (title, date, category)
      `)
      .eq('user_id', userId)
      .order('issued_at', { ascending: false });

    if (error) throw error;
    res.json(certificates);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching certificates.', error: err.message });
  }
};

// 5. Verify Certificate
exports.verifyCertificate = async (req, res) => {
  try {
    const { certificateId } = req.params;
    const { data: cert, error } = await supabase
      .from('certificates')
      .select(`
        *,
        eventId:events (title, date),
        userId:profiles (name)
      `)
      .eq('certificate_id', certificateId)
      .maybeSingle();

    if (error || !cert) {
      return res.status(404).json({ valid: false, message: 'Invalid or missing certificate.' });
    }

    res.json({
      valid: true,
      studentName: cert.userId?.name,
      eventName: cert.eventId?.title,
      eventDate: cert.eventId?.date,
      issuedAt: cert.issued_at
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error verifying certificate.', error: err.message });
  }
};
