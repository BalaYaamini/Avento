-- ============================================================
-- AVENTO - Patch v62: Nullable score for comment-first entries
-- A judge may write a criterion comment before entering a score.
-- That flow upserts a scoring_scores row with score = NULL, which
-- fails while the column is NOT NULL (and fails the whole batch).
-- Allowing NULL keeps "not yet scored" distinguishable from a
-- real 0 (NULL renders as '-' everywhere; 0 is a real zero).
-- Existing rows and the DEFAULT 0 for plain inserts are unchanged.
-- ============================================================

ALTER TABLE public.scoring_scores
  ALTER COLUMN score DROP NOT NULL;

NOTIFY pgrst, 'reload schema';
