-- ============================================================
-- AVENTO Supabase Schema Setup Patch v3
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Update check constraint on events table status to allow 'withdrawn'
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_status_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_status_check
  CHECK (status IN ('pending', 'pending_approval', 'approved', 'rejected', 'published', 'completed', 'cancelled', 'withdrawn'));
