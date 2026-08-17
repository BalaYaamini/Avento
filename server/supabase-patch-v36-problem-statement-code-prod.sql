-- ==============================================================================
-- AVENTO Patch v36: Add 'code' column to event_problem_statements
-- Run this in your Supabase SQL Editor on PRODUCTION.
-- ==============================================================================

-- 1. Add 'code' column (e.g. PS01, PS02) if not present
ALTER TABLE public.event_problem_statements 
ADD COLUMN IF NOT EXISTS code TEXT DEFAULT '';

COMMENT ON COLUMN public.event_problem_statements.code IS 'Unique problem statement identifier code (e.g. PS01, PS02).';

-- 2. Backfill existing rows with sequential codes
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
