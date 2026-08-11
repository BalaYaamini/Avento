-- ============================================================
-- AVENTO Supabase Schema Setup - Phase 24 Team Status
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Add status column to event_teams
ALTER TABLE public.event_teams
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- 2. Modify accept_team_invitation to NOT increment event's registered_count
CREATE OR REPLACE FUNCTION public.accept_team_invitation(p_registration_id UUID, p_user_id UUID)
RETURNS void AS $$
DECLARE
    v_event_id UUID;
    v_status TEXT;
    v_deadline TIMESTAMPTZ;
BEGIN
    -- 1. Fetch the registration and lock the row
    SELECT event_id, status INTO v_event_id, v_status
    FROM public.event_registrations
    WHERE id = p_registration_id AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Registration not found or unauthorized.';
    END IF;

    IF v_status != 'pending' THEN
        RAISE EXCEPTION 'Registration is not in a pending state.';
    END IF;

    -- 2. Check the event deadline
    SELECT registration_deadline INTO v_deadline
    FROM public.events
    WHERE id = v_event_id;

    IF v_deadline IS NOT NULL AND NOW() > v_deadline THEN
        RAISE EXCEPTION 'Registration deadline has passed.';
    END IF;

    -- 3. Update the target registration to registered
    UPDATE public.event_registrations
    SET status = 'registered'
    WHERE id = p_registration_id;

    -- 4. Delete all other pending registrations for this user for the SAME event
    DELETE FROM public.event_registrations
    WHERE user_id = p_user_id 
      AND event_id = v_event_id 
      AND status = 'pending' 
      AND id != p_registration_id;

    -- NO LONGER INCREMENTING event.registered_count HERE!
    -- It will be incremented when the Team Leader explicitly confirms the team.
END;
$$ LANGUAGE plpgsql;

-- 3. Create RPC for Confirming Team Registration
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
