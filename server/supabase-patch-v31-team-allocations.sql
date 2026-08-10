-- ==============================================================================
-- MIGRATION: Team Allocation Module (v31)
-- Isolated table for storing team venue/room and problem statement assignments.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS team_allocations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES event_teams(id) ON DELETE CASCADE,
  venue_room TEXT NOT NULL,
  problem_statement TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(event_id, team_id)
);

-- Enable RLS
ALTER TABLE team_allocations ENABLE ROW LEVEL SECURITY;

-- Policies for team allocations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'team_allocations' AND policyname = 'Allow public read for team allocations'
  ) THEN
    CREATE POLICY "Allow public read for team allocations" ON team_allocations FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'team_allocations' AND policyname = 'Allow authenticated full access for team allocations'
  ) THEN
    CREATE POLICY "Allow authenticated full access for team allocations" ON team_allocations FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;
