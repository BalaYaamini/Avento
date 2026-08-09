-- ============================================================
-- AVENTO Supabase Schema Setup Patch v28 - Organizer Roles
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Add organizer_role column to event_organizers table
ALTER TABLE public.event_organizers
  ADD COLUMN IF NOT EXISTS organizer_role TEXT DEFAULT 'normal' CHECK (organizer_role IN ('core', 'normal'));

-- Set existing event heads (proposed_by, student_organizer_id) to core, if they are already in the table
UPDATE public.event_organizers eo
SET organizer_role = 'core'
FROM public.events e
WHERE eo.event_id = e.id
  AND eo.student_id IN (e.proposed_by, e.student_organizer_id);
