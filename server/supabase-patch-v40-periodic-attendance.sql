-- Supabase Patch v40: Configurable Periodic QR Attendance System
-- Creates event_attendance_periods, event_periodic_attendance, and adds configuration columns to events.

-- 1. Add Periodic Attendance Configuration Columns to events
ALTER TABLE public.events 
  ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS periodic_attendance_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS period_interval_hours NUMERIC DEFAULT 4,
  ADD COLUMN IF NOT EXISTS min_certificate_checkpoints INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS min_certificate_percentage NUMERIC DEFAULT 75;

-- 2. Create event_attendance_periods table
CREATE TABLE IF NOT EXISTS public.event_attendance_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  period_name VARCHAR(100) NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create event_periodic_attendance table with UNIQUE constraint
CREATE TABLE IF NOT EXISTS public.event_periodic_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  registration_id UUID NOT NULL REFERENCES public.event_registrations(id) ON DELETE CASCADE,
  attendance_period_id UUID NOT NULL REFERENCES public.event_attendance_periods(id) ON DELETE CASCADE,
  scanned_at TIMESTAMPTZ DEFAULT NOW(),
  scanned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT unique_registration_period UNIQUE (registration_id, attendance_period_id)
);

-- 4. Create Indexes for High Performance Queries
CREATE INDEX IF NOT EXISTS idx_periods_event_time ON public.event_attendance_periods(event_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_periodic_att_event_reg ON public.event_periodic_attendance(event_id, registration_id);
CREATE INDEX IF NOT EXISTS idx_periodic_att_period ON public.event_periodic_attendance(attendance_period_id);

-- Enable RLS on new tables
ALTER TABLE public.event_attendance_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_periodic_attendance ENABLE ROW LEVEL SECURITY;

-- Permissive RLS policies (matching existing project conventions)
DROP POLICY IF EXISTS "Allow public read event_attendance_periods" ON public.event_attendance_periods;
CREATE POLICY "Allow public read event_attendance_periods" ON public.event_attendance_periods FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated all event_attendance_periods" ON public.event_attendance_periods;
CREATE POLICY "Allow authenticated all event_attendance_periods" ON public.event_attendance_periods FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read event_periodic_attendance" ON public.event_periodic_attendance;
CREATE POLICY "Allow public read event_periodic_attendance" ON public.event_periodic_attendance FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated all event_periodic_attendance" ON public.event_periodic_attendance;
CREATE POLICY "Allow authenticated all event_periodic_attendance" ON public.event_periodic_attendance FOR ALL USING (true) WITH CHECK (true);
