-- ==============================================================================
-- AVENTO PRODUCTION CONSOLIDATED PATCH
-- Run this in your Supabase SQL Editor on PRODUCTION.
-- Covers: v33 (individual allocations) + v35/v36 (code column)
-- ==============================================================================

-- ==============================================================================
-- PART 1: Individual Allocations (v33)
-- ==============================================================================

-- 1a. Allow team_id to be NULL for individual allocations
ALTER TABLE team_allocations ALTER COLUMN team_id DROP NOT NULL;

-- 1b. Add user_id column for individual student allocations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'team_allocations' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE team_allocations ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 1c. Constraint: Allocation must have EXACTLY ONE owner (team_id OR user_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'team_or_user_allocation_check'
  ) THEN
    ALTER TABLE team_allocations ADD CONSTRAINT team_or_user_allocation_check 
      CHECK (
        (team_id IS NOT NULL AND user_id IS NULL) OR 
        (team_id IS NULL AND user_id IS NOT NULL)
      );
  END IF;
END $$;

-- 1d. Unique constraint for individual allocations per event
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_event_user_allocation'
  ) THEN
    ALTER TABLE team_allocations ADD CONSTRAINT unique_event_user_allocation UNIQUE(event_id, user_id);
  END IF;
END $$;

-- 1e. Updated Atomic Allocation RPC Function (supports both Team & Individual)
CREATE OR REPLACE FUNCTION allocate_problem_statement_atomic(
  p_event_id UUID,
  p_team_id UUID DEFAULT NULL,
  p_problem_statement_id UUID DEFAULT NULL,
  p_venue_room TEXT DEFAULT '',
  p_user_id UUID DEFAULT NULL
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
  -- Validate exactly one allocation owner is provided
  IF (p_team_id IS NULL AND p_user_id IS NULL) OR (p_team_id IS NOT NULL AND p_user_id IS NOT NULL) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Allocation requires exactly one owner: either team_id or user_id.');
  END IF;

  -- Check if team or individual already allocated for this event
  IF p_team_id IS NOT NULL THEN
    SELECT * INTO v_alloc_record FROM team_allocations WHERE event_id = p_event_id AND team_id = p_team_id;
  ELSE
    SELECT * INTO v_alloc_record FROM team_allocations WHERE event_id = p_event_id AND user_id = p_user_id;
  END IF;

  IF FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'A problem statement has already been selected.');
  END IF;

  -- Lock target problem statement row for update
  SELECT * INTO v_ps_record FROM event_problem_statements 
  WHERE id = p_problem_statement_id AND event_id = p_event_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Problem statement not found for this event.');
  END IF;

  v_ps_title := v_ps_record.title;
  v_venue := COALESCE(NULLIF(p_venue_room, ''), v_ps_record.venue_room, 'To be announced');

  -- Atomically increment allocated_count
  UPDATE event_problem_statements 
  SET allocated_count = allocated_count + 1, updated_at = NOW()
  WHERE id = p_problem_statement_id;

  -- Insert allocation for Team or Individual
  IF p_team_id IS NOT NULL THEN
    INSERT INTO team_allocations (event_id, team_id, problem_statement_id, problem_statement, venue_room, updated_at)
    VALUES (p_event_id, p_team_id, p_problem_statement_id, v_ps_title, v_venue, NOW())
    ON CONFLICT (event_id, team_id) DO UPDATE 
    SET problem_statement_id = EXCLUDED.problem_statement_id,
        problem_statement = EXCLUDED.problem_statement,
        venue_room = EXCLUDED.venue_room,
        updated_at = NOW();
  ELSE
    INSERT INTO team_allocations (event_id, user_id, problem_statement_id, problem_statement, venue_room, updated_at)
    VALUES (p_event_id, p_user_id, p_problem_statement_id, v_ps_title, v_venue, NOW())
    ON CONFLICT (event_id, user_id) DO UPDATE 
    SET problem_statement_id = EXCLUDED.problem_statement_id,
        problem_statement = EXCLUDED.problem_statement,
        venue_room = EXCLUDED.venue_room,
        updated_at = NOW();
  END IF;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Problem statement successfully allocated!',
    'problem_statement', v_ps_title,
    'venue_room', v_venue
  );
END;
$$;

-- ==============================================================================
-- PART 2: Problem Statement Code Column (v35/v36)
-- ==============================================================================

-- 2a. Add 'code' column to event_problem_statements
ALTER TABLE public.event_problem_statements 
ADD COLUMN IF NOT EXISTS code TEXT DEFAULT '';

COMMENT ON COLUMN public.event_problem_statements.code IS 'Unique problem statement identifier code (e.g. PS01, PS02).';

-- 2b. Backfill existing rows with sequential codes
DO $$
DECLARE
  rec RECORD;
  idx INT := 1;
BEGIN
  FOR rec IN 
    SELECT id FROM public.event_problem_statements 
    WHERE code IS NULL OR code = ''
    ORDER BY created_at ASC
  LOOP
    UPDATE public.event_problem_statements
    SET code = 'PS' || LPAD(idx::TEXT, 2, '0')
    WHERE id = rec.id;
    idx := idx + 1;
  END LOOP;
END $$;
