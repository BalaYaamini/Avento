-- ============================================================
-- AVENTO Supabase Schema Setup - Phase 27 Team Leader Contact
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Add leader_contact_number column to event_teams
ALTER TABLE public.event_teams
  ADD COLUMN IF NOT EXISTS leader_contact_number VARCHAR(15);

-- (Optional) If you have a trigger or view that requires it, no further action is needed here 
-- since this just adds a column that can be updated via the API.
