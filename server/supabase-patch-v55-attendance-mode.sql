-- ============================================================
-- AVENTO Supabase Patch v55: Add attendance_mode to events
-- Toggle between QR-based attendance ('qr') and manual
-- attendance ('manual') on a per-event basis.
-- Run this in the Supabase SQL Editor.
-- ============================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS attendance_mode TEXT NOT NULL DEFAULT 'qr';

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_attendance_mode_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_attendance_mode_check CHECK (attendance_mode IN ('qr', 'manual'));

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
