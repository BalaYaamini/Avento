const cron = require('node-cron');
const supabase = require('../config/supabaseClient');
const { notifyUser } = require('../services/notificationService');

const startRegistrationClosingJob = () => {
  // Run every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    try {
      const now = new Date().toISOString();

      // Find events where the registration deadline has passed and we have pending registrations
      // Unfortunately, we have to do this in two steps or via a join since we want to find pending regs for expired events
      const { data: eligibleEvents, error: eventErr } = await supabase
        .from('events')
        .select('id, title, registration_deadline')
        .not('registration_deadline', 'is', null)
        .lt('registration_deadline', now);

      if (eventErr) {
        console.error('[RegistrationClosingJob] Error fetching eligible events:', eventErr.message);
        return;
      }

      if (!eligibleEvents || eligibleEvents.length === 0) {
        return;
      }

      const eventIds = eligibleEvents.map(e => e.id);

      // Find all pending registrations for these events
      const { data: pendingRegs, error: regErr } = await supabase
        .from('event_registrations')
        .select('id, user_id, event_id, team_id, teams:event_teams(name)')
        .eq('status', 'pending')
        .in('event_id', eventIds);

      if (regErr) {
        console.error('[RegistrationClosingJob] Error fetching pending registrations:', regErr.message);
        return;
      }

      if (!pendingRegs || pendingRegs.length === 0) {
        return;
      }

      console.log(`[RegistrationClosingJob] Found ${pendingRegs.length} pending invitation(s) to expire across ${eligibleEvents.length} event(s).`);

      const regIds = pendingRegs.map(r => r.id);

      // Update status to 'expired' (or delete them, depending on preference. Let's delete them to clean up the table as 'rejected' does)
      const { error: delErr } = await supabase
        .from('event_registrations')
        .delete()
        .in('id', regIds);

      if (delErr) {
        console.error('[RegistrationClosingJob] Error deleting expired invitations:', delErr.message);
      } else {
        console.log(`[RegistrationClosingJob] Successfully expired and removed ${pendingRegs.length} invitation(s).`);
      }

      // We should also check if any teams now fall below the minimum team size. 
      // The requirement states "Teams become finalized with the members who accepted before the deadline."
      // For now, we will simply leave the teams as they are, finalizing them with whatever members have accepted.

      // Send notifications to the users that their invitation expired
      for (const reg of pendingRegs) {
        const event = eligibleEvents.find(e => e.id === reg.event_id);
        const teamName = reg.teams?.name || 'a team';
        try {
          await notifyUser({
            recipientId: reg.user_id,
            title: 'Team Invitation Expired',
            message: `Your invitation to join "${teamName}" for the event "${event.title}" has expired because the registration deadline passed.`,
            type: 'warning',
            eventId: event.id,
            emailSubject: `Invitation Expired – ${event.title}`,
            emailData: {
              eventName: event.title,
              date: new Date().toLocaleDateString(),
              status: 'Expired',
              instructions: "The registration closing date has passed, and your pending invitation was automatically cancelled."
            }
          });
        } catch (e) {
          console.error('[RegistrationClosingJob] Error notifying user about expiration:', e.message);
        }
      }

    } catch (err) {
      console.error('[RegistrationClosingJob] Unexpected error during execution:', err.message);
    }
  });

  console.log('🕒 Registration Closing Cron Job initialized (runs every 10 minutes).');
};

module.exports = startRegistrationClosingJob;
