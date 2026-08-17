-- ==============================================================================
-- MIGRATION: Team Problem Statement Slots (v32)
-- Configurable problem statements with maximum team capacities and atomic slot allocation.
-- ==============================================================================

-- 1. Create event_problem_statements table
CREATE TABLE IF NOT EXISTS event_problem_statements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  venue_room TEXT DEFAULT '',
  max_capacity INT NOT NULL DEFAULT 1,
  allocated_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT positive_max_capacity CHECK (max_capacity > 0),
  CONSTRAINT valid_allocated_count CHECK (allocated_count >= 0 AND allocated_count <= max_capacity)
);

-- 2. Alter team_allocations to reference problem_statement_id if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'team_allocations' AND column_name = 'problem_statement_id'
  ) THEN
    ALTER TABLE team_allocations ADD COLUMN problem_statement_id UUID REFERENCES event_problem_statements(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Enable RLS
ALTER TABLE event_problem_statements ENABLE ROW LEVEL SECURITY;

-- Policies for event_problem_statements
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'event_problem_statements' AND policyname = 'Allow public read for problem statements'
  ) THEN
    CREATE POLICY "Allow public read for problem statements" ON event_problem_statements FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'event_problem_statements' AND policyname = 'Allow authenticated full access for problem statements'
  ) THEN
    CREATE POLICY "Allow authenticated full access for problem statements" ON event_problem_statements FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- 4. Atomic Allocation RPC Function
CREATE OR REPLACE FUNCTION allocate_problem_statement_atomic(
  p_event_id UUID,
  p_team_id UUID,
  p_problem_statement_id UUID,
  p_venue_room TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ps_record RECORD;
  v_alloc_record RECORD;
  v_ps_title TEXT;
  v_venue TEXT;
BEGIN
  -- Check if team already allocated for this event
  SELECT * INTO v_alloc_record FROM team_allocations WHERE event_id = p_event_id AND team_id = p_team_id;
  IF FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Your team has already selected a problem statement.');
  END IF;

  -- Lock target problem statement row for update
  SELECT * INTO v_ps_record FROM event_problem_statements 
  WHERE id = p_problem_statement_id AND event_id = p_event_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Problem statement not found for this event.');
  END IF;

  IF v_ps_record.allocated_count >= v_ps_record.max_capacity THEN
    RETURN jsonb_build_object('success', false, 'message', 'This problem statement has reached full capacity. Please select another.');
  END IF;

  v_ps_title := v_ps_record.title;
  v_venue := COALESCE(NULLIF(p_venue_room, ''), v_ps_record.venue_room, 'To be announced');

  -- Atomically increment allocated_count
  UPDATE event_problem_statements 
  SET allocated_count = allocated_count + 1, updated_at = NOW()
  WHERE id = p_problem_statement_id;

  -- Insert team allocation
  INSERT INTO team_allocations (event_id, team_id, problem_statement_id, problem_statement, venue_room, updated_at)
  VALUES (p_event_id, p_team_id, p_problem_statement_id, v_ps_title, v_venue, NOW())
  ON CONFLICT (event_id, team_id) DO UPDATE 
  SET problem_statement_id = EXCLUDED.problem_statement_id,
      problem_statement = EXCLUDED.problem_statement,
      venue_room = EXCLUDED.venue_room,
      updated_at = NOW();

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Problem statement successfully allocated!',
    'problem_statement', v_ps_title,
    'venue_room', v_venue
  );
END;
$$;
