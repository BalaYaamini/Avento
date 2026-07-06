-- ============================================================
-- AVENTO Supabase Schema Setup Patch v2
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Add new columns to public.events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS join_team_enabled BOOLEAN DEFAULT FALSE;

-- Create public.event_organizers table
CREATE TABLE IF NOT EXISTS public.event_organizers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, student_id)
);

-- Create public.organizer_requests table
CREATE TABLE IF NOT EXISTS public.organizer_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, student_id)
);

-- Enable RLS and add basic policies (similar to other tables)
ALTER TABLE public.event_organizers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizer_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_organizers_all" ON public.event_organizers;
CREATE POLICY "event_organizers_all" ON public.event_organizers
  FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "organizer_requests_all" ON public.organizer_requests;
CREATE POLICY "organizer_requests_all" ON public.organizer_requests
  FOR ALL USING (auth.uid() IS NOT NULL);
