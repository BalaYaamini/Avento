const cron = require('node-cron');
const supabase = require('../config/supabaseClient');
const { sendEventReminderEmail } = require('../services/reminderEmailService');

const REMINDER_WINDOW_MS = 3 * 60 * 60 * 1000;
// If the server was down/asleep during the whole pre-session window, still send
// shortly after the session start instead of silently skipping forever.
const CATCHUP_GRACE_MS = 30 * 60 * 1000;
const CONFIRMED_STATUSES = ['registered', 'confirmed'];
const REMINDABLE_EVENT_STATUSES = ['published', 'active'];

const parseSlotStart = (slot, event) => {
  const t = String(slot?.start_time || '').substring(0, 5);
  let d = String(slot?.slot_date || '').substring(0, 10);
  // Slots created without a date fall back to the event's date so their
  // registrants still get reminders instead of being silently skipped.
  if (!d && event?.date) {
    const eventDay = new Date(event.date);
    if (!isNaN(eventDay.getTime())) {
      d = `${eventDay.getFullYear()}-${String(eventDay.getMonth() + 1).padStart(2, '0')}-${String(eventDay.getDate()).padStart(2, '0')}`;
    }
  }
  if (!d || !t) return null;
  const date = new Date(`${d}T${t}`);
  return isNaN(date.getTime()) ? null : date;
};

const isWithinReminderWindow = (start, now, windowEnd) =>
  start && start.getTime() > now.getTime() && start.getTime() <= windowEnd.getTime();

const isWithinCatchupWindow = (start, now) =>
  start && start.getTime() <= now.getTime() && start.getTime() > now.getTime() - CATCHUP_GRACE_MS;

let isSweepRunning = false;

const runReminderSweep = async () => {
  if (isSweepRunning) {
    console.log('[EventReminderJob] Previous sweep still running - skipping this tick.');
    return;
  }
  isSweepRunning = true;

  try {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MS);
    const nowISO = now.toISOString();
    const windowEndISO = windowEnd.toISOString();

    // ── 1. Candidate slot sessions starting within the reminder window ──
    const { data: slots, error: slotErr } = await supabase
      .from('event_slots')
      .select('id, event_id, slot_name, slot_date, start_time, end_time, venue_room, status, event:events(*)');

    if (slotErr) throw slotErr;

    const slotSessions = new Map();
    for (const slot of slots || []) {
      if (slot.status === 'inactive') continue;
      const event = slot.event;
      if (!event || !REMINDABLE_EVENT_STATUSES.includes(event.status)) continue;
      const start = parseSlotStart(slot, event);
      const inWindow = isWithinReminderWindow(start, now, windowEnd);
      const inCatchup = isWithinCatchupWindow(start, now);
      if (!inWindow && !inCatchup) continue;
      slotSessions.set(slot.id, { slot, event, start, late: !inWindow });
    }

    // ── 2. Candidate event-date sessions (non-slot events + slot-less regs) ──
    const { data: windowEvents, error: eventErr } = await supabase
      .from('events')
      .select('*')
      .in('status', REMINDABLE_EVENT_STATUSES)
      .gte('date', new Date(now.getTime() - CATCHUP_GRACE_MS).toISOString())
      .lte('date', windowEndISO);

    if (eventErr) throw eventErr;

    const eventSessions = new Map();
    const eventById = new Map();
    for (const entry of slotSessions.values()) {
      eventById.set(entry.event.id, entry.event);
    }
    for (const event of windowEvents || []) {
      eventById.set(event.id, event);
      const start = new Date(event.date);
      const inWindow = isWithinReminderWindow(start, now, windowEnd);
      const inCatchup = isWithinCatchupWindow(start, now);
      if (inWindow || inCatchup) {
        eventSessions.set(event.id, { event, start, late: !inWindow });
      }
    }

    const candidateEventIds = [...new Set([
      ...[...slotSessions.values()].map(s => s.event.id),
      ...[...eventSessions.keys()]
    ])];
    if (candidateEventIds.length === 0) return;

    // ── 3. Confirmed registrations for the candidate events ──
    const { data: regs, error: regErr } = await supabase
      .from('event_registrations')
      .select('id, user_id, event_id, team_id, slot_id, status, reminder_sent_at, reminder_sent_for_start, team:event_teams(id, name, slot_id)')
      .in('event_id', candidateEventIds)
      .in('status', CONFIRMED_STATUSES);

    if (regErr) throw regErr;
    if (!regs || regs.length === 0) return;

    const userIds = [...new Set(regs.map(r => r.user_id).filter(Boolean))];
    const profileById = new Map();
    if (userIds.length > 0) {
      const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds);
      if (profErr) throw profErr;
      for (const p of profiles || []) profileById.set(p.id, p);
    }

    // ── 4. Resolve each registration's session and send once per session ──
    let dueCount = 0;
    let sentCount = 0;
    let failedCount = 0;

    for (const reg of regs) {
      const teamSlotId = reg.team?.slot_id || null;
      const ownSlotId = reg.slot_id || null;
      // For team registrations the team's slot is the source of truth
      // (mirrors the event pass resolution logic).
      const effectiveSlotId = reg.team_id ? (teamSlotId || ownSlotId) : (ownSlotId || teamSlotId);

      let session = null;
      if (effectiveSlotId) {
        session = slotSessions.get(effectiveSlotId) || null;
        // The registration's own slot is outside the window (or inactive):
        // its reminder must fire at that slot's time, not now.
        if (!session) continue;
      } else {
        session = eventSessions.get(reg.event_id) || null;
        if (!session) continue;
      }

      const { event, slot, start, late } = session;
      // Automated sending is opt-in per event: reminders go out 3 hours before
      // a session only when the organizer explicitly enabled auto_send.
      // Manual, date-based sending ignores this flag.
      const reminderConfig = event.reminder_email_config || {};
      if (reminderConfig.enabled === false || reminderConfig.auto_send !== true) continue;

      const sessionStartISO = start.toISOString();
      // Strictly once per registration: re-evaluating the live schedule each
      // sweep means a rescheduled session simply fires at its new time before
      // the reminder is sent, and a sent reminder is never repeated.
      if (reg.reminder_sent_at) continue;

      // Atomic claim so overlapping runs can never double-send.
      const { data: claimed, error: claimErr } = await supabase
        .from('event_registrations')
        .update({ reminder_sent_at: nowISO, reminder_sent_for_start: sessionStartISO })
        .eq('id', reg.id)
        .is('reminder_sent_at', null)
        .select('id');
      if (claimErr) {
        console.error(`[EventReminderJob] Claim failed for registration ${reg.id}:`, claimErr.message);
        continue;
      }
      if (!claimed || claimed.length === 0) continue;

      dueCount++;
      const profile = profileById.get(reg.user_id) || null;
      const rollbackClaim = async (reason) => {
        failedCount++;
        console.error(`[EventReminderJob] Reminder FAILED for registration ${reg.id} (${event.title}): ${reason} - will retry next sweep.`);
        // Roll back the claim so the next sweep retries this reminder.
        await supabase
          .from('event_registrations')
          .update({ reminder_sent_at: null, reminder_sent_for_start: null })
          .eq('id', reg.id);
      };

      try {
        const result = await sendEventReminderEmail({
          registration: reg,
          event,
          slot: slot || null,
          teamName: reg.team?.name || null,
          profile,
          config: event.reminder_email_config || {},
          late: Boolean(late)
        });
        if (result && result.ok === false) {
          await rollbackClaim(result.error || 'Email delivery failed');
        } else {
          sentCount++;
          console.log(`[EventReminderJob] Reminder sent for registration ${reg.id} (${event.title}) via ${result?.channel || 'unknown'}${late ? ' [catch-up]' : ''}.`);
        }
      } catch (sendErr) {
        await rollbackClaim(sendErr.message);
      }
    }

    if (dueCount > 0) {
      console.log(`[EventReminderJob] Sweep done: ${dueCount} due, ${sentCount} sent, ${failedCount} failed (will retry).`);
    }
  } catch (err) {
    const missingColumn = /reminder_sent_at|reminder_email_config|schema cache/i.test(err.message || '');
    if (missingColumn) {
      console.error('[EventReminderJob] Missing reminder columns - run supabase-patch-v57-event-reminders.sql on this database.');
    } else {
      console.error('[EventReminderJob] Sweep error:', err.message);
    }
  } finally {
    isSweepRunning = false;
  }
};

const startEventReminderJob = () => {
  cron.schedule('*/5 * * * *', () => {
    runReminderSweep();
  });
  console.log('⏰ Event Reminder Cron Job initialized (runs every 5 minutes).');
};

module.exports = startEventReminderJob;
module.exports.runReminderSweep = runReminderSweep;
