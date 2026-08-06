-- ─── ACCEPT TEAM INVITATION RPC ─────────────────────────────────────
-- Atomically accepts a team invitation, rejects/expires all other pending invitations for the same event, 
-- and increments the event's registered count.

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

    -- 5. Increment event registered_count
    UPDATE public.events
    SET registered_count = registered_count + 1
    WHERE id = v_event_id;

END;
$$ LANGUAGE plpgsql;
