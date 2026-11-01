-- ==============================================================================
-- MIGRATION: Per-student evaluator comment (v53)
--
-- One overall comment per student per event, written by the evaluators
-- (full access organizers may comment on anyone; panel members only on the
-- students allocated to their panel). The comment is shown on the student's
-- scorecard page and included in the score report (email + PDF) the student
-- receives.
--
-- Run this in the Supabase Dashboard -> SQL Editor.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.student_score_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  registration_id UUID NOT NULL REFERENCES public.event_registrations(id) ON DELETE CASCADE,
  comment TEXT NOT NULL DEFAULT '',
  evaluator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT student_score_comments_event_registration_key UNIQUE (event_id, registration_id)
);

CREATE INDEX IF NOT EXISTS student_score_comments_registration_idx
  ON public.student_score_comments (event_id, registration_id);

-- RLS is wide open like the other scoring tables (service-role key; real
-- enforcement lives in scoringController.js)
ALTER TABLE public.student_score_comments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'student_score_comments' AND policyname = 'student_score_comments_all'
  ) THEN
    CREATE POLICY student_score_comments_all ON public.student_score_comments
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
