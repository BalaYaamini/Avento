-- ============================================================
-- AVENTO - Patch v61: Manual, Date-Based Reminder Emails
-- events.reminder_email_config gains two documented keys:
--   1. auto_send (BOOLEAN, default false)
--      -> opt-in flag for the automated 3-hour-before reminder job.
--         When absent/false the cron job skips the event and all
--         reminders are sent manually by date from the workspace.
--   2. (existing keys unchanged: enabled, mode, subject, body)
-- No schema change is required: the values live inside the
-- events.reminder_email_config JSONB column from patch v57.
-- The UPDATE below backfills auto_send=false explicitly so the
-- stored config is self-describing. It is idempotent.
-- ============================================================

UPDATE public.events
SET reminder_email_config =
  jsonb_set(
    COALESCE(reminder_email_config, '{}'::jsonb),
    '{auto_send}',
    'false'::jsonb
  )
WHERE reminder_email_config IS NULL
   OR NOT (reminder_email_config ? 'auto_send');

NOTIFY pgrst, 'reload schema';
