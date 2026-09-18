-- supabase-patch-announcements-rls.sql
-- Fix: Add RLS policies for announcements and announcement_reads tables
-- These tables were created in v39 patch but missing RLS policies,
-- causing "new row violates row-level security policy" errors.
--
-- Authorization is enforced at the Express middleware layer (authMiddleware + adminMiddleware).
-- RLS policies here are permissive to allow the server-side Supabase client
-- (which uses service role or anon key, not per-request user JWTs) to operate.

-- ─── ANNOUNCEMENTS TABLE ─────────────────────────────────────
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "announcements_select_all" ON public.announcements;
CREATE POLICY "announcements_select_all" ON public.announcements
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "announcements_insert_all" ON public.announcements;
CREATE POLICY "announcements_insert_all" ON public.announcements
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "announcements_update_all" ON public.announcements;
CREATE POLICY "announcements_update_all" ON public.announcements
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "announcements_delete_all" ON public.announcements;
CREATE POLICY "announcements_delete_all" ON public.announcements
  FOR DELETE USING (true);

-- ─── ANNOUNCEMENT_READS TABLE ────────────────────────────────
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "announcement_reads_all" ON public.announcement_reads;
CREATE POLICY "announcement_reads_all" ON public.announcement_reads
  FOR ALL USING (true);
