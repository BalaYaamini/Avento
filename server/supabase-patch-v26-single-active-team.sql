-- Patch: Enforce Strict Single Active Team per User per Event

-- We want to completely prevent a student from accepting multiple invitations
-- for the same event at the exact same time (race condition).
-- This creates a partial unique index on event_registrations.

-- 1. Create a unique index for registered teams
CREATE UNIQUE INDEX IF NOT EXISTS one_active_team_per_event 
ON event_registrations (user_id, event_id) 
WHERE status = 'registered';

-- Note: This mathematically blocks race conditions at the database level.
-- If they are already in a team (status = 'registered'), any subsequent attempt
-- to update another row for the same event to 'registered' will throw a Postgres constraint violation error.
