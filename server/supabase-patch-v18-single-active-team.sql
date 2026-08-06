-- Patch v18: Single Active Team with Team Switching Feature

-- 1. Update accept_team_invitation to NOT soft-delete other pending invitations, but enforce a single active team
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

    -- 3. Verify no other active team registration exists for this user for the same event
    IF EXISTS (
        SELECT 1 FROM public.event_registrations
        WHERE user_id = p_user_id 
          AND event_id = v_event_id 
          AND status = 'registered' 
          AND team_id IS NOT NULL
          AND id != p_registration_id
    ) THEN
        RAISE EXCEPTION 'You are already registered for a team in this event. Please leave that team first.';
    END IF;

    -- 4. Update the target registration to registered
    UPDATE public.event_registrations
    SET status = 'registered'
    WHERE id = p_registration_id;

    -- Note: We no longer delete or expire other pending registrations for the same event.
    -- They stay 'pending' so the user can switch teams later if they leave this one.

    -- 5. Increment event registered_count
    UPDATE public.events
    SET registered_count = registered_count + 1
    WHERE id = v_event_id;

END;
$$ LANGUAGE plpgsql;


-- 2. Update leave_team RPC to remove the reactivation step (as they are no longer expired)
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

    -- 5. Delete the user's current accepted registration
    DELETE FROM public.event_registrations
    WHERE id = v_registration_id;

    -- 6. Decrement event registered_count
    UPDATE public.events
    SET registered_count = registered_count - 1
    WHERE id = v_event_id;

    -- Note: We no longer need to restore expired invitations because they remain pending now.
      
END;
$$ LANGUAGE plpgsql;


-- 3. Data Cleanup: Restore any previously 'expired' invitations back to 'pending' to fix testing state
UPDATE public.event_registrations
SET status = 'pending'
WHERE status = 'expired';
