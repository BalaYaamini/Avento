-- ============================================================
-- AVENTO Supabase Schema Update for Attendance Module
-- Run this in the Supabase SQL Editor
-- ============================================================

-- ─── EVENT_REGISTRATIONS TABLE UPDATES ─────────────────────────
ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS attendance_status TEXT DEFAULT 'Absent';
