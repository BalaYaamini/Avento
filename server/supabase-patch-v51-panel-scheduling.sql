-- ==============================================================================
-- MIGRATION: Panel scheduling exclusivity (v51)
--
-- Strict scheduling rule for panel assignments:
--   * A panel can host at most ONE student at any given interview time.
--   * A panel member (judge / interviewer) can interview at most ONE student at
--     a time, even across different panels they belong to.
--
-- Enforced at the database level (BEFORE INSERT OR UPDATE trigger on
-- panel_assignments) so auto-assign, manual assign and bulk import can never
-- create a concurrent booking, no matter how many requests race. An advisory
-- transaction lock serializes concurrent assignment writes so the conflict
-- check is race-free.
--
-- Time windows come from the student's registration slot (event_slots:
-- slot_date + start_time + end_time). Overlap = same day (or an unknown date)
-- with intersecting time ranges; back-to-back slots are allowed. Multi-day
-- schedules are respected: identical times on different dates do not conflict.
-- Students without a scheduled slot cannot double-book anyone.
--
-- Run this in the Supabase Dashboard -> SQL Editor.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.enforce_panel_assignment_exclusivity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_slot_date DATE;
  v_start TIME;
  v_end TIME;
  v_conflict_name TEXT;
  v_conflict_date DATE;
  v_conflict_start TIME;
  v_conflict_end TIME;
  v_member_name TEXT;
BEGIN
  -- Serialize concurrent assignment writes (released at transaction end) so two
  -- overlapping students can never race into the same panel / shared member.
  PERFORM pg_advisory_xact_lock(925170001);

  -- The incoming student's interview window
  SELECT s.slot_date, s.start_time, s.end_time
  INTO v_slot_date, v_start, v_end
  FROM public.event_registrations r
  LEFT JOIN public.event_slots s ON s.id = r.slot_id
  WHERE r.id = NEW.registration_id;

  -- No scheduled interview time -> no possible double-booking
  IF v_start IS NULL THEN
    RETURN NEW;
  END IF;

  -- 1. Same panel: never two students at overlapping times
  SELECT COALESCE(p2.name, 'Another student'), s2.slot_date, s2.start_time, s2.end_time
  INTO v_conflict_name, v_conflict_date, v_conflict_start, v_conflict_end
  FROM public.panel_assignments a
  JOIN public.event_registrations r2 ON r2.id = a.registration_id
  JOIN public.event_slots s2 ON s2.id = r2.slot_id
  LEFT JOIN public.profiles p2 ON p2.id = r2.user_id
  WHERE a.panel_id = NEW.panel_id
    AND a.registration_id <> NEW.registration_id
    AND (v_slot_date IS NULL OR s2.slot_date IS NULL OR s2.slot_date = v_slot_date)
    AND s2.start_time < v_end
    AND s2.end_time > v_start
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Panel scheduling conflict: % is already booked in this panel at an overlapping time (% % - %).',
      v_conflict_name, COALESCE(v_conflict_date::text, 'date TBD'), v_conflict_start, v_conflict_end;
  END IF;

  -- 2. Shared panel member: never interview two students at overlapping times,
  --    even across different panels
  SELECT COALESCE(pm.name, 'A panel member'), COALESCE(p2.name, 'another student'),
         s2.slot_date, s2.start_time, s2.end_time
  INTO v_member_name, v_conflict_name, v_conflict_date, v_conflict_start, v_conflict_end
  FROM public.panel_assignments a
  JOIN public.event_registrations r2 ON r2.id = a.registration_id
  JOIN public.event_slots s2 ON s2.id = r2.slot_id
  JOIN public.panel_members m_busy ON m_busy.panel_id = a.panel_id
  JOIN public.panel_members m_new ON m_new.panel_id = NEW.panel_id AND m_new.user_id = m_busy.user_id
  LEFT JOIN public.profiles p2 ON p2.id = r2.user_id
  LEFT JOIN public.profiles pm ON pm.id = m_busy.user_id
  WHERE a.panel_id <> NEW.panel_id
    AND a.registration_id <> NEW.registration_id
    AND (v_slot_date IS NULL OR s2.slot_date IS NULL OR s2.slot_date = v_slot_date)
    AND s2.start_time < v_end
    AND s2.end_time > v_start
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Panel scheduling conflict: % is already interviewing % at an overlapping time (% % - %).',
      v_member_name, v_conflict_name, COALESCE(v_conflict_date::text, 'date TBD'), v_conflict_start, v_conflict_end;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_panel_assignment_exclusivity ON public.panel_assignments;

CREATE TRIGGER trg_panel_assignment_exclusivity
  BEFORE INSERT OR UPDATE ON public.panel_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_panel_assignment_exclusivity();

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
