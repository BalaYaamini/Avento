-- Fix: Add RLS policies for scoring tables
-- These tables had RLS enabled but NO policies, which blocks ALL writes
-- (including from the service role in some Supabase configurations)

-- scoring_rounds
DROP POLICY IF EXISTS "scoring_rounds_all_authenticated" ON public.scoring_rounds;
CREATE POLICY "scoring_rounds_all_authenticated" ON public.scoring_rounds
  FOR ALL USING (true) WITH CHECK (true);

-- scoring_subrounds
DROP POLICY IF EXISTS "scoring_subrounds_all_authenticated" ON public.scoring_subrounds;
CREATE POLICY "scoring_subrounds_all_authenticated" ON public.scoring_subrounds
  FOR ALL USING (true) WITH CHECK (true);

-- scoring_scores
DROP POLICY IF EXISTS "scoring_scores_all_authenticated" ON public.scoring_scores;
CREATE POLICY "scoring_scores_all_authenticated" ON public.scoring_scores
  FOR ALL USING (true) WITH CHECK (true);
