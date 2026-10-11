// server/generateDemoCertificates.js
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const supabase = require('./config/supabaseClient');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const QRCode = require('qrcode');
const axios = require('axios');
const crypto = require('crypto');

const TEMPLATE_URL = 'https://dousvbgbojpyesdblqec.supabase.co/storage/v1/object/public/certificates/template-1787136953551-352222383.pdf';

const generateCertId = () => `CERT-2026-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

async function main() {
  try {
    console.log('--- 1. Initializing Certificate Generation & Seeding ---');

    // Create local output directories for PPT screenshots
    const certOutputDir = path.join(__dirname, 'uploads', 'generated-certificates');
    const qrOutputDir = path.join(__dirname, 'uploads', 'generated-qrs');
    fs.mkdirSync(certOutputDir, { recursive: true });
    fs.mkdirSync(qrOutputDir, { recursive: true });

    // Download Certificate Template
    console.log('Downloading master certificate template...');
    const templateRes = await axios.get(TEMPLATE_URL, { responseType: 'arraybuffer' });
    const templateBytes = templateRes.data;
    console.log(`Template downloaded successfully (${templateBytes.length} bytes).`);

    // Fetch the 5 published demo events
    const { data: events, error: eventErr } = await supabase
      .from('events')
      .select('*')
      .eq('status', 'published')
      .order('date', { ascending: true });

    if (eventErr || !events || events.length === 0) {
      throw new Error('No published demo events found.');
    }
    console.log(`Found ${events.length} published events.`);

    // Fetch student profiles
    const { data: students, error: studentErr } = await supabase
      .from('profiles')
      .select('id, name, email, department, roll_number')
      .limit(10);

    if (studentErr || !students || students.length === 0) {
      throw new Error('No student profiles found.');
    }
    console.log(`Found ${students.length} student profiles for registration.`);

    // Ensure all 5 events have the certificate template linked
    for (const evt of events) {
      await supabase
        .from('events')
        .update({
          certificate_template: TEMPLATE_URL,
          certificate_template_uploaded_at: new Date().toISOString(),
          certificate_fields_config: {
            STUDENT_NAME: { x: 421, y: 238, fontSize: 24, fontFamily: 'Times New Roman', align: 'center', color: '#111827' },
            EVENT_NAME: { x: 421, y: 300, fontSize: 18, fontFamily: 'Helvetica', align: 'center', color: '#1F2937' },
            EVENT_DATE: { x: 421, y: 335, fontSize: 13, fontFamily: 'Helvetica', align: 'center', color: '#4B5563' },
            CERTIFICATE_ID: { x: 120, y: 520, fontSize: 11, fontFamily: 'Helvetica', align: 'left', color: '#6B7280' },
            QR_CODE: { x: 740, y: 500, fontSize: 75, align: 'right' }
          }
        })
        .eq('id', evt.id);
    }

    const generatedCertificates = [];
    const clientBaseUrl = process.env.CLIENT_URL || 'http://localhost:5173';

    // Pair students with events and generate certificates across all streams
    const participants = [
      { student: students[0], event: events[0], stream: 'Technical (CSE / AI)' },
      { student: students[1], event: events[0], stream: 'Technical (CSE / AI)' },
      { student: students[2], event: events[1], stream: 'Cultural (Arts / Music)' },
      { student: students[3], event: events[2], stream: 'Sports (Athletics / Esports)' },
      { student: students[4], event: events[3], stream: 'Workshop (Robotics / ECE)' },
      { student: students[5] || students[0], event: events[4], stream: 'Seminar (Management / MBA)' },
    ];

    console.log(`\n--- 2. Generating ${participants.length} Certificates with Verified QR Codes ---`);

    for (let i = 0; i < participants.length; i++) {
      const { student, event, stream } = participants[i];
      const certId = generateCertId();
      const verifyUrl = `${clientBaseUrl}/verify/${certId}`;

      console.log(`\n[${i + 1}/${participants.length}] Processing: ${student.name} for "${event.title}"`);

      // 1. Ensure registration exists and attendance is marked 'Present'
      const { error: regErr } = await supabase
        .from('event_registrations')
        .upsert({
          user_id: student.id,
          event_id: event.id,
          status: 'registered',
          attendance_status: 'Present',
          attendance_timestamp: new Date().toISOString(),
          created_at: new Date().toISOString()
        }, { onConflict: 'user_id, event_id' });

      if (regErr) {
        console.warn(`Registration upsert note: ${regErr.message}`);
      }

      // 2. Generate standalone high-res QR code image file
      const qrPngPath = path.join(qrOutputDir, `${certId}-qr.png`);
      await QRCode.toFile(qrPngPath, verifyUrl, {
        width: 400,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'H'
      });

      // 3. Generate QR DataURL for embedding in PDF
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
        margin: 1,
        width: 300,
        errorCorrectionLevel: 'H'
      });
      const qrImageBytes = Buffer.from(qrDataUrl.split(',')[1], 'base64');

      // 4. Create PDF Document and overlay text + QR
      const pdfDoc = await PDFDocument.load(templateBytes);
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const { width, height } = firstPage.getSize();

      const fonts = {
        Helvetica: await pdfDoc.embedFont(StandardFonts.Helvetica),
        HelveticaBold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
        TimesRoman: await pdfDoc.embedFont(StandardFonts.TimesRoman),
        TimesRomanBold: await pdfDoc.embedFont(StandardFonts.TimesRomanBold)
      };

      const qrImage = await pdfDoc.embedPng(qrImageBytes);

      // Draw Student Name (Centered & Bold)
      const nameSize = 25;
      const nameFont = fonts.TimesRomanBold;
      const nameText = student.name.toUpperCase();
      const nameWidth = nameFont.widthOfTextAtSize(nameText, nameSize);
      firstPage.drawText(nameText, {
        x: (width / 2) - (nameWidth / 2),
        y: height - 238,
        size: nameSize,
        font: nameFont,
        color: rgb(0.08, 0.12, 0.2) // Deep navy
      });

      // Draw Event Description line
      const certDesc = `has successfully participated in the ${event.category} event`;
      const descSize = 13;
      const descFont = fonts.Helvetica;
      const descWidth = descFont.widthOfTextAtSize(certDesc, descSize);
      firstPage.drawText(certDesc, {
        x: (width / 2) - (descWidth / 2),
        y: height - 275,
        size: descSize,
        font: descFont,
        color: rgb(0.3, 0.35, 0.45)
      });

      // Draw Event Name
      const eventSize = 18;
      const eventFont = fonts.HelveticaBold;
      const eventTitle = `"${event.title}"`;
      const eventWidth = eventFont.widthOfTextAtSize(eventTitle, eventSize);
      firstPage.drawText(eventTitle, {
        x: (width / 2) - (eventWidth / 2),
        y: height - 305,
        size: eventSize,
        font: eventFont,
        color: rgb(0.05, 0.35, 0.55) // Rich cyan/blue
      });

      // Draw Date & Venue
      const eventDateStr = new Date(event.date).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
      const metaText = `Held on ${eventDateStr} at ${event.venue || 'Campus Auditorium'}`;
      const metaSize = 11;
      const metaFont = fonts.Helvetica;
      const metaWidth = metaFont.widthOfTextAtSize(metaText, metaSize);
      firstPage.drawText(metaText, {
        x: (width / 2) - (metaWidth / 2),
        y: height - 330,
        size: metaSize,
        font: metaFont,
        color: rgb(0.4, 0.45, 0.5)
      });

      // Draw Certificate ID
      const certIdLabel = `Certificate ID: ${certId}`;
      firstPage.drawText(certIdLabel, {
        x: 60,
        y: 60,
        size: 10,
        font: fonts.HelveticaBold,
        color: rgb(0.3, 0.35, 0.4)
      });

      // Draw Verification URL note
      firstPage.drawText(`Verify at: ${clientBaseUrl}/verify/${certId}`, {
        x: 60,
        y: 46,
        size: 8.5,
        font: fonts.Helvetica,
        color: rgb(0.5, 0.55, 0.6)
      });

      // Draw QR Code on Bottom Right
      const qrSize = 75;
      const qrX = width - 60 - qrSize;
      const qrY = 40;
      firstPage.drawImage(qrImage, {
        x: qrX,
        y: qrY,
        width: qrSize,
        height: qrSize
      });

      // Draw "Scan to Verify" label
      const scanLabel = "Scan to Verify";
      const scanWidth = fonts.Helvetica.widthOfTextAtSize(scanLabel, 7.5);
      firstPage.drawText(scanLabel, {
        x: qrX + (qrSize / 2) - (scanWidth / 2),
        y: qrY - 10,
        size: 7.5,
        font: fonts.HelveticaBold,
        color: rgb(0.4, 0.45, 0.5)
      });

      // Save PDF bytes
      const generatedPdfBytes = await pdfDoc.save();

      // Save local copy for PPT / screenshots
      const localPdfPath = path.join(certOutputDir, `${certId}.pdf`);
      fs.writeFileSync(localPdfPath, generatedPdfBytes);

      // Upload to Supabase Storage
      const storagePath = `generated/certificate-${certId}-${Date.now()}.pdf`;
      const { error: uploadErr } = await supabase.storage
        .from('certificates')
        .upload(storagePath, generatedPdfBytes, {
          contentType: 'application/pdf',
          upsert: true
        });

      if (uploadErr) {
        console.error(`Storage upload error for ${certId}:`, uploadErr.message);
      }

      const { data: publicUrlData } = supabase.storage
        .from('certificates')
        .getPublicUrl(storagePath);

      const certPublicUrl = publicUrlData.publicUrl;

      // Delete any previous cert for this student & event if exists
      await supabase
        .from('certificates')
        .delete()
        .eq('event_id', event.id)
        .eq('user_id', student.id);

      // 5. Insert into certificates table in Supabase
      const { data: certRow, error: insertCertErr } = await supabase
        .from('certificates')
        .insert({
          event_id: event.id,
          user_id: student.id,
          certificate_id: certId,
          certificate_url: certPublicUrl,
          issued_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertCertErr) {
        console.error(`Database insert error for ${certId}:`, insertCertErr.message);
      } else {
        console.log(`✅ Certificate created & saved to DB: ${certId}`);
        console.log(`   Direct PDF URL: ${certPublicUrl}`);
        console.log(`   Verification Link: ${verifyUrl}`);
      }

      generatedCertificates.push({
        certId,
        studentName: student.name,
        studentEmail: student.email,
        department: student.department || 'CSE',
        eventTitle: event.title,
        category: event.category,
        stream,
        certPublicUrl,
        verifyUrl,
        localPdfPath,
        qrPngPath
      });
    }

    console.log('\n========================================================================');
    console.log(`🎉 SUCCESSFULLY GENERATED & SAVED ${generatedCertificates.length} CERTIFICATES WITH VERIFIED QR CODES!`);
    console.log('========================================================================\n');

    generatedCertificates.forEach((c, idx) => {
      console.log(`[${idx + 1}] ID: ${c.certId}`);
      console.log(`    Participant       : ${c.studentName} (${c.department})`);
      console.log(`    Stream / Category : ${c.stream}`);
      console.log(`    Event             : ${c.eventTitle}`);
      console.log(`    PDF Download URL  : ${c.certPublicUrl}`);
      console.log(`    Verify URL        : ${c.verifyUrl}`);
      console.log(`    Local PDF File    : ${c.localPdfPath}`);
      console.log(`    Local QR Image    : ${c.qrPngPath}\n`);
    });

  } catch (err) {
    console.error('Fatal error generating certificates:', err);
  } finally {
    process.exit(0);
  }
}

main();
