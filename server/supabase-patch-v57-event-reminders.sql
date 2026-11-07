-- ============================================================
-- AVENTO - Patch v57: Automated Event Reminder Emails
-- 1. events.reminder_email_config      -> organizer reminder email settings (JSONB)
-- 2. event_registrations.reminder_sent_at / reminder_sent_for_start
--    -> send-once tracking per registration (re-sent only when the
--       session is rescheduled to a new start time)
-- ============================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS reminder_email_config JSONB;

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS reminder_sent_for_start TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_event_registrations_reminder_sent_at
  ON public.event_registrations (reminder_sent_at);

NOTIFY pgrst, 'reload schema';
