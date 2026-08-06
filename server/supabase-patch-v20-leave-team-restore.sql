-- Patch v20: Leave Team Restore Feature

-- 1. Update leave_team RPC to restore the invitation to pending rather than deleting it
CREATE OR REPLACE FUNCTION public.leave_team(p_team_id UUID, p_user_id UUID)
RETURNS void AS $$
DECLARE
    v_event_id UUID;
    v_leader_id UUID;
    v_registration_id UUID;
    v_deadline TIMESTAMPTZ;
BEGIN
    -- 1. Fetch team details
    SELECT event_id, leader_id INTO v_event_id, v_leader_id
    FROM public.event_teams
    WHERE id = p_team_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Team not found.';
    END IF;

    -- 2. Verify user is not the leader
    IF v_leader_id = p_user_id THEN
        RAISE EXCEPTION 'Team Leader cannot leave the team. Use the Cancel Team Registration option instead.';
    END IF;

    -- 3. Check the event deadline
    SELECT registration_deadline INTO v_deadline
    FROM public.events
    WHERE id = v_event_id;

    IF v_deadline IS NOT NULL AND NOW() > v_deadline THEN
        RAISE EXCEPTION 'Registration deadline has passed.';
    END IF;

    -- 4. Get the user's registration for this team and verify they are registered
    SELECT id INTO v_registration_id
    FROM public.event_registrations
    WHERE team_id = p_team_id AND user_id = p_user_id AND status = 'registered'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'You do not have an active accepted registration for this team.';
    END IF;

    -- 5. Restore the user's current accepted registration back to pending instead of deleting it
    UPDATE public.event_registrations
    SET status = 'pending'
    WHERE id = v_registration_id;

    -- 6. Decrement event registered_count
    UPDATE public.events
    SET registered_count = registered_count - 1
    WHERE id = v_event_id;

END;
$$ LANGUAGE plpgsql;
