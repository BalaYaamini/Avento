const axios = require('axios');
const supabase = require('../config/supabaseClient');

let emailCountToday = 0;
let lastResetDate = new Date().toDateString();

const resetDailyCount = () => {
  const today = new Date().toDateString();
  if (lastResetDate !== today) {
    emailCountToday = 0;
    lastResetDate = today;
  }
};

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'admin.avento@gmail.com';
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || 'Avento';

if (BREVO_API_KEY) {
  console.log('[EMAIL] Brevo API configured');
} else {
  console.warn('[EMAIL] BREVO_API_KEY not set - emails will be logged only');
}

const verifySMTPConnection = async () => {
  if (!BREVO_API_KEY) {
    console.warn('[EMAIL] Brevo not configured - emails will be logged only');
    return false;
  }
  console.log('[EMAIL] Brevo API ready');
  return true;
};

// TEMPORARY TESTING TOGGLE: Set to false to re-enable outgoing Brevo email notifications
const DISABLE_TEAM_EMAIL_NOTIFICATIONS = false;

const sendEmailNotification = async ({ recipientEmail, subject, htmlBody, attachments }) => {
  if (DISABLE_TEAM_EMAIL_NOTIFICATIONS) {
    console.log(`[EMAIL TEMPORARILY DISABLED FOR TESTING] To: ${recipientEmail} | Subject: ${subject}${attachments?.length ? ` | Attachments: ${attachments.length}` : ''}`);
    return;
  }

  if (!BREVO_API_KEY) {
    console.log(`[EMAIL MOCK] To: ${recipientEmail} | Subject: ${subject}${attachments?.length ? ` | Attachments: ${attachments.length}` : ''}`);
    return;
  }

  resetDailyCount();
  if (emailCountToday >= 300) {
    console.warn(`[EMAIL] Daily limit reached (300). Email to ${recipientEmail} queued.`);
    return;
  }

  try {
    const payload = {
      sender: { email: BREVO_SENDER_EMAIL, name: BREVO_SENDER_NAME },
      to: [{ email: recipientEmail }],
      subject,
      htmlContent: htmlBody,
    };

    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      payload.attachment = attachments;
    }

    const response = await axios.post('https://api.brevo.com/v3/smtp/email', payload, {
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 15000,
    });

    emailCountToday++;
    console.log(`[EMAIL SENT] To: ${recipientEmail} | Subject: ${subject} | Count: ${emailCountToday}/300`);
    return response.data;
  } catch (err) {
    const errMsg = err.response?.data?.message || err.message;
    console.error(`[EMAIL FAILED] To: ${recipientEmail} | Error: ${errMsg}`);
  }
};

const sendPasswordResetEmail = async ({ recipientEmail, resetUrl }) => {
  const htmlBody = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:40px 20px;background:#fdfbf7;font-family:Arial,sans-serif;color:#1e293b;">
  <div style="max-width:560px;margin:auto;background:#fff;border-radius:20px;padding:40px;box-shadow:0 4px 20px rgba(0,0,0,.06);">
    <h1 style="margin:0;color:#1e293b;">AVENTO</h1>
    <h2 style="margin:28px 0 12px;">Reset your password</h2>
    <p style="font-size:16px;line-height:1.6;color:#475569;">Use the button below to create a new password. This link expires according to your Supabase Auth settings.</p>
    <p style="text-align:center;margin:32px 0;"><a href="${resetUrl}" style="display:inline-block;padding:14px 28px;border-radius:12px;background:#8b5cf6;color:#fff;text-decoration:none;font-weight:700;">Reset Password</a></p>
    <p style="font-size:12px;line-height:1.5;color:#94a3b8;">If you did not request this, you can safely ignore this email.</p>
  </div>
</body>
</html>`;

  return sendEmailNotification({
    recipientEmail,
    subject: 'Reset your Avento password',
    htmlBody,
  });
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
      console.warn('Notifications table does not exist.');
    } else if (error) {
      throw error;
    }
  } catch (err) {
    console.error('Error creating in-app notification:', err.message);
  }
};

const generateEmailHtml = (title, message, data = {}) => {
  const membersHtml = (data.teamMembers && Array.isArray(data.teamMembers) && data.teamMembers.length > 0)
    ? `<tr><td colspan="2" style="padding-top:16px;padding-bottom:6px;"><strong style="font-size:14px;color:#475569;">Team Members:</strong></td></tr>
       <tr><td colspan="2">
         <ul style="margin:0;padding-left:20px;list-style-type:disc;">
           ${data.teamMembers.map(m => `<li style="padding:3px 0;font-size:14px;color:#1e293b;"><strong>${m.name}</strong> <span style="font-size:12px;color:#64748b;">— ${m.role || 'Member'}</span></li>`).join('')}
         </ul>
       </td></tr>`
    : '';

  const eventHtml = data.eventName ? `
<div style="background-color:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;margin-top:25px;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr><td colspan="2" style="padding-bottom:15px;"><h3 style="margin:0;font-size:18px;color:#1e293b;">${data.eventName}</h3></td></tr>
    ${data.date ? `<tr><td style="padding:8px 0;font-size:14px;color:#64748b;width:40%;"><strong>Date</strong></td><td style="padding:8px 0;font-size:14px;color:#1e293b;">${data.date}</td></tr>` : ''}
    ${data.time ? `<tr><td style="padding:8px 0;font-size:14px;color:#64748b;"><strong>Time</strong></td><td style="padding:8px 0;font-size:14px;color:#1e293b;">${data.time}</td></tr>` : ''}
    ${data.venue ? `<tr><td style="padding:8px 0;font-size:14px;color:#64748b;"><strong>Venue</strong></td><td style="padding:8px 0;font-size:14px;color:#1e293b;">${data.venue}</td></tr>` : ''}
    ${data.teamName ? `<tr><td style="padding:8px 0;font-size:14px;color:#64748b;"><strong>Team</strong></td><td style="padding:8px 0;font-size:14px;color:#1e293b;">${data.teamName}</td></tr>` : ''}
    ${data.teamLeader ? `<tr><td style="padding:8px 0;font-size:14px;color:#64748b;"><strong>Team Leader</strong></td><td style="padding:8px 0;font-size:14px;color:#1e293b;">${data.teamLeader}</td></tr>` : ''}
    ${data.registrationId ? `<tr><td style="padding:8px 0;font-size:14px;color:#64748b;"><strong>Reg ID</strong></td><td style="padding:8px 0;font-size:14px;font-family:monospace;font-weight:700;color:#c084fc;">${data.registrationId}</td></tr>` : ''}
    ${data.status ? `<tr><td style="padding:8px 0;font-size:14px;color:#64748b;"><strong>Status</strong></td><td style="padding:8px 0;font-size:14px;font-weight:700;color:#10b981;">${data.status}</td></tr>` : ''}
    ${membersHtml}
  </table>
</div>` : '';

  const notesContent = data.instructions || data.customNotes;
  const notesHtml = (notesContent && notesContent !== message) ? `
<div style="background-color:#f8fafc;border-radius:12px;padding:16px;margin-top:20px;border-left:4px solid #c084fc;">
  <p style="margin:0;font-size:14px;color:#334155;line-height:1.5;white-space:pre-line;"><strong>Note / Guidelines:</strong><br>${notesContent}</p>
</div>` : '';

  let actionBtnText = data.actionButtonText || 'View Event';
  let actionBtnUrl = data.actionButtonUrl || (data.eventId ? `${process.env.CLIENT_URL || 'http://localhost:3000'}/workspace/${data.eventId}` : `${process.env.CLIENT_URL || 'http://localhost:3000'}/registrations`);
  let btnGradient = 'linear-gradient(135deg,#c084fc,#a78bfa)';
  let btnShadow = 'rgba(167,139,250,0.4)';

  if (data.isTeamInvite || (data.teamName && !data.isLeader)) {
    actionBtnText = 'Accept Team Invitation';
    actionBtnUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/my-registrations?tab=invitations`;
    btnGradient = 'linear-gradient(135deg,#10b981,#059669)';
    btnShadow = 'rgba(16,185,129,0.35)';
  }

  const btnHtml = (data.eventId || actionBtnUrl) ? `
<div style="text-align:center;margin-top:35px;margin-bottom:10px;">
  <a href="${actionBtnUrl}" style="display:inline-block;background:${btnGradient};color:#ffffff;font-size:16px;font-weight:800;text-decoration:none;padding:15px 36px;border-radius:30px;box-shadow:0 4px 15px ${btnShadow};letter-spacing:0.3px;">${actionBtnText} →</a>
</div>` : '';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:sans-serif;background-color:#fdfbf7;">
  <table width="100%" style="background-color:#fdfbf7;padding:40px 20px;">
    <tr><td align="center">
      <table style="max-width:600px;background-color:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
        <tr><td style="padding:40px 40px 20px;text-align:center;">
          <h1 style="margin:0;font-size:28px;font-weight:700;color:#1e293b;">AVENTO</h1>
          <p style="margin:5px 0 0;color:#64748b;font-size:14px;">Event Management Platform</p>
        </td></tr>
        <tr><td style="padding:0 40px;"><hr style="border:0;border-top:1px solid #f1f5f9;margin:0;"></td></tr>
        <tr><td style="padding:30px 40px;">
          <h2 style="margin:0 0 10px;font-size:24px;color:#1e293b;">${title}</h2>
          <p style="margin:0 0 25px;font-size:16px;color:#64748b;line-height:1.6;">
            ${data.recipientName ? `Hello ${data.recipientName},<br>` : ''}
          </p>
          <p style="margin:0;font-size:16px;color:#334155;line-height:1.6;background-color:#f8fafc;padding:16px;border-radius:12px;border-left:4px solid #c084fc;white-space:pre-line;">${message}</p>
          ${eventHtml}${notesHtml}${btnHtml}
        </td></tr>
        <tr><td style="padding:0 40px 30px;">
          <hr style="border:0;border-top:1px solid #f1f5f9;margin:0 0 20px;">
          <p style="margin:0;font-size:11px;color:#cbd5e1;text-align:center;">
            AVENTO - Smart Campus Event Management | ${new Date().toLocaleString()}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

const notifyUser = async ({ recipientId, recipientEmail, title, message, type = 'info', eventId = null, emailSubject, emailData = {}, attachments }) => {
  try {
    await sendInAppNotification({ recipientId, title, message, type, eventId });

    let targetEmail = recipientEmail;
    let targetName = null;

    if (!targetEmail && recipientId) {
      try {
        const { data: profile } = await supabase
          .from('profiles').select('email, name').eq('id', recipientId).maybeSingle();
        if (profile && profile.email) {
          targetEmail = profile.email;
          targetName = profile.name;
        }
      } catch (e) {}
    }

    const emailEnabled = process.env.EMAIL_NOTIFICATIONS_ENABLED !== 'false' && BREVO_API_KEY;

    if (!targetEmail) {
      console.log('[NOTIFY] No email found for user', recipientId);
      return;
    }

    if (emailEnabled) {
      const htmlBody = generateEmailHtml(title, message, {
        eventId,
        recipientName: targetName,
        timestamp: new Date().toLocaleString(),
        ...emailData
      });
      await sendEmailNotification({ recipientEmail: targetEmail, subject: emailSubject || title, htmlBody, attachments: attachments || emailData?.attachments });
    }
  } catch (err) {
    console.error('[NOTIFY] Error:', err.message);
  }
};

const getEmailStats = () => {
  resetDailyCount();
  return { sentToday: emailCountToday, dailyLimit: 300, remaining: 300 - emailCountToday, configured: !!BREVO_API_KEY };
};

module.exports = {
  sendInAppNotification,
  sendEmailNotification,
  sendPasswordResetEmail,
  verifySMTPConnection,
  notifyUser,
  getEmailStats
};
