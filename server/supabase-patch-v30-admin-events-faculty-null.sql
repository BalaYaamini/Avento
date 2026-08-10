-- ============================================================
-- AVENTO Supabase Patch v30 - Admin Events Faculty Nullable
-- ============================================================

-- Allow faculty_id column in public.events to be NULL for Admin-created events
ALTER TABLE public.events ALTER COLUMN faculty_id DROP NOT NULL;
