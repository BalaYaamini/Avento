const cron = require('node-cron');
const supabase = require('../config/supabaseClient');

const startEventCompletionJob = () => {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      const now = new Date().toISOString();

      // Find events that are either published or active, and their scheduled date has passed
      const { data: eligibleEvents, error } = await supabase
        .from('events')
        .select('id, title, date, status')
        .in('status', ['published', 'active'])
        .lt('date', now);

      if (error) {
        console.error('[EventCompletionJob] Error fetching eligible events:', error.message);
        return;
      }

      if (!eligibleEvents || eligibleEvents.length === 0) {
        return;
      }

      console.log(`[EventCompletionJob] Found ${eligibleEvents.length} event(s) to mark as completed.`);

      const eventIds = eligibleEvents.map(e => e.id);

      // Update status to 'completed'
      const { error: updateError } = await supabase
        .from('events')
        .update({ status: 'completed' })
        .in('id', eventIds);

      if (updateError) {
        console.error('[EventCompletionJob] Error updating event statuses:', updateError.message);
      } else {
        console.log(`[EventCompletionJob] Successfully updated ${eligibleEvents.length} event(s) to completed status.`);
      }

    } catch (err) {
      console.error('[EventCompletionJob] Unexpected error during execution:', err.message);
    }
  });

  console.log('🕒 Event Completion Cron Job initialized (runs every 5 minutes).');
};

module.exports = startEventCompletionJob;
