-- ==============================================================================
-- MIGRATION: Atomic Event Slot Rescheduling (v49)
-- Performs time slot switches (allocation of target slot, release of previous slot,
-- and registration/team reference update) in a single ACID PostgreSQL transaction.
--
-- Run this in the Supabase Dashboard -> SQL Editor.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.reschedule_event_slot_atomic(
  p_registration_id UUID,
  p_target_slot_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reg RECORD;
  v_event RECORD;
  v_target_slot RECORD;
  v_old_slot_id UUID;
  v_team_id UUID;
  v_updated_slot RECORD;
  v_live_count INT;
BEGIN
  -- 1. Lock and fetch the registration
  SELECT * INTO v_reg
  FROM public.event_registrations
  WHERE id = p_registration_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Registration not found.');
  END IF;

  v_old_slot_id := v_reg.slot_id;
  v_team_id := v_reg.team_id;

  -- If this is a team registration, also lock team row and check team slot
  IF v_team_id IS NOT NULL THEN
    SELECT slot_id INTO v_old_slot_id
    FROM public.event_teams
    WHERE id = v_team_id
    FOR UPDATE;
  END IF;

  -- 2. Verify not already assigned to target slot
  IF v_old_slot_id IS NOT NULL AND v_old_slot_id = p_target_slot_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'You are already registered for this time slot.');
  END IF;

  -- 3. Verify event
  SELECT * INTO v_event
  FROM public.events
  WHERE id = v_reg.event_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Associated event not found.');
  END IF;

  IF v_event.status IN ('completed', 'cancelled') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cannot reschedule for a completed or cancelled event.');
  END IF;

  IF v_event.registration_deadline IS NOT NULL AND now() > v_event.registration_deadline THEN
    RETURN jsonb_build_object('success', false, 'message', 'Slot rescheduling is closed because the registration deadline has passed.');
  END IF;

  -- 4. Lock and verify target slot
  SELECT * INTO v_target_slot
  FROM public.event_slots
  WHERE id = p_target_slot_id AND event_id = v_reg.event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Target slot not found.');
  END IF;

  IF v_target_slot.status = 'inactive' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Selected time slot is currently inactive.');
  END IF;

  -- Compute live seat holders currently occupying target slot (deduped per team/reg)
  SELECT COUNT(DISTINCT COALESCE(team_id::text, 'reg_' || id::text))
  INTO v_live_count
  FROM public.event_registrations
  WHERE (slot_id = p_target_slot_id OR team_id IN (SELECT id FROM public.event_teams WHERE slot_id = p_target_slot_id))
    AND event_id = v_reg.event_id
    AND status NOT IN ('cancelled', 'rejected', 'expired');

  IF v_live_count >= v_target_slot.max_capacity THEN
    UPDATE public.event_slots
    SET status = 'full', allocated_count = v_live_count, updated_at = now()
    WHERE id = p_target_slot_id;
    RETURN jsonb_build_object('success', false, 'message', 'Selected time slot is fully booked. Please select another slot.');
  END IF;

  -- 5. Allocate target slot (+1)
  UPDATE public.event_slots
  SET 
    allocated_count = allocated_count + 1,
    status = CASE WHEN allocated_count + 1 >= max_capacity THEN 'full' ELSE 'active' END,
    updated_at = now()
  WHERE id = p_target_slot_id
  RETURNING * INTO v_updated_slot;

  -- 6. Release old slot (-1) if any
  IF v_old_slot_id IS NOT NULL AND v_old_slot_id <> p_target_slot_id THEN
    UPDATE public.event_slots
    SET 
      allocated_count = GREATEST(0, allocated_count - 1),
      status = CASE WHEN status = 'full' AND GREATEST(0, allocated_count - 1) < max_capacity THEN 'active' ELSE status END,
      updated_at = now()
    WHERE id = v_old_slot_id;
  END IF;

  -- 7. Update registration and team references
  IF v_team_id IS NOT NULL THEN
    UPDATE public.event_teams
    SET slot_id = p_target_slot_id, updated_at = now()
    WHERE id = v_team_id;

    UPDATE public.event_registrations
    SET slot_id = p_target_slot_id
    WHERE team_id = v_team_id;
  ELSE
    UPDATE public.event_registrations
    SET slot_id = p_target_slot_id
    WHERE id = p_registration_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Time slot changed successfully!',
    'slot', row_to_json(v_updated_slot)
  );
END;
$$;

-- Grant execution to authenticated & service role users
GRANT EXECUTE ON FUNCTION public.reschedule_event_slot_atomic(UUID, UUID, UUID) TO authenticated, service_role, anon;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';

