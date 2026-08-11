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

      // Check if any teams now fall below the minimum team size and disqualify them
      const { data: allEventTeams, error: teamErr } = await supabase
        .from('event_teams')
        .select('*, events(id, title, min_team_size), event_registrations(user_id, status)')
        .in('event_id', eventIds);

      if (teamErr) {
        console.error('[RegistrationClosingJob] Error fetching teams for disqualification check:', teamErr.message);
      } else if (allEventTeams && allEventTeams.length > 0) {
        for (const team of allEventTeams) {
          const minSize = team.events?.min_team_size || 1;
          const leaderId = team.leader_id;
          const acceptedRegs = team.event_registrations ? team.event_registrations.filter(r => r.status === 'registered') : [];
          const acceptedUserIds = new Set(acceptedRegs.map(r => String(r.user_id)));
          if (leaderId) {
            acceptedUserIds.add(String(leaderId));
          }
          const totalAcceptedCount = acceptedUserIds.size;
          
          if (totalAcceptedCount < minSize) {
            console.log(`[RegistrationClosingJob] Disqualifying team ${team.id} (${team.name}) - Size ${totalAcceptedCount} < Min ${minSize}`);
            
            // 1. Delete all registrations
            await supabase.from('event_registrations').delete().eq('team_id', team.id);
            // 2. Delete team
            await supabase.from('event_teams').delete().eq('id', team.id);
            // 3. Decrement registered_count
            await supabase.rpc('decrement_registered_count_by', { row_id: team.events.id, amount: acceptedMembers.length });
            
            // Fallback decrement if RPC not available yet
            try {
              const { data: currentEvent } = await supabase.from('events').select('registered_count').eq('id', team.events.id).single();
              if (currentEvent) {
                await supabase.from('events').update({ registered_count: Math.max(0, currentEvent.registered_count - acceptedMembers.length) }).eq('id', team.events.id);
              }
            } catch(e) {}

            // 4. Notify members
            for (const member of acceptedMembers) {
              try {
                await notifyUser({
                  recipientId: member.user_id,
                  title: 'Team Registration Disqualified',
                  message: `Your team registration for "${team.name}" in the event "${team.events.title}" was cancelled because the minimum team size was not met before the registration deadline.`,
                  type: 'error',
                  eventId: team.events.id,
                  emailSubject: `Registration Cancelled – ${team.events.title}`,
                  emailData: {
                    eventName: team.events.title,
                    date: new Date().toLocaleDateString(),
                    status: 'Disqualified',
                    instructions: "The team failed to meet the minimum required members by the deadline and has been automatically cancelled."
                  }
                });
              } catch (e) {
                console.error('[RegistrationClosingJob] Error notifying disqualified member:', e.message);
              }
            }
          }
        }
      }

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
