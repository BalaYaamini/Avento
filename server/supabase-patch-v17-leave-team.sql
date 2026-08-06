-- Patch v17: Change Team Before Registration Deadline Feature

-- 1. Update accept_team_invitation to soft-delete other pending invitations instead of hard-deleting them
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

    -- 4. Soft-delete (expire) all other pending registrations for this user for the SAME event
    UPDATE public.event_registrations
    SET status = 'expired'
    WHERE user_id = p_user_id 
      AND event_id = v_event_id 
      AND status = 'pending' 
      AND id != p_registration_id;

    -- 5. Increment event registered_count
    UPDATE public.events
    SET registered_count = registered_count + 1
    WHERE id = v_event_id;

END;
$$ LANGUAGE plpgsql;


-- 2. Create new leave_team RPC
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

    -- 5. Delete the user's current accepted registration (to completely remove their seat from the team)
    DELETE FROM public.event_registrations
    WHERE id = v_registration_id;

    -- 6. Decrement event registered_count
    UPDATE public.events
    SET registered_count = registered_count - 1
    WHERE id = v_event_id;

    -- 7. Restore previously auto-rejected/expired invitations for this user for the same event
    -- Provided the inviting team still exists
    UPDATE public.event_registrations
    SET status = 'pending'
    WHERE user_id = p_user_id 
      AND event_id = v_event_id 
      AND status = 'expired'
      AND EXISTS (SELECT 1 FROM public.event_teams WHERE id = public.event_registrations.team_id);
      
END;
$$ LANGUAGE plpgsql;
