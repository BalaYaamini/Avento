-- ─── DECREMENT REGISTERED COUNT BY ─────────────────────────────────────
-- Atomically decrements the registered_count on an event by a specific amount.

CREATE OR REPLACE FUNCTION public.decrement_registered_count_by(row_id UUID, amount INTEGER)
RETURNS void AS $$
BEGIN
    UPDATE public.events
    SET registered_count = GREATEST(0, registered_count - amount)
    WHERE id = row_id;
END;
$$ LANGUAGE plpgsql;
