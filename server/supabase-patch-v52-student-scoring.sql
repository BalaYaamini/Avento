-- ==============================================================================
-- MIGRATION: Student scoring for panels (v52)
--
-- Lets panel members score the STUDENTS assigned to their panels using the
-- existing scoring criteria (scoring_rounds / scoring_subrounds), alongside the
-- existing team scoring which stays exactly as-is.
--
-- scoring_scores gains an alternative owner: instead of (team_id, subround_id)
-- a row may be owned by (registration_id, subround_id). Exactly one owner is
-- set per row (CHECK), and each family has its own unique key, so one score per
-- student per criterion (panel consensus - any judge of that student's panel
-- may edit; organizers may edit anyone).
--
-- Run this in the Supabase Dashboard -> SQL Editor.
-- ==============================================================================

-- 1. team_id becomes optional; student-owned rows use registration_id
ALTER TABLE public.scoring_scores ALTER COLUMN team_id DROP NOT NULL;

ALTER TABLE public.scoring_scores
  ADD COLUMN IF NOT EXISTS registration_id UUID REFERENCES public.event_registrations(id) ON DELETE CASCADE;

-- 2. Exactly one owner per score row (team XOR student)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scoring_scores_owner_check'
  ) THEN
    ALTER TABLE public.scoring_scores
      ADD CONSTRAINT scoring_scores_owner_check
      CHECK ((team_id IS NOT NULL)::int + (registration_id IS NOT NULL)::int = 1);
  END IF;
END $$;

-- 3. One score per student per criterion (NULLs are distinct, so team rows are
--    unaffected by this unique key and vice versa)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'scoring_scores_registration_subround_key'
  ) THEN
    ALTER TABLE public.scoring_scores
      ADD CONSTRAINT scoring_scores_registration_subround_key
      UNIQUE (registration_id, subround_id);
  END IF;
END $$;

-- 4. Index for per-student lookups
CREATE INDEX IF NOT EXISTS scoring_scores_registration_idx
  ON public.scoring_scores (event_id, registration_id);

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
