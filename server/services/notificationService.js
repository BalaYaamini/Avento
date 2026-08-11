const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const nodemailer = require('nodemailer');
const supabase = require('../config/supabaseClient');
const User = require('../models/User');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  family: 4,
  connectionTimeout: 15000,
  greetingTimeout: 10000,
  socketTimeout: 30000,
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  rateDelta: 1000,
  rateLimit: 10,
});

let emailCountToday = 0;
let lastResetDate = new Date().toDateString();

const resetDailyCount = () => {
  const today = new Date().toDateString();
  if (lastResetDate !== today) {
    emailCountToday = 0;
    lastResetDate = today;
  }
};

const verifySMTPConnection = async () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('[EMAIL] SMTP not configured - emails will be logged only');
    return false;
  }
  try {
    await transporter.verify();
    console.log(`[EMAIL] SMTP connected successfully via ${process.env.EMAIL_USER}`);
    console.log(`[EMAIL] Daily limit: 2,000 emails/day (Gmail)`);
    return true;
  } catch (err) {
    console.error('[EMAIL] SMTP connection failed:', err.message);
    console.warn('[EMAIL] Emails will be logged only.');
    return false;
  }
};

const sendEmailNotification = async ({ recipientEmail, subject, htmlBody }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`[EMAIL MOCK] To: ${recipientEmail} | Subject: ${subject}`);
    return;
  }

  resetDailyCount();
  if (emailCountToday >= 2000) {
    console.warn(`[EMAIL] Daily limit reached. Email to ${recipientEmail} queued.`);
    return;
  }

  try {
    const mailOptions = {
      from: `"Avento" <${process.env.EMAIL_USER}>`,
      to: recipientEmail,
      subject,
      html: htmlBody,
      headers: { 'X-Mailer': 'Avento-EventManagement' },
    };
    const info = await transporter.sendMail(mailOptions);
    emailCountToday++;
    console.log(`[EMAIL SENT] To: ${recipientEmail} | Subject: ${subject} | ID: ${info.messageId} | Count: ${emailCountToday}/2000`);
    return info;
  } catch (err) {
    console.error(`[EMAIL FAILED] To: ${recipientEmail} | Error: ${err.message}`);
  }
};

const sendInAppNotification = async ({ recipientId, title, message, type = 'info', eventId = null }) => {
  try {
    const notifData = {
      recipient_id: recipientId,
      title,
      message,
      type,
      created_at: new Date().toISOString()
    };
    if (eventId) notifData.event_id = eventId;

    const { error } = await supabase.from('notifications').insert(notifData);
    if (error && error.code === '42P01') {
      console.warn('Notifications table does not exist. Please run the SQL patch.');
    } else if (error) {
      throw error;
    }
  } catch (err) {
    console.error('Error creating in-app notification:', err.message);
  }
};

const generateEmailHtml = (title, message, data = {}) => {
  const eventHtml = data.eventName ? `
<div style="background-color:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;margin-top:25px;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr><td colspan="2" style="padding-bottom:15px;"><h3 style="margin:0;font-size:18px;color:#1e293b;">${data.eventName}</h3></td></tr>
    ${data.date ? `<tr><td style="padding:8px 0;font-size:14px;color:#64748b;width:40%;"><strong>Date</strong></td><td style="padding:8px 0;font-size:14px;color:#1e293b;">${data.date}</td></tr>` : ''}
    ${data.time ? `<tr><td style="padding:8px 0;font-size:14px;color:#64748b;"><strong>Time</strong></td><td style="padding:8px 0;font-size:14px;color:#1e293b;">${data.time}</td></tr>` : ''}
    ${data.venue ? `<tr><td style="padding:8px 0;font-size:14px;color:#64748b;"><strong>Venue</strong></td><td style="padding:8px 0;font-size:14px;color:#1e293b;">${data.venue}</td></tr>` : ''}
    ${data.category ? `<tr><td style="padding:8px 0;font-size:14px;color:#64748b;"><strong>Category</strong></td><td style="padding:8px 0;font-size:14px;color:#1e293b;">${data.category}</td></tr>` : ''}
    ${data.organizer ? `<tr><td style="padding:8px 0;font-size:14px;color:#64748b;"><strong>Organizer</strong></td><td style="padding:8px 0;font-size:14px;color:#1e293b;">${data.organizer}</td></tr>` : ''}
    ${data.teamName ? `<tr><td style="padding:8px 0;font-size:14px;color:#64748b;"><strong>Team Name</strong></td><td style="padding:8px 0;font-size:14px;color:#1e293b;">${data.teamName}</td></tr>` : ''}
    ${data.registrationId ? `<tr><td style="padding:8px 0;font-size:14px;color:#64748b;"><strong>Reg ID</strong></td><td style="padding:8px 0;font-size:14px;font-family:monospace;font-weight:700;color:#c084fc;">${data.registrationId}</td></tr>` : ''}
    ${data.status ? `<tr><td style="padding:8px 0;font-size:14px;color:#64748b;"><strong>Status</strong></td><td style="padding:8px 0;font-size:14px;font-weight:700;color:#10b981;">${data.status}</td></tr>` : ''}
  </table>
</div>` : '';

  const notesHtml = data.instructions ? `
<div style="background-color:#f8fafc;border-radius:12px;padding:16px;margin-top:20px;border-left:4px solid #c084fc;">
  <p style="margin:0;font-size:14px;color:#334155;line-height:1.5;"><strong>Important Notes:</strong><br>${data.instructions}</p>
</div>` : '';

  const btnHtml = data.eventId ? `
<div style="text-align:center;margin-top:40px;">
  <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/workspace/${data.eventId}" style="display:inline-block;background:linear-gradient(135deg,#c084fc,#a78bfa);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:30px;box-shadow:0 4px 15px rgba(167,139,250,0.4);">View Event</a>
</div>` : `
<div style="text-align:center;margin-top:40px;">
  <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}" style="display:inline-block;background:linear-gradient(135deg,#c084fc,#a78bfa);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:30px;box-shadow:0 4px 15px rgba(167,139,250,0.4);">Open AVENTO</a>
</div>`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Avento Notification</title></head>
<body style="margin:0;padding:0;font-family:'Quicksand','Nunito','Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#fdfbf7;-webkit-font-smoothing:antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#fdfbf7;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
        <tr><td style="padding:40px 40px 20px;text-align:center;">
          <img src="https://joekmqnkpfjuptcgzpmh.supabase.co/storage/v1/object/public/public-assets/avento-logo-public.png" alt="Avento Logo" width="60" style="display:block;margin:0 auto 15px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <h1 style="margin:0;font-size:28px;font-weight:700;color:#1e293b;letter-spacing:0.5px;">AVENTO</h1>
          <p style="margin:5px 0 0;color:#64748b;font-size:14px;font-weight:500;">Event Management Platform</p>
        </td></tr>
        <tr><td style="padding:0 40px;"><hr style="border:0;border-top:1px solid #f1f5f9;margin:0;"></td></tr>
        <tr><td style="padding:30px 40px;">
          <h2 style="margin:0 0 10px;font-size:24px;color:#1e293b;font-weight:700;">${title}</h2>
          <p style="margin:0 0 25px;font-size:16px;color:#64748b;line-height:1.6;">
            ${data.recipientName ? `Hello ${data.recipientName},<br>` : ''}Here's an update regarding your event.
          </p>
          <p style="margin:0;font-size:16px;color:#334155;line-height:1.6;background-color:#f8fafc;padding:16px;border-radius:12px;border-left:4px solid #c084fc;">${message}</p>
          ${eventHtml}${notesHtml}${btnHtml}
        </td></tr>
        <tr><td style="padding:0 40px 30px;">
          <hr style="border:0;border-top:1px solid #f1f5f9;margin:0 0 20px;">
          <p style="margin:0 0 5px;font-size:14px;font-weight:700;color:#94a3b8;text-align:center;">AVENTO</p>
          <p style="margin:0 0 15px;font-size:12px;color:#94a3b8;text-align:center;">Smart Campus Event Management</p>
          <p style="margin:0;font-size:11px;color:#cbd5e1;text-align:center;line-height:1.5;">
            This is an automated notification from AVENTO. Please do not reply.<br>
            Timestamp: ${data.timestamp || new Date().toLocaleString()}<br>
            &copy; ${new Date().getFullYear()} AVENTO. All Rights Reserved.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

const notifyUser = async ({ recipientId, recipientEmail, title, message, type = 'info', eventId = null, emailSubject, emailData = {} }) => {
  try {
    await sendInAppNotification({ recipientId, title, message, type, eventId });

    let targetEmail = recipientEmail;
    let targetName = null;

    if (!targetEmail && recipientId) {
      try {
        const mongoUser = await User.findById(recipientId).select('name email');
        if (mongoUser && mongoUser.email) {
          targetEmail = mongoUser.email;
          targetName = mongoUser.name;
        }
      } catch (e) {}

      if (!targetEmail) {
        try {
          const { data: profile } = await supabase
            .from('profiles').select('email, name').eq('id', recipientId).single();
          if (profile && profile.email) {
            targetEmail = profile.email;
            targetName = profile.name;
          }
        } catch (e) {}
      }
    }

    const emailEnabled = process.env.EMAIL_NOTIFICATIONS_ENABLED !== 'false' &&
                         process.env.EMAIL_USER && process.env.EMAIL_PASS;

    if (targetEmail && emailEnabled) {
      const finalSubject = emailSubject || title;
      const htmlBody = generateEmailHtml(title, message, {
        eventId,
        recipientName: targetName,
        timestamp: new Date().toLocaleString(),
        ...emailData
      });

      sendEmailNotification({ recipientEmail: targetEmail, subject: finalSubject, htmlBody })
        .catch(err => console.error('[EMAIL] Background delivery failed:', err.message));
    }
  } catch (err) {
    console.error('[NOTIFY] Non-fatal error in notifyUser:', err.message);
  }
};

const getEmailStats = () => {
  resetDailyCount();
  return {
    sentToday: emailCountToday,
    dailyLimit: 2000,
    remaining: 2000 - emailCountToday,
    configured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS)
  };
};

module.exports = {
  sendInAppNotification,
  sendEmailNotification,
  verifySMTPConnection,
  notifyUser,
  getEmailStats
};
