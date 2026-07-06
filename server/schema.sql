-- ============================================================
-- AVENTO Supabase Schema Setup
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ─── PROFILES TABLE ──────────────────────────────────────────
-- Add missing columns if they don't exist yet
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS employee_id TEXT,
  ADD COLUMN IF NOT EXISTS roll_number TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT;

-- ─── FIX ROLE CHECK CONSTRAINT ───────────────────────────────
-- Drop the old restrictive role check and add one that includes student_organizer
-- IMPORTANT: Run this in Supabase SQL Editor if seeder fails with role constraint error
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'student', 'faculty', 'student_organizer', 'faculty_organizer'));

-- ─── EVENTS TABLE ────────────────────────────────────────────
-- Ensure all required columns exist
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS proposed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS faculty_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS organizer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS student_organizer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS venue TEXT,
  ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS capacity INTEGER,
  ADD COLUMN IF NOT EXISTS approval_remarks TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS registered_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attendance_count INTEGER DEFAULT 0;

-- ─── EVENT_MEMBERS TABLE ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  roll_number TEXT,
  email TEXT,
  role TEXT DEFAULT 'Volunteer',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── EVENT_REGISTRATIONS TABLE ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_registrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'registered',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- ─── RLS POLICIES ────────────────────────────────────────────
-- Allow service role full access (backend uses service role key so bypasses RLS)
-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all profiles (for dropdowns), only update own
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Events: public read for published events, auth required for write
DROP POLICY IF EXISTS "events_select_all" ON public.events;
CREATE POLICY "events_select_all" ON public.events
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "events_insert_auth" ON public.events;
CREATE POLICY "events_insert_auth" ON public.events
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "events_update_auth" ON public.events;
CREATE POLICY "events_update_auth" ON public.events
  FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "events_delete_auth" ON public.events;
CREATE POLICY "events_delete_auth" ON public.events
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Event members: auth required
DROP POLICY IF EXISTS "event_members_all" ON public.event_members;
CREATE POLICY "event_members_all" ON public.event_members
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Event registrations: auth required
DROP POLICY IF EXISTS "event_registrations_select_own" ON public.event_registrations;
CREATE POLICY "event_registrations_select_own" ON public.event_registrations
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "event_registrations_insert_auth" ON public.event_registrations;
CREATE POLICY "event_registrations_insert_auth" ON public.event_registrations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "event_registrations_delete_own" ON public.event_registrations;
CREATE POLICY "event_registrations_delete_own" ON public.event_registrations
  FOR DELETE USING (auth.uid() = user_id OR auth.uid() IS NOT NULL);

-- ─── SEED: Fix Admin Profile ─────────────────────────────────
-- Update the admin profile to ensure role = 'admin'
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'admin.avento@gmail.com';

-- Update demo student profile
UPDATE public.profiles
SET role = 'student', roll_number = '2203A51000'
WHERE email = 'student.demo@cse.suh.edu.in';

-- Update demo faculty profile
UPDATE public.profiles
SET role = 'faculty', employee_id = 'EMP001'
WHERE email = 'faculty.demo@suh.edu.in';
