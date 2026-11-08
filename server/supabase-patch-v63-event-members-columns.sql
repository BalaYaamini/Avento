-- ============================================================
-- AVENTO Supabase Patch v63 - Align event_members columns with the app
-- Fixes: "Could not find the 'name' column of 'event_members' in the schema cache"
-- Run this in the PRODUCTION Supabase SQL Editor (Dashboard > SQL Editor).
-- Safe to re-run: every statement is idempotent and no data is deleted.
-- ============================================================

-- 1. Add every column the backend writes to event_members (only if missing)
ALTER TABLE public.event_members ADD COLUMN IF NOT EXISTS name            TEXT;
ALTER TABLE public.event_members ADD COLUMN IF NOT EXISTS email           TEXT;
ALTER TABLE public.event_members ADD COLUMN IF NOT EXISTS roll_number     TEXT;
ALTER TABLE public.event_members ADD COLUMN IF NOT EXISTS role            TEXT DEFAULT 'Volunteer';
ALTER TABLE public.event_members ADD COLUMN IF NOT EXISTS organizer_type  TEXT DEFAULT 'normal';
ALTER TABLE public.event_members ADD COLUMN IF NOT EXISTS allowed_modules TEXT[] DEFAULT ARRAY['all'::text];
ALTER TABLE public.event_members ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ DEFAULT NOW();

-- 2. Allow free-text roles (e.g. 'Faculty Coordinator', 'Admin', 'organizer', custom responsibilities)
ALTER TABLE public.event_members DROP CONSTRAINT IF EXISTS event_members_role_check;

-- 3. Backfill name / email / roll_number for existing rows from profiles
UPDATE public.event_members em
SET name        = COALESCE(em.name, p.name),
    email       = COALESCE(em.email, p.email),
    roll_number = COALESCE(em.roll_number, p.roll_number)
FROM public.profiles p
WHERE em.user_id = p.id
  AND (em.name IS NULL OR em.email IS NULL OR em.roll_number IS NULL);

UPDATE public.event_members SET name = 'Organizer' WHERE name IS NULL;
UPDATE public.event_members SET organizer_type = 'normal' WHERE organizer_type IS NULL;
UPDATE public.event_members SET allowed_modules = ARRAY['all'::text] WHERE allowed_modules IS NULL;

-- 4. Mark proposers / faculty / primary organizers as core organizers
--    (skipped automatically if any of those events columns doesn't exist)
DO $$
BEGIN
  UPDATE public.event_members em
  SET organizer_type = 'core'
  FROM public.events e
  WHERE em.event_id = e.id
    AND em.user_id IN (e.proposed_by, e.student_organizer_id, e.faculty_id, e.organizer_id)
    AND em.organizer_type <> 'core';
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Skipped core-organizer backfill: %', SQLERRM;
END $$;

-- 5. Same column on event_organizers (used by the module-permission feature), if that table exists
DO $$
BEGIN
  IF to_regclass('public.event_organizers') IS NOT NULL THEN
    ALTER TABLE public.event_organizers ADD COLUMN IF NOT EXISTS allowed_modules TEXT[] DEFAULT ARRAY['all'::text];
  END IF;
END $$;

-- 6. Refresh the PostgREST schema cache so the API sees the new columns immediately
NOTIFY pgrst, 'reload schema';

-- 7. Verify (should list name, email, roll_number, role, organizer_type, allowed_modules)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'event_members'
ORDER BY ordinal_position;
