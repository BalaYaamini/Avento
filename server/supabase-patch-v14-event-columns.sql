-- ─── ADD MISSING EVENT TEAM REGISTRATION COLUMNS ────────────────────────
-- Adds columns to support the team registration feature.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS registration_type TEXT DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS max_teams INTEGER,
  ADD COLUMN IF NOT EXISTS min_team_size INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_team_size INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS allow_cross_department BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS team_leader_registration_required BOOLEAN DEFAULT true;
