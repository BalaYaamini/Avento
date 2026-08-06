-- Patch v19: Fix Unique Constraint for Multiple Invitations

-- 1. Drop the strict UNIQUE(event_id, user_id) constraint which prevents multiple pending invitations
ALTER TABLE public.event_registrations
DROP CONSTRAINT IF EXISTS event_registrations_event_id_user_id_key;

-- 2. Add a partial unique index to enforce that a user can only have ONE 'registered' status per event
CREATE UNIQUE INDEX IF NOT EXISTS event_registrations_single_active_idx 
ON public.event_registrations (event_id, user_id) 
WHERE status = 'registered';

-- 3. Add a unique index to enforce that a user can only have one registration per team
CREATE UNIQUE INDEX IF NOT EXISTS event_registrations_unique_team_user_idx
ON public.event_registrations (team_id, user_id)
WHERE team_id IS NOT NULL;
