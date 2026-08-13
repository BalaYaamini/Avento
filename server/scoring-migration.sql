-- AVENTO scoring module. Run after the existing schema/payment migrations.
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS scoring_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS scoreboard_visible BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.scoring_rounds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.scoring_subrounds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  round_id UUID NOT NULL REFERENCES public.scoring_rounds(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  max_score NUMERIC(10, 2) NOT NULL DEFAULT 100 CHECK (max_score >= 0),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.scoring_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.event_teams(id) ON DELETE CASCADE,
  subround_id UUID NOT NULL REFERENCES public.scoring_subrounds(id) ON DELETE CASCADE,
  score NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (score >= 0),
  evaluator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, subround_id)
);

CREATE INDEX IF NOT EXISTS scoring_rounds_event_idx ON public.scoring_rounds(event_id, display_order);
CREATE INDEX IF NOT EXISTS scoring_subrounds_round_idx ON public.scoring_subrounds(round_id, display_order);
CREATE INDEX IF NOT EXISTS scoring_scores_event_idx ON public.scoring_scores(event_id, team_id);
