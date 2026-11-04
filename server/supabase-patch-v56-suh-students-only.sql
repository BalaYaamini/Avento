-- ============================================================
-- AVENTO Supabase Patch v56: Add suh_students_only to events
-- Per-event toggle. When TRUE, only Sreenidhi University email
-- addresses (@suh.edu.in or any subdomain like @cse.suh.edu.in,
-- @aiml.suh.edu.in, @ds.suh.edu.in, @sap.suh.edu.in) can register.
-- Run this in the Supabase SQL Editor.
-- ============================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS suh_students_only BOOLEAN NOT NULL DEFAULT FALSE;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
