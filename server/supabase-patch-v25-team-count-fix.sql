-- ============================================================
-- AVENTO Supabase Schema Setup - Phase 25 Team Count Fix
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Fix the Confirm Team Registration RPC to increment registered_count by 1
CREATE OR REPLACE FUNCTION public.confirm_team_registration(p_team_id UUID, p_leader_id UUID)
RETURNS void AS $$
DECLARE
    v_event_id UUID;
    v_team_status TEXT;
    v_min_size INTEGER;
    v_max_teams INTEGER;
    v_accepted_members INTEGER;
    v_current_teams INTEGER;
BEGIN
    -- 1. Lock the team
    SELECT event_id, status INTO v_event_id, v_team_status
    FROM public.event_teams
    WHERE id = p_team_id AND leader_id = p_leader_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Team not found or you are not the leader.';
    END IF;

    IF v_team_status = 'registered' THEN
        RAISE EXCEPTION 'Team is already confirmed.';
    END IF;

    -- 2. Get event limits
    SELECT min_team_size, max_teams INTO v_min_size, v_max_teams
    FROM public.events
    WHERE id = v_event_id;

    -- 3. Check accepted members count (Team Leader + Accepted Team Members)
    SELECT COUNT(DISTINCT user_id) INTO v_accepted_members
    FROM (
        SELECT user_id FROM public.event_registrations WHERE team_id = p_team_id AND status = 'registered'
        UNION
        SELECT p_leader_id AS user_id
    ) t;

    IF v_accepted_members < v_min_size THEN
        RAISE EXCEPTION 'Minimum team size not reached yet.';
    END IF;

    -- 4. Check max teams limit
    IF v_max_teams IS NOT NULL THEN
        SELECT COUNT(*) INTO v_current_teams
        FROM public.event_teams
        WHERE event_id = v_event_id AND status = 'registered';

        IF v_current_teams >= v_max_teams THEN
            RAISE EXCEPTION 'Maximum number of teams for this event has been reached.';
        END IF;
    END IF;

    -- 5. Update team status
    UPDATE public.event_teams
    SET status = 'registered'
    WHERE id = p_team_id;

    -- 6. Increment event registered_count by 1 (since 1 team is confirmed)
    UPDATE public.events
    SET registered_count = registered_count + 1
    WHERE id = v_event_id;
END;
$$ LANGUAGE plpgsql;

-- 2. Fix currently corrupted registered_count for team events
--    Sets the registered_count to the number of 'registered' event_teams.
UPDATE public.events e
SET registered_count = (
    SELECT COUNT(*) 
    FROM public.event_teams et 
    WHERE et.event_id = e.id AND et.status = 'registered'
)
WHERE e.registration_type = 'team';
