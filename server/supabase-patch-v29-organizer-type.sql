-- ============================================================
-- AVENTO Supabase Schema Setup Patch v29 - Organizer Type in Event Members
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Add organizer_type column to event_members table to distinguish
-- between Core Organizers and Normal Organizers in the Proposal Workspace.
ALTER TABLE public.event_members
  ADD COLUMN IF NOT EXISTS organizer_type TEXT DEFAULT 'normal' CHECK (organizer_type IN ('core', 'normal'));

-- Backfill: Set existing members who are the proposer or faculty_id to 'core'
UPDATE public.event_members em
SET organizer_type = 'core'
FROM public.events e
WHERE em.event_id = e.id
  AND em.user_id IN (e.proposed_by, e.student_organizer_id, e.faculty_id, e.organizer_id);
