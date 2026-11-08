const {
  sendEmailNotification,
  sendInAppNotification,
  emailBrandHeader
} = require('./notificationService');

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

const fmtDate = (value) => {
  if (!value) return 'TBA';
  const d = String(value).includes('T')
    ? new Date(value)
    : new Date(String(value).substring(0, 10) + 'T00:00:00');
  return isNaN(d.getTime())
    ? 'TBA'
    : d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
};

const fmtTime = (t) => (t ? String(t).substring(0, 5) : '');

const buildRegIdShort = (registrationId) =>
  `AVT-${String(registrationId || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8) || 'PENDING'}`;

const buildSessionDetails = (event, slot, sessionStart) => {
  const hasSlot = Boolean(slot && slot.slot_date);
  const eventHasTime = /T\d{2}:\d{2}/.test(String(event?.date || ''));

  const dateText = hasSlot ? fmtDate(slot.slot_date) : fmtDate(event?.date);
  const timeText = hasSlot && slot.start_time && slot.end_time
    ? `${fmtTime(slot.start_time)} - ${fmtTime(slot.end_time)}`
    : eventHasTime
      ? new Date(event.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      : 'TBA';
  const reportingText = sessionStart && !isNaN(sessionStart.getTime())
    ? sessionStart.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : timeText;

  const venueRoom = hasSlot ? String(slot.venue_room || '').trim() : '';
  const venueBase = (event?.venue || 'Venue TBD').trim();
  const venueText = venueRoom && venueRoom.toLowerCase() !== venueBase.toLowerCase()
    ? `${venueBase}, ${venueRoom}`
    : venueBase;

  return {
    dateText,
    timeText,
    reportingText,
    venueText,
    slotName: hasSlot ? (slot.slot_name || 'Slot') : null
  };
};

const applyTags = (text, map) => {
  let out = String(text || '');
  for (const [key, value] of Object.entries(map)) {
    out = out.split(`{{${key}}}`).join(value || '');
  }
  return out;
};

const buildTagMap = ({ event, details, recipientName, teamName }) => ({
  eventName: event?.title || 'your event',
  recipientName: recipientName || 'there',
  date: details.dateText,
  time: details.timeText,
  reportingTime: details.reportingText,
  venue: details.venueText,
  slotName: details.slotName || '',
  teamName: teamName || ''
});

const buildReminderEmailHtml = ({ recipientName, event, details, teamName, message }) => {
  const rows = [
    ['Date', details.dateText],
    ['Session Time', details.timeText],
    ['Reporting Time', details.reportingText],
    ['Venue', details.venueText],
    details.slotName ? ['Slot', `<span style="color:#0891b2;font-weight:700;">${details.slotName}</span>`] : null,
    teamName ? ['Team', teamName] : null
  ].filter(Boolean);

  const rowsHtml = rows.map(([label, value]) => `
    <tr>
      <td style="padding:8px 0;font-size:14px;color:#64748b;width:38%;"><strong>${label}</strong></td>
      <td style="padding:8px 0;font-size:14px;color:#1e293b;">${value}</td>
    </tr>`).join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:sans-serif;background-color:#fdfbf7;">
  <table width="100%" style="background-color:#fdfbf7;padding:40px 20px;">
    <tr><td align="center">
      <table style="max-width:600px;background-color:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
        <tr><td style="padding:40px 40px 20px;text-align:center;">
          ${emailBrandHeader('Event Reminder')}
        </td></tr>
        <tr><td style="padding:0 40px;"><hr style="border:0;border-top:1px solid #f1f5f9;margin:0;"></td></tr>
        <tr><td style="padding:30px 40px;">
          <h2 style="margin:0 0 10px;font-size:24px;color:#1e293b;">Your event is coming up!</h2>
          <p style="margin:0;font-size:16px;color:#334155;line-height:1.6;background-color:#f8fafc;padding:16px;border-radius:12px;border-left:4px solid #0891b2;white-space:pre-line;">${message}</p>

          <div style="background-color:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;margin-top:25px;">
            <table width="100%" border="0" cellspacing="0" cellpadding="0">
              <tr><td colspan="2" style="padding-bottom:15px;"><h3 style="margin:0;font-size:18px;color:#1e293b;">${event?.title || 'Event'}</h3></td></tr>
              ${rowsHtml}
            </table>
          </div>

          <div style="margin-top:25px;border-radius:16px;padding:24px;background:linear-gradient(135deg,#0f766e,#0d9488);text-align:center;">
            <p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;text-color:#ffffff;color:#ccfbf1;font-weight:700;">EVENT ENTRY PASS</p>
            <p style="margin:0;font-size:12px;color:#ccfbf1;">Open your pass with the button below and show the QR code at the venue check-in desk.</p>
          </div>

          <div style="text-align:center;margin-top:35px;margin-bottom:10px;">
            <a href="${CLIENT_URL}/my-registrations" style="display:inline-block;background:linear-gradient(135deg,#06b6d4,#0891b2);color:#ffffff;font-size:16px;font-weight:800;text-decoration:none;padding:15px 36px;border-radius:30px;box-shadow:0 4px 15px rgba(6,182,212,0.4);letter-spacing:0.3px;">View My Pass</a>
          </div>
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

const DEFAULT_SUBJECT = 'Reminder: {{eventName}} is coming up';
const LATE_SUBJECT = 'Reminder: {{eventName}} is starting shortly';
const DEFAULT_MESSAGE = (recipientName) =>
  `Hi ${recipientName || 'there'},\n\nThis is a friendly reminder that your session is coming up soon. Please find your session details and event pass below. Keep this email handy and show the QR code at the check-in desk.\n\nPlease report to the venue on time.\n\nSee you there!\n- Team Avento`;
const LATE_MESSAGE = (recipientName) =>
  `Hi ${recipientName || 'there'},\n\nThis is a friendly reminder that your event is starting shortly. Please find your session details and event pass below. Keep this email handy and show the QR code at the check-in desk.\n\nPlease report to the venue right away.\n\nSee you there!\n- Team Avento`;

const sendEventReminderEmail = async ({ registration, event, slot, teamName, profile, config, isTest = false, late = false }) => {
  const sessionStart = slot && slot.slot_date && slot.start_time
    ? new Date(`${String(slot.slot_date).substring(0, 10)}T${fmtTime(slot.start_time)}:00`)
    : new Date(event.date);

  const details = buildSessionDetails(event, slot, sessionStart);
  const recipientName = profile?.name || '';
  const tagMap = buildTagMap({ event, details, recipientName, teamName });

  const useCustom = config?.mode === 'custom' && String(config?.body || '').trim();
  const message = useCustom
    ? applyTags(config.body, tagMap)
    : late
      ? LATE_MESSAGE(recipientName)
      : DEFAULT_MESSAGE(recipientName);
  const subject = String(config?.subject || '').trim()
    ? applyTags(config.subject, tagMap)
    : applyTags(late ? LATE_SUBJECT : DEFAULT_SUBJECT, tagMap);
  const finalSubject = isTest ? `[TEST] ${subject}` : subject;

  const htmlBody = buildReminderEmailHtml({
    recipientName,
    event,
    details,
    teamName,
    message
  });

  let delivery = { ok: true, channel: 'none' };
  if (profile?.email) {
    delivery = await sendEmailNotification({
      recipientEmail: profile.email,
      subject: finalSubject,
      htmlBody
    }) || { ok: false, channel: 'none', error: 'Email service returned no result' };

    // Failed delivery: report it so the caller can roll back its claim and
    // retry on the next sweep instead of silently losing the reminder.
    if (!delivery.ok) {
      return { ok: false, channel: delivery.channel, error: delivery.error || 'Email delivery failed' };
    }
  }

  if (registration.user_id && !isTest) {
    await sendInAppNotification({
      recipientId: registration.user_id,
      title: `Reminder: ${event.title}`,
      message: `Your session "${details.slotName || event.title}" starts at ${details.reportingText} on ${details.dateText} at ${details.venueText}.`,
      type: 'info',
      eventId: event.id
    });
  }

  return { ok: true, channel: delivery.channel || 'none' };
};

module.exports = {
  sendEventReminderEmail,
  buildSessionDetails,
  buildRegIdShort
};
