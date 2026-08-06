-- ─── ADD MISSING REGISTRATION DEADLINE COLUMN ──────────────────────────
-- Safely adds the registration_deadline column to the events table.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS registration_deadline TIMESTAMPTZ;
