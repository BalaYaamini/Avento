const nodemailer = require('nodemailer');
const supabase = require('../config/supabaseClient');
const path = require('path');

/**
 * Configure Nodemailer Transporter for Gmail SMTP
 * Supports both personal Gmail and Google Workspace (college) accounts
 */
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  // Increase timeout for bulk sends
  connectionTimeout: 10000,
  greetingTimeout: 5000,
  socketTimeout: 10000,
});

/**
 * Verify SMTP connection on startup
 */
const verifySMTPConnection = async () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('[EMAIL] SMTP not configured - emails will be logged only');
    return false;
  }
  
  try {
    await transporter.verify();
    console.log(`[EMAIL] SMTP connected successfully via ${process.env.EMAIL_USER}`);
    return true;
  } catch (err) {
    console.error('[EMAIL] SMTP connection failed:', err.message);
    console.warn('[EMAIL] Emails will be logged only. Check EMAIL_USER and EMAIL_PASS in .env');
    return false;
  }
};

/**
 * Sends an email notification via Gmail SMTP.
 * Falls back to mock logging if SMTP isn't configured.
 */
const sendEmailNotification = async ({ recipientEmail, subject, htmlBody }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`[EMAIL MOCK] To: ${recipientEmail} | Subject: ${subject}`);
    return;
  }

  try {
    const mailOptions = {
      from: `"Avento" <${process.env.EMAIL_USER}>`,
      to: recipientEmail,
      subject: subject,
      html: htmlBody,
      // Prevent emails from going to spam
      headers: {
        'X-Mailer': 'Avento-EventManagement',
        'List-Unsubscribe': `<mailto:${process.env.EMAIL_USER}?subject=unsubscribe>`,
      },
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL SENT] To: ${recipientEmail} | Subject: ${subject} | ID: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error(`[EMAIL FAILED] To: ${recipientEmail} | Error: ${err.message}`);
    // Don't throw - email failure shouldn't break the app
  }
};

/**
 * Sends bulk emails with rate limiting (2,000/day Gmail limit)
 * Returns summary of sent/failed emails
 */
const sendBulkEmails = async (emails) => {
  const results = { sent: 0, failed: 0, errors: [] };
  
  for (const email of emails) {
    try {
      await sendEmailNotification(email);
      results.sent++;
      // Small delay to avoid hitting rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (err) {
      results.failed++;
      results.errors.push({ email: email.recipientEmail, error: err.message });
    }
  }
  
  return results;
};

/**
 * Creates an in-app notification in the database.
 */
const sendInAppNotification = async ({ recipientId, title, message, type = 'info', eventId = null }) => {
  try {
    const notifData = {
      recipient_id: recipientId,
      title,
      message,
      type,
      created_at: new Date().toISOString()
    };
    
    if (eventId) {
      notifData.event_id = eventId;
    }

    const { error } = await supabase.from('notifications').insert(notifData);
    
    if (error) {
      // If table doesn't exist yet, gracefully fail rather than crashing the request
      if (error.code === '42P01') { 
        console.warn('Notifications table does not exist. Please run the SQL patch.');
      } else {
        throw error;
      }
    }
  } catch (err) {
    console.error('Error creating in-app notification:', err.message);
  }
};

/**
 * Generates branded HTML for the notification email.
 * Accepts optional data to populate dynamic sections.
 */
const generateEmailHtml = (title, message, data = {}) => {
  const eventHtml = data.eventName ? `
<div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; margin-top: 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.02);">
  <table width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td colspan="2" style="padding-bottom: 15px;">
        <h3 style="margin: 0; font-size: 18px; color: #1e293b;">${data.eventName}</h3>
      </td>
    </tr>
    ${data.date ? `<tr><td style="padding: 8px 0; font-size: 14px; color: #64748b; width: 40%;"><strong>Date</strong></td><td style="padding: 8px 0; font-size: 14px; color: #1e293b;">${data.date}</td></tr>` : ''}
    ${data.time ? `<tr><td style="padding: 8px 0; font-size: 14px; color: #64748b;"><strong>Time</strong></td><td style="padding: 8px 0; font-size: 14px; color: #1e293b;">${data.time}</td></tr>` : ''}
    ${data.venue ? `<tr><td style="padding: 8px 0; font-size: 14px; color: #64748b;"><strong>Venue</strong></td><td style="padding: 8px 0; font-size: 14px; color: #1e293b;">${data.venue}</td></tr>` : ''}
    ${data.category ? `<tr><td style="padding: 8px 0; font-size: 14px; color: #64748b;"><strong>Category</strong></td><td style="padding: 8px 0; font-size: 14px; color: #1e293b;">${data.category}</td></tr>` : ''}
    ${data.proposedDate ? `<tr><td style="padding: 8px 0; font-size: 14px; color: #64748b;"><strong>Proposed Date</strong></td><td style="padding: 8px 0; font-size: 14px; color: #1e293b;">${data.proposedDate}</td></tr>` : ''}
    ${data.organizer ? `<tr><td style="padding: 8px 0; font-size: 14px; color: #64748b;"><strong>Organizer</strong></td><td style="padding: 8px 0; font-size: 14px; color: #1e293b;">${data.organizer}</td></tr>` : ''}
    ${data.facultyCoordinatorName ? `<tr><td style="padding: 8px 0; font-size: 14px; color: #64748b;"><strong>Coordinator</strong></td><td style="padding: 8px 0; font-size: 14px; color: #1e293b;">${data.facultyCoordinatorName}</td></tr>` : ''}
    ${data.submissionTime ? `<tr><td style="padding: 8px 0; font-size: 14px; color: #64748b;"><strong>Submitted</strong></td><td style="padding: 8px 0; font-size: 14px; color: #1e293b;">${data.submissionTime}</td></tr>` : ''}
    ${data.publishDate ? `<tr><td style="padding: 8px 0; font-size: 14px; color: #64748b;"><strong>Publish Date</strong></td><td style="padding: 8px 0; font-size: 14px; color: #1e293b;">${data.publishDate}</td></tr>` : ''}
    ${data.teamName ? `<tr><td style="padding: 8px 0; font-size: 14px; color: #64748b;"><strong>Team Name</strong></td><td style="padding: 8px 0; font-size: 14px; color: #1e293b;">${data.teamName}</td></tr>` : ''}
    ${data.teamLeader ? `<tr><td style="padding: 8px 0; font-size: 14px; color: #64748b;"><strong>Team Leader</strong></td><td style="padding: 8px 0; font-size: 14px; color: #1e293b;">${data.teamLeader}</td></tr>` : ''}
    ${data.registrationId ? `<tr><td style="padding: 8px 0; font-size: 14px; color: #64748b;"><strong>Reg ID</strong></td><td style="padding: 8px 0; font-size: 14px; font-family: monospace; font-weight: 700; color: #c084fc;">${data.registrationId}</td></tr>` : ''}
    ${data.status ? `<tr><td style="padding: 8px 0; font-size: 14px; color: #64748b;"><strong>Status</strong></td><td style="padding: 8px 0; font-size: 14px; font-weight: 700; color: #10b981;">${data.status}</td></tr>` : ''}
  </table>
</div>
  ` : '';

  const notesHtml = (data.instructions || data.refundNotes || data.nextSteps) ? `
<div style="background-color: #f8fafc; border-radius: 12px; padding: 16px; margin-top: 20px; border-left: 4px solid #c084fc;">
  <p style="margin: 0; font-size: 14px; color: #334155; line-height: 1.5;"><strong>Important Notes:</strong><br>${data.instructions || data.refundNotes || data.nextSteps}</p>
</div>
  ` : '';

  const teamHtml = (data.teamMembers && Array.isArray(data.teamMembers) && data.teamMembers.length > 0) ? `
<div style="margin-top: 25px;">
  <h4 style="margin: 0 0 10px 0; font-size: 16px; color: #1e293b;">Registered Team Members</h4>
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse; font-size: 14px; text-align: left; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
    <thead>
      <tr style="background-color: #f1f5f9; border-bottom: 2px solid #e2e8f0;">
        <th style="padding: 12px 10px; color: #475569; font-weight: 600;">Name</th>
        <th style="padding: 12px 10px; color: #475569; font-weight: 600;">Email</th>
        <th style="padding: 12px 10px; color: #475569; font-weight: 600;">Role</th>
      </tr>
    </thead>
    <tbody>
      ${data.teamMembers.map((member, i) => `
      <tr style="border-bottom: 1px solid #e2e8f0; background-color: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding: 12px 10px; color: #1e293b;">${member.name}</td>
        <td style="padding: 12px 10px; color: #64748b;">${member.email || 'N/A'}</td>
        <td style="padding: 12px 10px; font-weight: ${member.role === 'Team Lead' ? '700' : '500'}; color: ${member.role === 'Team Lead' ? '#c084fc' : '#334155'};">${member.role}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>
</div>
  ` : '';

  const btnHtml = data.eventId ? `
<div style="text-align: center; margin-top: 40px;">
  <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/workspace/${data.eventId}" style="display: inline-block; background: linear-gradient(135deg, #c084fc, #a78bfa); color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 30px; box-shadow: 0 4px 15px rgba(167, 139, 250, 0.4);">
    View Event
  </a>
</div>
  ` : `
<div style="text-align: center; margin-top: 40px;">
  <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}" style="display: inline-block; background: linear-gradient(135deg, #c084fc, #a78bfa); color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 30px; box-shadow: 0 4px 15px rgba(167, 139, 250, 0.4);">
    Open AVENTO
  </a>
</div>
  `;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Avento Notification</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Quicksand', 'Nunito', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fdfbf7; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fdfbf7; padding: 40px 20px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <img src="https://joekmqnkpfjuptcgzpmh.supabase.co/storage/v1/object/public/public-assets/avento-logo-public.png" alt="Avento Logo" width="60" style="display: block; margin: 0 auto 15px auto; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #1e293b; letter-spacing: 0.5px;">AVENTO</h1>
              <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px; font-weight: 500;">Event Management Platform</p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 0;">
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 30px 40px;">
              <h2 style="margin: 0 0 10px 0; font-size: 24px; color: #1e293b; font-weight: 700;">${title}</h2>
              <p style="margin: 0 0 25px 0; font-size: 16px; color: #64748b; line-height: 1.6;">
                ${data.recipientName ? `Hello ${data.recipientName},<br>` : ''}Thank you for using AVENTO.<br>Here's an update regarding your event.
              </p>
              
              <p style="margin: 0; font-size: 16px; color: #334155; line-height: 1.6; background-color: #f8fafc; padding: 16px; border-radius: 12px; border-left: 4px solid #c084fc;">
                ${message}
              </p>

              ${eventHtml}
              ${teamHtml}
              ${notesHtml}

              ${btnHtml}

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 0 0 20px 0;">
              <p style="margin: 0 0 5px 0; font-size: 14px; font-weight: 700; color: #94a3b8; text-align: center;">
                AVENTO
              </p>
              <p style="margin: 0 0 15px 0; font-size: 12px; color: #94a3b8; text-align: center;">
                Smart Campus Event Management
              </p>
              <p style="margin: 0; font-size: 11px; color: #cbd5e1; text-align: center; line-height: 1.5;">
                This is an automated notification generated by AVENTO.<br>
                Please do not reply to this email.<br><br>
                Timestamp: ${data.timestamp || new Date().toLocaleString()}<br>
                © ${new Date().getFullYear()} AVENTO. All Rights Reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

/**
 * Unified function to notify a user via both In-App and Email.
 * Fetches user email from MongoDB (primary) or Supabase profiles (fallback).
 */
const notifyUser = async ({ recipientId, recipientEmail, title, message, type = 'info', eventId = null, emailSubject, emailBody, emailData = {} }) => {
  try {
    // 1. Send In-App Notification (awaits to ensure it completes before HTTP response if needed)
    await sendInAppNotification({ recipientId, title, message, type, eventId });

    // 2. Resolve Email Address if not provided
    let targetEmail = recipientEmail;
    let targetName = null;
    
    if (!targetEmail && recipientId) {
      // Try MongoDB first (primary source)
      try {
        const User = require('../models/User');
        const mongoUser = await User.findById(recipientId).select('name email');
        if (mongoUser && mongoUser.email) {
          targetEmail = mongoUser.email;
          targetName = mongoUser.name;
          console.log(`[EMAIL DEBUG] Found email in MongoDB: ${targetEmail}`);
        }
      } catch (err) {
        console.log(`[EMAIL DEBUG] MongoDB lookup failed: ${err.message}`);
      }

      // Fallback to Supabase profiles
      if (!targetEmail) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email, name')
            .eq('id', recipientId)
            .single();
          
          if (profile && profile.email) {
            targetEmail = profile.email;
            targetName = profile.name;
            console.log(`[EMAIL DEBUG] Found email in profiles: ${targetEmail}`);
          }
        } catch (err) {
          console.log(`[EMAIL DEBUG] Profiles lookup failed: ${err.message}`);
        }
      }
    }

    // 3. Send Email Notification Asynchronously (fire and forget)
    const emailEnabled = process.env.EMAIL_NOTIFICATIONS_ENABLED !== 'false' && 
                         process.env.EMAIL_USER && process.env.EMAIL_PASS;

    console.log(`[EMAIL DEBUG] emailEnabled=${emailEnabled}, targetEmail=${targetEmail}, EMAIL_NOTIFICATIONS_ENABLED=${process.env.EMAIL_NOTIFICATIONS_ENABLED}`);

    if (targetEmail && emailEnabled) {
      const finalSubject = emailSubject || title;
      const finalBody = emailBody || generateEmailHtml(title, message, {
        eventId: eventId,
        recipientName: targetName,
        timestamp: new Date().toLocaleString(),
        ...emailData
      });
      
      console.log(`[EMAIL DEBUG] Sending email to ${targetEmail} with subject: ${finalSubject}`);
      
      // Fire and forget - don't await
      sendEmailNotification({
        recipientEmail: targetEmail,
        subject: finalSubject,
        htmlBody: finalBody
      }).catch(err => console.error('[EMAIL] Background delivery failed:', err.message));
    } else {
      console.log(`[EMAIL DEBUG] Email not sent - targetEmail: ${targetEmail}, emailEnabled: ${emailEnabled}`);
    }
  } catch (err) {
    console.error('[NOTIFY] Non-fatal error in notifyUser:', err.message);
  }
};

module.exports = {
  sendInAppNotification,
  sendEmailNotification,
  sendBulkEmails,
  verifySMTPConnection,
  notifyUser
};
