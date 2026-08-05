-- ============================================================
-- AVENTO Supabase Schema Setup - Phase 11 Registration Deadline
-- ============================================================

-- Add registration_deadline to events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS registration_deadline TIMESTAMPTZ;
