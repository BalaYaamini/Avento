// Event completion is MANUAL: an authorized organizer marks an event as
// completed from the Workspace ("Mark as Completed"). This job previously
// auto-completed events whose `date` had passed, which flipped multi-day
// events to "completed" mid-run (opening feedback and hiding passes too
// early), so the automatic behavior is intentionally disabled.
const startEventCompletionJob = () => {
  console.log('[EventCompletionJob] Auto-completion disabled - events are completed manually from the Workspace.');
};

module.exports = startEventCompletionJob;
