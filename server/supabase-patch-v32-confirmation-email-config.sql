-- ============================================================
-- AVENTO Supabase Schema Setup - Phase 32 Event Confirmation Email Config
-- ============================================================

-- Add confirmation email configuration columns to events table
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS confirmation_email_subject TEXT,
  ADD COLUMN IF NOT EXISTS confirmation_email_body TEXT,
  ADD COLUMN IF NOT EXISTS confirmation_email_attachment_url TEXT,
  ADD COLUMN IF NOT EXISTS confirmation_email_attachment_name TEXT;
