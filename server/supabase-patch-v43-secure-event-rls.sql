-- ============================================================
-- AVENTO Supabase Patch v43 - Secure Event Row Level Security (RLS)
-- ============================================================
-- Purpose:
-- 1. Restrict public/anonymous reads to ONLY events with status = 'published'.
-- 2. Prevent exposure of drafts, pending proposals, under-review proposals,
--    revision requests, rejected proposals, and withdrawn events via direct Supabase queries.
-- 3. Restrict authenticated proposal reads to authorized participants:
--    - Avento Administrator (role = 'admin' in profiles)
--    - The original student proposer (proposed_by, created_by)
--    - The assigned faculty coordinator (faculty_id)
--    - Users explicitly assigned in event_organizers or event_members
-- 4. Prevent direct-write authorization bypass:
--    - The frontend does NOT write directly to `events` via Supabase client;
--      all creation, updates, status transitions, and deletions flow through Express
--      routes that use the Supabase Service Role key (bypassing RLS).
--    - Direct client writes (INSERT, UPDATE, DELETE) by anon or ordinary authenticated
--      clients are denied so clients cannot manipulate status, publishing, or faculty fields.
-- 5. Explicitly and safely drop all existing open/permissive policies on `events`
--    so no permissive `USING (true)` policy remains.
--
-- IMPORTANT:
-- Do NOT execute this migration against the production database automatically.
-- Review rollback instructions at the bottom of this file.
-- ============================================================

BEGIN;

-- 1. Ensure RLS is active on public.events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- 2. Explicitly drop all known existing permissive policies on public.events
-- (PostgreSQL combines permissive policies with OR; any remaining USING (true) policy would negate security)
DROP POLICY IF EXISTS "events_select_all" ON public.events;
DROP POLICY IF EXISTS "events_select_secure" ON public.events;
DROP POLICY IF EXISTS "Allow public read-only access to events" ON public.events;
DROP POLICY IF EXISTS "Allow public read access to events" ON public.events;
DROP POLICY IF EXISTS "Public can view events" ON public.events;
DROP POLICY IF EXISTS "events_public_select" ON public.events;
DROP POLICY IF EXISTS "events_public_select_published" ON public.events;
DROP POLICY IF EXISTS "events_auth_select_participant_or_admin" ON public.events;

-- Also drop any permissive write policies
DROP POLICY IF EXISTS "events_insert_auth" ON public.events;
DROP POLICY IF EXISTS "events_update_auth" ON public.events;
DROP POLICY IF EXISTS "events_delete_auth" ON public.events;
DROP POLICY IF EXISTS "events_auth_update_owner_or_admin" ON public.events;

-- 3. Create SECURE SELECT policies on public.events

-- Policy 3a: Public / Anonymous users can ONLY read published events
CREATE POLICY "events_select_published_public" ON public.events
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

-- Policy 3b: Authenticated participants can view their own non-published proposals/events
CREATE POLICY "events_select_proposals_authenticated" ON public.events
  FOR SELECT
  TO authenticated
  USING (
    status != 'published'
    AND (
      -- Avento Admin
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
      )
      -- Original student proposer / creator
      OR proposed_by = auth.uid()
      OR created_by = auth.uid()
      -- Assigned faculty coordinator
      OR faculty_id = auth.uid()
      -- Explicitly assigned event organizer
      OR EXISTS (
        SELECT 1 FROM public.event_organizers
        WHERE event_organizers.event_id = events.id
          AND event_organizers.student_id = auth.uid()
      )
      -- Explicitly assigned event member
      OR EXISTS (
        SELECT 1 FROM public.event_members
        WHERE event_members.event_id = events.id
          AND event_members.user_id = auth.uid()
      )
    )
  );

-- 4. Direct Client Write Protection:
-- All legitimate event creations, edits, status transitions, and deletions
-- pass through the Express backend using the Supabase Service Role key,
-- which bypasses RLS.
-- Therefore, we explicitly deny direct client writes (or restrict them strictly to admin)
-- to prevent students/faculty from directly modifying proposal status, approval marks, or publishing flags.

-- Only allow Avento Admin direct insert if needed (regular users must use Express /api/events)
CREATE POLICY "events_direct_insert_admin_only" ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Only allow Avento Admin direct update if needed (regular users must use Express /api/events)
CREATE POLICY "events_direct_update_admin_only" ON public.events
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Only allow Avento Admin direct delete if needed (regular users must use Express /api/events)
CREATE POLICY "events_direct_delete_admin_only" ON public.events
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

COMMIT;

-- ============================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================
-- If you need to revert these policies to the previous permissive configuration,
-- run the following block in the Supabase SQL editor:
--
-- BEGIN;
-- DROP POLICY IF EXISTS "events_select_published_public" ON public.events;
-- DROP POLICY IF EXISTS "events_select_proposals_authenticated" ON public.events;
-- DROP POLICY IF EXISTS "events_direct_insert_admin_only" ON public.events;
-- DROP POLICY IF EXISTS "events_direct_update_admin_only" ON public.events;
-- DROP POLICY IF EXISTS "events_direct_delete_admin_only" ON public.events;
--
-- CREATE POLICY "events_select_all" ON public.events FOR SELECT USING (true);
-- CREATE POLICY "events_insert_auth" ON public.events FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
-- CREATE POLICY "events_update_auth" ON public.events FOR UPDATE USING (auth.uid() IS NOT NULL);
-- CREATE POLICY "events_delete_auth" ON public.events FOR DELETE USING (auth.uid() IS NOT NULL);
-- COMMIT;
-- ============================================================
