-- ==============================================================================
-- MIGRATION: Panel Allocation (v50)
-- Interview / judging panels for events: organizers create panels (name, venue,
-- panel members), and assign students (registrations) to panels.
--
-- Design notes:
--   * One panel per student per event (UNIQUE(event_id, registration_id)):
--     assigning to another panel moves the student.
--   * No stored counters anywhere — assignment counts are always computed live,
--     so panel occupancy can never drift.
--   * max_capacity is optional (NULL = unlimited).
--
-- Run this in the Supabase Dashboard -> SQL Editor.
-- ==============================================================================

-- 1. Panels table
CREATE TABLE IF NOT EXISTS public.event_panels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  venue_room TEXT DEFAULT '',
  max_capacity INT DEFAULT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT positive_panel_capacity CHECK (max_capacity IS NULL OR max_capacity > 0),
  CONSTRAINT unique_panel_name_per_event UNIQUE (event_id, name)
);

CREATE INDEX IF NOT EXISTS idx_event_panels_event_id ON public.event_panels(event_id);

-- 2. Panel members (judges / interviewers assigned to a panel)
CREATE TABLE IF NOT EXISTS public.panel_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  panel_id UUID NOT NULL REFERENCES public.event_panels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_panel_member UNIQUE (panel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_panel_members_panel_id ON public.panel_members(panel_id);
CREATE INDEX IF NOT EXISTS idx_panel_members_user_id ON public.panel_members(user_id);

-- 3. Panel assignments (students assigned to panels)
CREATE TABLE IF NOT EXISTS public.panel_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  panel_id UUID NOT NULL REFERENCES public.event_panels(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  registration_id UUID NOT NULL REFERENCES public.event_registrations(id) ON DELETE CASCADE,
  assigned_by UUID DEFAULT NULL,
  assigned_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_panel_assignment UNIQUE (panel_id, registration_id),
  CONSTRAINT one_panel_per_student_per_event UNIQUE (event_id, registration_id)
);

CREATE INDEX IF NOT EXISTS idx_panel_assignments_panel_id ON public.panel_assignments(panel_id);
CREATE INDEX IF NOT EXISTS idx_panel_assignments_event_id ON public.panel_assignments(event_id);
CREATE INDEX IF NOT EXISTS idx_panel_assignments_registration_id ON public.panel_assignments(registration_id);

-- 4. Enable RLS (server uses the service role key; policies keep the door open
--    the same way event_slots does)
ALTER TABLE public.event_panels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.panel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.panel_assignments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'event_panels' AND policyname = 'Allow public read for event_panels'
  ) THEN
    CREATE POLICY "Allow public read for event_panels" ON public.event_panels FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'event_panels' AND policyname = 'Allow service and auth all for event_panels'
  ) THEN
    CREATE POLICY "Allow service and auth all for event_panels" ON public.event_panels FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'panel_members' AND policyname = 'Allow public read for panel_members'
  ) THEN
    CREATE POLICY "Allow public read for panel_members" ON public.panel_members FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'panel_members' AND policyname = 'Allow service and auth all for panel_members'
  ) THEN
    CREATE POLICY "Allow service and auth all for panel_members" ON public.panel_members FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'panel_assignments' AND policyname = 'Allow public read for panel_assignments'
  ) THEN
    CREATE POLICY "Allow public read for panel_assignments" ON public.panel_assignments FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'panel_assignments' AND policyname = 'Allow service and auth all for panel_assignments'
  ) THEN
    CREATE POLICY "Allow service and auth all for panel_assignments" ON public.panel_assignments FOR ALL USING (true);
  END IF;
END $$;

-- 5. Realtime: broadcast panel changes so open workspaces update live
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'event_panels'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_panels;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'panel_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.panel_members;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'panel_assignments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.panel_assignments;
  END IF;
END $$;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
