-- ============================================================
-- AVENTO - Patch v64: Per-event feedback toggle
-- Adds events.feedback_enabled so organizers can open/close
-- feedback from the Workspace. Default FALSE keeps feedback
-- closed until an organizer enables it (or the event is marked
-- as completed, which enables it automatically).
-- Run in the Supabase Dashboard -> SQL Editor.
-- ============================================================

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS feedback_enabled BOOLEAN NOT NULL DEFAULT FALSE;

NOTIFY pgrst, 'reload schema';
