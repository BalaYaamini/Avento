-- ==============================================================================
-- MIGRATION: Event Slot-Wise Registration (v46)
-- Configurable time slots for events with atomic allocation and workspace management.
-- ==============================================================================

-- 1. Create event_slots table
CREATE TABLE IF NOT EXISTS public.event_slots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  slot_name TEXT NOT NULL,
  slot_date DATE DEFAULT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  venue_room TEXT DEFAULT '',
  max_capacity INT NOT NULL DEFAULT 10,
  allocated_count INT NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'full')),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT positive_slot_capacity CHECK (max_capacity > 0),
  CONSTRAINT valid_slot_allocated CHECK (allocated_count >= 0)
);

-- Index on event_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_event_slots_event_id ON public.event_slots(event_id);

-- 2. Alter events table to add has_slots
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS has_slots BOOLEAN DEFAULT FALSE;

-- 3. Alter event_registrations table to reference slot_id
ALTER TABLE public.event_registrations ADD COLUMN IF NOT EXISTS slot_id UUID REFERENCES public.event_slots(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_event_registrations_slot_id ON public.event_registrations(slot_id);

-- 4. Alter event_teams table to reference slot_id
ALTER TABLE public.event_teams ADD COLUMN IF NOT EXISTS slot_id UUID REFERENCES public.event_slots(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_event_teams_slot_id ON public.event_teams(slot_id);

-- 5. Enable RLS on event_slots
ALTER TABLE public.event_slots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'event_slots' AND policyname = 'Allow public read for event_slots'
  ) THEN
    CREATE POLICY "Allow public read for event_slots" ON public.event_slots FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'event_slots' AND policyname = 'Allow service and auth all for event_slots'
  ) THEN
    CREATE POLICY "Allow service and auth all for event_slots" ON public.event_slots FOR ALL USING (true);
  END IF;
END $$;

-- 6. Atomic Slot Allocation Function
CREATE OR REPLACE FUNCTION allocate_event_slot_atomic(
  p_slot_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_slot RECORD;
  v_updated RECORD;
BEGIN
  -- Lock the slot row
  SELECT * INTO v_slot
  FROM public.event_slots
  WHERE id = p_slot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Slot not found.');
  END IF;

  IF v_slot.status = 'inactive' THEN
    RETURN jsonb_build_object('success', false, 'message', 'This time slot is inactive.');
  END IF;

  IF v_slot.allocated_count >= v_slot.max_capacity THEN
    UPDATE public.event_slots
    SET status = 'full', updated_at = now()
    WHERE id = p_slot_id;
    RETURN jsonb_build_object('success', false, 'message', 'Slot capacity has been reached. Please choose another slot.');
  END IF;

  -- Increment allocated count
  UPDATE public.event_slots
  SET 
    allocated_count = allocated_count + 1,
    status = CASE WHEN allocated_count + 1 >= max_capacity THEN 'full' ELSE 'active' END,
    updated_at = now()
  WHERE id = p_slot_id
  RETURNING * INTO v_updated;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Slot successfully allocated.',
    'slot', row_to_json(v_updated)
  );
END;
$$;

-- 7. Atomic Slot Release Function
CREATE OR REPLACE FUNCTION release_event_slot_atomic(
  p_slot_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_slot RECORD;
  v_updated RECORD;
BEGIN
  -- Lock the slot row
  SELECT * INTO v_slot
  FROM public.event_slots
  WHERE id = p_slot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Slot not found.');
  END IF;

  -- Decrement allocated count (ensuring >= 0)
  UPDATE public.event_slots
  SET 
    allocated_count = GREATEST(0, allocated_count - 1),
    status = CASE WHEN status = 'full' AND GREATEST(0, allocated_count - 1) < max_capacity THEN 'active' ELSE status END,
    updated_at = now()
  WHERE id = p_slot_id
  RETURNING * INTO v_updated;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Slot successfully released.',
    'slot', row_to_json(v_updated)
  );
END;
$$;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
