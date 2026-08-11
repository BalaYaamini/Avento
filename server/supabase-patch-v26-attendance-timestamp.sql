-- ============================================================
-- AVENTO Supabase Patch v26: Add attendance_timestamp to event_registrations
-- Run this in the Supabase SQL Editor if attendance_timestamp column does not exist
-- ============================================================

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS attendance_timestamp TIMESTAMPTZ;
