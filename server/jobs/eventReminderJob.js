const cron = require('node-cron');
const supabase = require('../config/supabaseClient');
const { sendEventReminderEmail } = require('../services/reminderEmailService');

const REMINDER_WINDOW_MS = 3 * 60 * 60 * 1000;
const CONFIRMED_STATUSES = ['registered', 'confirmed'];
const REMINDABLE_EVENT_STATUSES = ['published', 'active'];

const parseSlotStart = (slot) => {
  const d = String(slot?.slot_date || '').substring(0, 10);
  const t = String(slot?.start_time || '').substring(0, 5);
  if (!d || !t) return null;
  const date = new Date(`${d}T${t}`);
  return isNaN(date.getTime()) ? null : date;
};

const isWithinReminderWindow = (start, now, windowEnd) =>
  start && start.getTime() > now.getTime() && start.getTime() <= windowEnd.getTime();

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
      .select('id, event_id, slot_name, slot_date, start_time, end_time, venue_room, status, event:events(*)')
      .neq('status', 'inactive');

    if (slotErr) throw slotErr;

    const slotSessions = new Map();
    for (const slot of slots || []) {
      const event = slot.event;
      if (!event || !REMINDABLE_EVENT_STATUSES.includes(event.status)) continue;
      const start = parseSlotStart(slot);
      if (!isWithinReminderWindow(start, now, windowEnd)) continue;
      slotSessions.set(slot.id, { slot, event, start });
    }

    // ── 2. Candidate event-date sessions (non-slot events + slot-less regs) ──
    const { data: windowEvents, error: eventErr } = await supabase
      .from('events')
      .select('*')
      .in('status', REMINDABLE_EVENT_STATUSES)
      .gte('date', nowISO)
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
      if (isWithinReminderWindow(start, now, windowEnd)) {
        eventSessions.set(event.id, { event, start });
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

      const { event, slot, start } = session;
      if (event.reminder_email_config && event.reminder_email_config.enabled === false) continue;

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

      try {
        await sendEventReminderEmail({
          registration: reg,
          event,
          slot: slot || null,
          teamName: reg.team?.name || null,
          profile: profileById.get(reg.user_id) || null,
          config: event.reminder_email_config || {}
        });
        console.log(`[EventReminderJob] Reminder sent for registration ${reg.id} (${event.title}).`);
      } catch (sendErr) {
        console.error(`[EventReminderJob] Send failed for registration ${reg.id}:`, sendErr.message);
        // Roll back the claim so the next sweep retries this reminder.
        await supabase
          .from('event_registrations')
          .update({
            reminder_sent_at: reg.reminder_sent_at || null,
            reminder_sent_for_start: reg.reminder_sent_for_start || null
          })
          .eq('id', reg.id);
      }
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
