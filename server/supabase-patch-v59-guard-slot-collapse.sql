-- ============================================================
-- AVENTO - Patch v59: Safety guard against multi-day slot collapse
--
-- What it does:
--   Adds a trigger on event_slots that REFUSES any update which would
--   flatten a multi-day event's slot schedule onto a single date
--   (the bug that collapsed the Coding Excellence Program slots).
--
-- Data safety (important):
--   This trigger NEVER inserts, updates, or deletes any row. It only
--   raises an exception that rolls back a bad update. Registrations,
--   slot allocations, and all existing data are left untouched.
--
--   Normal operations are unaffected: slot allocation, rescheduling and
--   single-slot edits don't change slot_date, so they are never blocked.
--
-- To remove it later (if ever needed):
--   DROP TRIGGER IF EXISTS trg_guard_multi_day_slot_collapse ON public.event_slots;
--   DROP FUNCTION IF EXISTS public.guard_multi_day_slot_collapse();
-- ============================================================

CREATE OR REPLACE FUNCTION public.guard_multi_day_slot_collapse()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_eid UUID;
  v_duration INT;
  v_total INT;
  v_distinct INT;
BEGIN
  -- Only act when a slot's date actually changed in this statement.
  -- (Allocations / reschedules touch allocated_count & status only, so they pass.)
  FOR v_eid IN
    SELECT DISTINCT n.event_id
    FROM new_rows n
    JOIN old_rows o ON o.id = n.id
    WHERE n.slot_date IS DISTINCT FROM o.slot_date
  LOOP
    SELECT COALESCE(e.duration_days, 1)
      INTO v_duration
      FROM public.events e
     WHERE e.id = v_eid;

    IF COALESCE(v_duration, 1) >= 2 THEN
      SELECT COUNT(*), COUNT(DISTINCT slot_date)
        INTO v_total, v_distinct
        FROM public.event_slots
       WHERE event_id = v_eid;

      -- A multi-day event must keep its slots on more than one day. If an
      -- update leaves every slot on the same date, it's the collapse bug.
      IF v_total > 1 AND v_distinct < 2 THEN
        RAISE EXCEPTION
          'Blocked: this update would collapse a multi-day event''s slots onto a single day. No data was changed.';
      END IF;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_multi_day_slot_collapse ON public.event_slots;
CREATE TRIGGER trg_guard_multi_day_slot_collapse
AFTER UPDATE ON public.event_slots
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
FOR EACH STATEMENT
EXECUTE FUNCTION public.guard_multi_day_slot_collapse();

NOTIFY pgrst, 'reload schema';
