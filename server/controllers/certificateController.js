const supabase = require('../config/supabaseClient');
const { notifyUser } = require('../services/notificationService');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const QRCode = require('qrcode');
const crypto = require('crypto');

const getFontSize = (size) => size || 24;

const generateCertId = () => `CERT-${new Date().getFullYear()}-${crypto.randomUUID().split('-')[0].toUpperCase()}`;

const BATCH_SIZE = 10;

// Helper to fetch names
const fetchOrganizerNames = async (event) => {
  let facultyName = '';
  let organizerName = '';
  if (event.faculty_id) {
    const { data: fac } = await supabase.from('profiles').select('name').eq('id', event.faculty_id).maybeSingle();
    if (fac) facultyName = fac.name;
  }
  const orgId = event.student_organizer_id || event.organizer_id || event.proposed_by;
  if (orgId) {
    const { data: org } = await supabase.from('profiles').select('name').eq('id', orgId).maybeSingle();
    if (org) organizerName = org.name;
  }
  return { facultyName, organizerName };
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

    const isAuthorized = req.user.roles?.includes('admin') || req.user.role === 'admin';

    if (!isAuthorized) {
      return res.status(403).json({ message: 'Access denied. Certificate administration is strictly reserved for Admins.' });
    }

    const file = req.file;
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileName = 'template-' + uniqueSuffix + path.extname(file.originalname).toLowerCase();

    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from('certificates')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true
      });

    if (uploadErr) {
      console.error('Supabase upload error:', uploadErr);
      return res.status(500).json({ message: 'Error uploading to storage.', error: uploadErr.message });
    }

    const { data: publicUrlData } = supabase.storage
      .from('certificates')
      .getPublicUrl(fileName);

    // Append timestamp to bust browser and CDN caches so the user sees the latest position
    const templatePath = `${publicUrlData.publicUrl}?t=${Date.now()}`;
    
    // Default config (A4 Landscape roughly: 842 x 595)
    const defaultConfig = {
      STUDENT_NAME: { x: 421, y: 300, fontSize: 36, fontFamily: 'Helvetica', align: 'center', color: '#000000' },
      QR_CODE: { x: 692, y: 440, fontSize: 80, fontFamily: 'Helvetica', align: 'left', color: '#000000' }
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
    const isAdmin = req.user?.roles?.includes('admin') || req.user?.role === 'admin';
    if (!isAdmin) {
      return res.status(403).json({ message: 'Access denied. Certificate configuration is strictly reserved for Admins.' });
    }

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

    const isAuthorized = req.user.roles?.includes('admin') || req.user.role === 'admin';

    if (!isAuthorized) {
      return res.status(403).json({ message: 'Access denied. Certificate administration is strictly reserved for Admins.' });
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

// Fetch template bytes once (cached for bulk generation)
const fetchTemplateBytes = async (templatePathStr) => {
  let fileBytes, ext;
  if (templatePathStr.startsWith('http')) {
    const cleanUrlPath = templatePathStr.split('?')[0];
    ext = path.extname(cleanUrlPath).toLowerCase();
    if (!ext || ext === '') {
      if (templatePathStr.includes('.pdf')) ext = '.pdf';
      else if (templatePathStr.includes('.png')) ext = '.png';
      else if (templatePathStr.includes('.jpg') || templatePathStr.includes('.jpeg')) ext = '.jpg';
      else ext = '.png';
    }
    const response = await axios.get(templatePathStr, { responseType: 'arraybuffer', timeout: 30000 });
    fileBytes = response.data;
  } else {
    const templatePathLocal = path.join(__dirname, '..', templatePathStr);
    if (!fs.existsSync(templatePathLocal)) throw new Error('Template file not found on server.');
    ext = path.extname(templatePathLocal).toLowerCase();
    fileBytes = fs.readFileSync(templatePathLocal);
  }
  return { fileBytes, ext };
};

// Internal function to generate PDF (templateCache = { fileBytes, ext })
const createPdfCertificate = async (event, student, certId, facultyName = '', organizerName = '', templateCache = null) => {
  const { fileBytes, ext } = templateCache || await fetchTemplateBytes(event.certificate_template);

  let config = event.certificate_fields_config;
  let pdfDoc;
  let width = 842, height = 595;

  if (ext === '.pdf') {
    pdfDoc = await PDFDocument.load(fileBytes);
    const firstPage = pdfDoc.getPages()[0];
    const size = firstPage.getSize();
    width = size.width;
    height = size.height;
  } else {
    pdfDoc = await PDFDocument.create();
    let image;
    if (ext === '.png') image = await pdfDoc.embedPng(fileBytes);
    else if (ext === '.jpg' || ext === '.jpeg') image = await pdfDoc.embedJpg(fileBytes);
    if (!image) throw new Error('Unsupported template image format.');
    const dims = image.scale(1);
    width = dims.width;
    height = dims.height;
    const page = pdfDoc.addPage([width, height]);
    page.drawImage(image, { x: 0, y: 0, width, height });
  }

  const fonts = {
    Helvetica: await pdfDoc.embedFont(StandardFonts.Helvetica),
    'Times New Roman': await pdfDoc.embedFont(StandardFonts.TimesRoman),
    Courier: await pdfDoc.embedFont(StandardFonts.Courier)
  };

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
      EVENT_VENUE: { x: width/2, y: 460, fontSize: 18, fontFamily: 'Helvetica', align: 'center', color: '#000000' },
      ISSUE_DATE: { x: 150, y: 500, fontSize: 16, fontFamily: 'Helvetica', align: 'left', color: '#000000' },
      CERTIFICATE_ID: { x: 150, y: 530, fontSize: 12, fontFamily: 'Helvetica', align: 'left', color: '#000000' },
      ORGANIZER_NAME: { x: 150, y: 560, fontSize: 16, fontFamily: 'Helvetica', align: 'left', color: '#000000' },
      FACULTY_COORDINATOR: { x: width - 150, y: 560, fontSize: 16, fontFamily: 'Helvetica', align: 'right', color: '#000000' }
    };
  }

  const hexToRgb = (hex) => {
    if (!hex) return [0,0,0];
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [parseInt(result[1], 16) / 255, parseInt(result[2], 16) / 255, parseInt(result[3], 16) / 255] : [0,0,0];
  };

  const firstPage = pdfDoc.getPages()[0];

  const drawText = (text, fieldKey) => {
    const fieldConfig = config[fieldKey];
    if (!text || !fieldConfig) return;
    const size = Number(fieldConfig.fontSize) || 24;
    const usedFont = fonts[fieldConfig.fontFamily] || fonts.Helvetica;
    const textWidth = usedFont.widthOfTextAtSize(text, size);
    let x = Number(fieldConfig.x) || 0;
    if (fieldConfig.align === 'center') x -= (textWidth / 2);
    else if (fieldConfig.align === 'right') x -= textWidth;
    const y = height - Number(fieldConfig.y) - size;
    const colorArr = hexToRgb(fieldConfig.color);
    firstPage.drawText(text, { x, y, size, font: usedFont, color: rgb(colorArr[0], colorArr[1], colorArr[2]) });
  };

  drawText(student.name, 'STUDENT_NAME');

  try {
    const cleanBaseUrl = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const verifyUrl = `${cleanBaseUrl}/verify/${certId}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 300, errorCorrectionLevel: 'H' });
    const qrImageBytes = Buffer.from(qrDataUrl.split(',')[1], 'base64');
    const qrImage = await pdfDoc.embedPng(qrImageBytes);
    const qrConfig = config.QR_CODE || { x: width - 150, y: 440, fontSize: 80 };
    const qrSize = Number(qrConfig.fontSize) || Number(qrConfig.width) || 80;
    let qrX = Number(qrConfig.x) || (width - 150);
    if (qrConfig.align === 'center') qrX -= (qrSize / 2);
    else if (qrConfig.align === 'right') qrX -= qrSize;
    const qrY = height - Number(qrConfig.y) - qrSize;
    firstPage.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });
  } catch (qrErr) {
    console.error('QR code error (non-fatal):', qrErr.message);
  }

  const pdfBytes = await pdfDoc.save();
  const certFileName = `generated/certificate-${certId}-${Date.now()}.pdf`;

  const { error: uploadErr } = await supabase.storage
    .from('certificates')
    .upload(certFileName, pdfBytes, { contentType: 'application/pdf', upsert: true });

  if (uploadErr) throw new Error(`Failed to upload certificate: ${uploadErr.message}`);

  const { data: urlData } = supabase.storage.from('certificates').getPublicUrl(certFileName);
  return urlData.publicUrl;
};

// Process a batch of profiles concurrently
const processBatch = async (profiles, generateFn) => {
  const results = await Promise.allSettled(profiles.map(generateFn));
  const succeeded = [];
  const failed = [];
  results.forEach((result, i) => {
    if (result.status === 'fulfilled' && result.value) succeeded.push(result.value);
    else failed.push({ userId: profiles[i].id, error: result.reason?.message || 'Unknown error' });
  });
  return { succeeded, failed };
};

// 2. Generate Certificates (Bulk) — optimized for 500+
exports.generateAllCertificates = async (req, res) => {
  try {
    const isAdmin = req.user?.roles?.includes('admin') || req.user?.role === 'admin';
    if (!isAdmin) {
      return res.status(403).json({ message: 'Access denied. Certificate generation is strictly reserved for Admins.' });
    }

    const { eventId } = req.params;
    const { data: event } = await supabase.from('events').select('*').eq('id', eventId).single();
    if (!event || event.status !== 'completed') {
      return res.status(400).json({ message: 'Event not found or not completed.' });
    }
    if (!event.certificate_template) {
      return res.status(400).json({ message: 'No certificate template uploaded for this event.' });
    }

    const { data: registrations } = await supabase
      .from('event_registrations')
      .select('user_id, attendance_status')
      .eq('event_id', eventId);

    const eligibleUserIds = (registrations || [])
      .filter(r => r.attendance_status === 'Present')
      .map(r => r.user_id);

    if (eligibleUserIds.length === 0) {
      return res.status(400).json({ message: 'No eligible participants found.' });
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', eligibleUserIds);

    if (!profiles || profiles.length === 0) {
      return res.status(400).json({ message: 'No participant profiles found.' });
    }

    // Batch-check which users already have certificates (single query, not per-user)
    const { data: existingCerts } = await supabase
      .from('certificates')
      .select('user_id')
      .eq('event_id', eventId)
      .in('user_id', eligibleUserIds);

    const existingUserIds = new Set((existingCerts || []).map(c => c.user_id));
    const pendingProfiles = profiles.filter(p => !existingUserIds.has(p.id));

    if (pendingProfiles.length === 0) {
      return res.json({ message: 'All certificates already generated.', generated: 0, skipped: profiles.length });
    }

    // Fetch template ONCE for all certificates
    const templateCache = await fetchTemplateBytes(event.certificate_template);
    const { facultyName, organizerName } = await fetchOrganizerNames(event);

    // Process in concurrent batches of BATCH_SIZE
    let generatedCount = 0;
    const allFailed = [];
    const allInserts = [];

    for (let i = 0; i < pendingProfiles.length; i += BATCH_SIZE) {
      const batch = pendingProfiles.slice(i, i + BATCH_SIZE);
      console.log(`[Certificates] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(pendingProfiles.length / BATCH_SIZE)} (${batch.length} certs)`);

      const { succeeded, failed } = await processBatch(batch, async (profile) => {
        const certId = generateCertId();
        const certUrl = await createPdfCertificate(event, profile, certId, facultyName, organizerName, templateCache);
        return { event_id: eventId, user_id: profile.id, certificate_id: certId, certificate_url: certUrl, profile };
      });

      allFailed.push(...failed);

      if (succeeded.length > 0) {
        const insertRows = succeeded.map(({ profile, ...rest }) => rest);
        const { error: batchInsertErr } = await supabase.from('certificates').insert(insertRows);
        if (batchInsertErr) {
          console.error('[Certificates] Batch insert error:', batchInsertErr.message);
          allFailed.push(...insertRows.map(r => ({ userId: r.user_id, error: batchInsertErr.message })));
        } else {
          generatedCount += insertRows.length;
          allInserts.push(...succeeded);
        }
      }
    }

    // Fire notifications asynchronously (don't block the response)
    if (allInserts.length > 0) {
      const eventTitle = event.title;
      const eventIdVal = event.id;
      setImmediate(async () => {
        for (const { profile } of allInserts) {
          try {
            await notifyUser({
              recipientId: profile.id,
              title: 'Certificate Available',
              message: `Your certificate for "${eventTitle}" is ready for download.`,
              type: 'success',
              eventId: eventIdVal,
              emailSubject: 'Your Certificate is Ready',
              emailData: {
                eventName: eventTitle,
                publishDate: new Date().toLocaleDateString(),
                status: 'Published',
                instructions: "Please log into AVENTO and navigate to the Certificates dashboard to download your verified certificate."
              }
            });
          } catch (notifErr) {
            console.error('Non-fatal notification error:', notifErr.message);
          }
        }
      });
    }

    res.json({
      message: `Successfully generated ${generatedCount} certificates.`,
      generated: generatedCount,
      skipped: profiles.length - pendingProfiles.length,
      failed: allFailed.length,
      errors: allFailed.length > 0 ? allFailed.slice(0, 10) : []
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error generating certificates.', error: err.message });
  }
};

// 3. Generate Certificate (Single)
exports.generateSingleCertificate = async (req, res) => {
  try {
    const isAdmin = req.user?.roles?.includes('admin') || req.user?.role === 'admin';
    if (!isAdmin) {
      return res.status(403).json({ message: 'Access denied. Certificate generation is strictly reserved for Admins.' });
    }

    const { eventId, userId } = req.params;
    
    const { data: event } = await supabase.from('events').select('*').eq('id', eventId).single();
    if (!event || event.status !== 'completed') {
      return res.status(400).json({ message: 'Event not found or not completed.' });
    }
    if (!event.certificate_template) {
      return res.status(400).json({ message: 'No certificate template uploaded.' });
    }

    // Verify attendance
    const { data: reg, error: regErr } = await supabase
      .from('event_registrations')
      .select('attendance_status')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle();

    if (regErr || !reg || reg.attendance_status !== 'Present') {
      return res.status(403).json({ message: "Certificate can only be generated for students marked Present." });
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

    const { facultyName, organizerName } = await fetchOrganizerNames(event);
    const certId = generateCertId();
    const certUrl = await createPdfCertificate(event, profile, certId, facultyName, organizerName);

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
    const isAdmin = req.user?.roles?.includes('admin') || req.user?.role === 'admin';
    if (!isAdmin) {
      return res.status(403).json({ message: 'Access denied. Certificate generation is strictly reserved for Admins.' });
    }

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

    const { facultyName, organizerName } = await fetchOrganizerNames(event);
    // Use a dummy ID for the test certificate
    const certId = 'CERT-TEST-PREVIEW';
    const certUrl = await createPdfCertificate(event, profile, certId, facultyName, organizerName);

    // Return the URL directly without saving to the DB
    res.json({ message: 'Test certificate generated successfully.', certificate_url: certUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error generating test certificate.', error: err.message });
  }
};

// Helper to fetch all unique eligible organizers for an event
const getEligibleEventOrganizers = async (eventId) => {
  const { data: event } = await supabase.from('events').select('*').eq('id', eventId).single();
  if (!event) return { event: null, organizers: [] };

  const { data: orgs } = await supabase
    .from('event_organizers')
    .select('student_id')
    .eq('event_id', eventId);

  const { data: members } = await supabase
    .from('event_members')
    .select('user_id')
    .eq('event_id', eventId);

  const directIds = [
    event.faculty_id,
    event.student_organizer_id,
    event.proposed_by,
    event.organizer_id,
    event.created_by
  ].filter(Boolean);

  const orgIds = (orgs || []).map(o => o.student_id).filter(Boolean);
  const memIds = (members || []).map(m => m.user_id).filter(Boolean);

  const allUserIds = [...new Set([...directIds, ...orgIds, ...memIds])];
  if (allUserIds.length === 0) return { event, organizers: [] };

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, email, department')
    .in('id', allUserIds);

  return { event, organizers: profiles || [] };
};

// GET /api/certificates/organizers/:eventId (Admin Only)
exports.getEligibleOrganizers = async (req, res) => {
  try {
    const isAdmin = req.user?.roles?.includes('admin') || req.user?.role === 'admin';
    if (!isAdmin) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    const { eventId } = req.params;
    const { organizers } = await getEligibleEventOrganizers(eventId);
    res.json(organizers);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching eligible organizers.', error: err.message });
  }
};

// Generate Organizer Certificates (Bulk) — optimized for 500+
exports.generateAllOrganizerCertificates = async (req, res) => {
  try {
    const isAdmin = req.user?.roles?.includes('admin') || req.user?.role === 'admin';
    if (!isAdmin) {
      return res.status(403).json({ message: 'Access denied. Certificate generation is strictly reserved for Admins.' });
    }

    const { eventId } = req.params;
    const { event, organizers } = await getEligibleEventOrganizers(eventId);

    if (!event || event.status !== 'completed') {
      return res.status(400).json({ message: 'Event not found or not completed.' });
    }
    if (!event.certificate_template) {
      return res.status(400).json({ message: 'No certificate template uploaded for this event.' });
    }
    if (organizers.length === 0) {
      return res.status(400).json({ message: 'No event organizers found for this event.' });
    }

    // Batch-check existing organizer certificates
    const organizerIds = organizers.map(o => o.id);
    let { data: existingCerts, error: existingCertsError } = await supabase
      .from('certificates')
      .select('user_id')
      .eq('event_id', eventId)
      .eq('certificate_type', 'organizer')
      .in('user_id', organizerIds);

    // Older production schemas do not have certificate_type. In that case,
    // avoid failing generation and use all certificates for this event/user.
    if (existingCertsError && /certificate_type|column/i.test(existingCertsError.message || '')) {
      const fallback = await supabase
        .from('certificates')
        .select('user_id')
        .eq('event_id', eventId)
        .in('user_id', organizerIds);
      existingCerts = fallback.data;
      existingCertsError = fallback.error;
    }
    if (existingCertsError) throw existingCertsError;

    const existingUserIds = new Set((existingCerts || []).map(c => c.user_id));
    const pendingOrgs = organizers.filter(o => !existingUserIds.has(o.id));

    if (pendingOrgs.length === 0) {
      return res.json({ message: 'All organizer certificates already generated.', generated: 0, skipped: organizers.length });
    }

    const templateCache = await fetchTemplateBytes(event.certificate_template);
    const { facultyName, organizerName } = await fetchOrganizerNames(event);

    let generatedCount = 0;
    const allFailed = [];
    const allInserts = [];

    for (let i = 0; i < pendingOrgs.length; i += BATCH_SIZE) {
      const batch = pendingOrgs.slice(i, i + BATCH_SIZE);
      console.log(`[Org Certs] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(pendingOrgs.length / BATCH_SIZE)} (${batch.length} certs)`);

      const { succeeded, failed } = await processBatch(batch, async (profile) => {
        const certId = `CERT-ORG-${new Date().getFullYear()}-${crypto.randomUUID().split('-')[0].toUpperCase()}`;
        const certUrl = await createPdfCertificate(event, profile, certId, facultyName, organizerName, templateCache);
        return { event_id: eventId, user_id: profile.id, certificate_id: certId, certificate_url: certUrl, certificate_type: 'organizer', profile };
      });

      allFailed.push(...failed);

      if (succeeded.length > 0) {
        const insertRows = succeeded.map(({ profile, ...rest }) => rest);
        let { error: batchInsertErr } = await supabase.from('certificates').insert(insertRows);
        if (batchInsertErr && /certificate_type|column/i.test(batchInsertErr.message || '')) {
          const legacyRows = insertRows.map(({ certificate_type, ...row }) => row);
          ({ error: batchInsertErr } = await supabase.from('certificates').insert(legacyRows));
        }
        if (batchInsertErr) {
          console.error('[Org Certs] Batch insert error:', batchInsertErr.message);
          allFailed.push(...insertRows.map(r => ({ userId: r.user_id, error: batchInsertErr.message })));
        } else {
          generatedCount += insertRows.length;
          allInserts.push(...succeeded);
        }
      }
    }

    // Fire notifications asynchronously
    if (allInserts.length > 0) {
      const eventTitle = event.title;
      const eventIdVal = event.id;
      setImmediate(async () => {
        for (const { profile } of allInserts) {
          try {
            await notifyUser({
              recipientId: profile.id,
              title: 'Organizer Certificate Available',
              message: `Your organizer certificate for "${eventTitle}" is ready for download.`,
              type: 'success',
              eventId: eventIdVal,
              emailSubject: 'Your Organizer Certificate is Ready',
              emailData: {
                eventName: eventTitle,
                publishDate: new Date().toLocaleDateString(),
                status: 'Published',
                instructions: "Please log into AVENTO and navigate to the Certificates dashboard to download your verified organizer certificate."
              }
            });
          } catch (notifErr) {
            console.error('Non-fatal notification error:', notifErr.message);
          }
        }
      });
    }

    res.json({
      message: `Successfully generated ${generatedCount} organizer certificates.`,
      generated: generatedCount,
      skipped: organizers.length - pendingOrgs.length,
      failed: allFailed.length,
      errors: allFailed.length > 0 ? allFailed.slice(0, 10) : []
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error generating organizer certificates.', error: err.message });
  }
};

// Generate Organizer Certificate (Single)
exports.generateSingleOrganizerCertificate = async (req, res) => {
  try {
    const isAdmin = req.user?.roles?.includes('admin') || req.user?.role === 'admin';
    if (!isAdmin) {
      return res.status(403).json({ message: 'Access denied. Certificate generation is strictly reserved for Admins.' });
    }

    const { eventId, userId } = req.params;
    const { event, organizers } = await getEligibleEventOrganizers(eventId);

    if (!event || event.status !== 'completed') {
      return res.status(400).json({ message: 'Event not found or not completed.' });
    }
    if (!event.certificate_template) {
      return res.status(400).json({ message: 'No certificate template uploaded.' });
    }

    const organizerProfile = organizers.find(o => String(o.id) === String(userId));
    if (!organizerProfile) {
      return res.status(400).json({ message: 'User is not a registered organizer for this event.' });
    }

    const { data: existing } = await supabase
      .from('certificates')
      .select('*')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .eq('certificate_type', 'organizer')
      .maybeSingle();

    if (existing) {
      return res.json({ message: 'Organizer certificate already exists.', certificate: existing });
    }

    const { facultyName, organizerName } = await fetchOrganizerNames(event);
    const certId = `CERT-ORG-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const certUrl = await createPdfCertificate(event, organizerProfile, certId, facultyName, organizerName);

    const insertPayload = {
      event_id: eventId,
      user_id: userId,
      certificate_id: certId,
      certificate_url: certUrl,
      certificate_type: 'organizer'
    };

    let { data: newCert, error: insertErr } = await supabase.from('certificates').insert(insertPayload).select().single();
    if (insertErr) {
      delete insertPayload.certificate_type;
      const res = await supabase.from('certificates').insert(insertPayload).select().single();
      newCert = res.data;
    }

    res.json({ message: 'Organizer certificate generated successfully.', certificate: newCert });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error generating organizer certificate.', error: err.message });
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
        eventId:events (id, title, date, category, status, feedback_questions)
      `)
      .eq('user_id', userId)
      .order('issued_at', { ascending: false });

    if (error) throw error;

    const { data: feedbacks } = await supabase
      .from('feedbacks')
      .select('event_id')
      .eq('user_id', userId);

    const feedbackEventIds = new Set((feedbacks || []).map(f => String(f.event_id)));

    const result = (certificates || []).map(cert => {
      const eventIdVal = cert.event_id || (cert.eventId && (cert.eventId.id || cert.eventId._id));
      const hasFeedback = cert.certificate_type === 'organizer' || (eventIdVal && feedbackEventIds.has(String(eventIdVal)));
      return {
        ...cert,
        feedback_submitted: Boolean(hasFeedback)
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching certificates.', error: err.message });
  }
};

// 5. Verify Certificate
exports.verifyCertificate = async (req, res) => {
  try {
    const { certificateId } = req.params;
    
    // Fetch certificate and event details
    const { data: cert, error: certError } = await supabase
      .from('certificates')
      .select(`
        *,
        eventId:events (title, date, category)
      `)
      .eq('certificate_id', certificateId)
      .maybeSingle();

    const isStatusValid = cert && (!cert.status || cert.status.toLowerCase() === 'valid');

    if (certError || !cert || !isStatusValid) {
      return res.status(404).json({ 
        valid: false, 
        message: 'Certificate not found or is no longer valid.' 
      });
    }

    // Fetch user profile separately to avoid PostgREST relationship resolve error
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('name, department')
      .eq('id', cert.user_id)
      .maybeSingle();

    if (profileError) {
      console.error('Error fetching profile for certificate verification:', profileError);
    }

    res.json({
      valid: true,
      certificateId: cert.certificate_id,
      studentName: profile?.name || 'N/A',
      eventName: cert.eventId?.title || 'N/A',
      eventDate: cert.eventId?.date ? new Date(cert.eventId.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A',
      issuingOrganization: profile?.department || 'AVENTO University System',
      status: cert.status ? cert.status.charAt(0).toUpperCase() + cert.status.slice(1) : 'Valid',
      issuedAt: cert.issued_at,
      certificateType: cert.certificate_type === 'organizer' ? 'Organizer' : 'Participant'
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error verifying certificate.', error: err.message });
  }
};
