-- ============================================================
-- AVENTO - Supabase Patch v42: Profile Tab Fields, Team Invitations & RLS Fix
-- Run this script in Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ============================================================

-- ── 1. PROFILES TABLE COLUMNS & CONSTRAINTS ─────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS degree_program TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS year_of_study TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS college_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS college TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS roll_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Drop restrictive check constraints
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS chk_phone_india;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_gender_check;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_gender_check1;

-- Add flexible mobile check constraint (permits NULL, empty string, or standard mobile numbers)
ALTER TABLE public.profiles ADD CONSTRAINT chk_phone_india
  CHECK (phone IS NULL OR phone = '' OR phone ~ '^[0-9]{10}$');

-- RLS policies for Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles 
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles 
  FOR UPDATE USING (true);

-- Sync college & college_name for legacy rows
UPDATE public.profiles 
SET college_name = COALESCE(college_name, college),
    college = COALESCE(college, college_name)
WHERE college_name IS NULL OR college IS NULL;


-- ── 2. EVENT_REGISTRATIONS RLS POLICIES (FIXES TEAM INVITATION ACCEPTS) ─
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_registrations_select" ON public.event_registrations;
CREATE POLICY "event_registrations_select" ON public.event_registrations 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "event_registrations_insert" ON public.event_registrations;
CREATE POLICY "event_registrations_insert" ON public.event_registrations 
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "event_registrations_update" ON public.event_registrations;
CREATE POLICY "event_registrations_update" ON public.event_registrations 
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "event_registrations_delete" ON public.event_registrations;
CREATE POLICY "event_registrations_delete" ON public.event_registrations 
  FOR DELETE USING (true);


-- ── 3. TEAM_EMAIL_INVITES COLUMNS & RLS POLICIES ────────────
CREATE TABLE IF NOT EXISTS public.team_email_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES public.event_teams(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.team_email_invites ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.team_email_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_email_invites_select" ON public.team_email_invites;
CREATE POLICY "team_email_invites_select" ON public.team_email_invites 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "team_email_invites_insert" ON public.team_email_invites;
CREATE POLICY "team_email_invites_insert" ON public.team_email_invites 
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "team_email_invites_update" ON public.team_email_invites;
CREATE POLICY "team_email_invites_update" ON public.team_email_invites 
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "team_email_invites_delete" ON public.team_email_invites;
CREATE POLICY "team_email_invites_delete" ON public.team_email_invites 
  FOR DELETE USING (true);
