-- ============================================================
-- AVENTO Supabase Schema Setup - Phase 6 Team Registration
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Add Team Registration configurations to `events` table
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS registration_type TEXT DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS max_teams INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS min_team_size INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_team_size INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS allow_cross_department BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS team_leader_registration_required BOOLEAN DEFAULT true;

-- 2. Create `event_teams` table
CREATE TABLE IF NOT EXISTS public.event_teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  leader_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, name)
);

-- 3. Add `team_id` to `event_registrations` table
ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.event_teams(id) ON DELETE CASCADE;

-- 4. Enable RLS and add policies for `event_teams`
ALTER TABLE public.event_teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_teams_select_all" ON public.event_teams;
CREATE POLICY "event_teams_select_all" ON public.event_teams
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "event_teams_insert_auth" ON public.event_teams;
CREATE POLICY "event_teams_insert_auth" ON public.event_teams
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "event_teams_update_auth" ON public.event_teams;
CREATE POLICY "event_teams_update_auth" ON public.event_teams
  FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "event_teams_delete_auth" ON public.event_teams;
CREATE POLICY "event_teams_delete_auth" ON public.event_teams
  FOR DELETE USING (auth.uid() IS NOT NULL);
