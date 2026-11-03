-- ==============================================================================
-- MIGRATION: Per-criterion evaluator comments (v54)
--
-- Adds a comment to every score row so evaluators can comment on EACH scoring
-- criterion (not just one overall comment per student). These comments are
-- shown on the student's scorecard and included in the score report
-- (email + PDF) the student receives.
--
-- Run this in the Supabase Dashboard -> SQL Editor.
-- ==============================================================================

ALTER TABLE public.scoring_scores
  ADD COLUMN IF NOT EXISTS comment TEXT NOT NULL DEFAULT '';

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
