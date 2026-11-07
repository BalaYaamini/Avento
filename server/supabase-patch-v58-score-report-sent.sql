-- ============================================================
-- AVENTO - Patch v58: Score Report Email Send Tracking
-- 1. event_registrations.report_email_sent_at
--    -> timestamp of the last score report email sent to this student
-- 2. event_registrations.report_email_sent_to
--    -> the email address the score report was sent to
-- Used by the Scoring Board to flip the "Send" button to "Resend"
-- and show to whom/when the report was emailed.
-- ============================================================

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS report_email_sent_at TIMESTAMPTZ;

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS report_email_sent_to TEXT;

CREATE INDEX IF NOT EXISTS idx_event_registrations_report_email_sent_at
  ON public.event_registrations (report_email_sent_at);

NOTIFY pgrst, 'reload schema';
