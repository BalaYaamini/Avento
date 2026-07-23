-- ============================================================
-- AVENTO Supabase Patch v10 - Organizing Team Roles
-- ============================================================

-- Drop the restrictive check constraint on event_members role
-- This allows dynamic responsibilities like 'Event Lead', 'Finance', etc.
ALTER TABLE public.event_members DROP CONSTRAINT IF EXISTS event_members_role_check;
