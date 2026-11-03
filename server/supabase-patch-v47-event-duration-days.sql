-- v47: Multi-day events
-- Adds duration_days to events (default 1). When duration_days >= 2, the
-- slot management UI offers Day 1 / Day 2 ... slot division.
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS duration_days INT NOT NULL DEFAULT 1;
