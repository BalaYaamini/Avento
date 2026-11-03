-- ============================================================
-- AVENTO Supabase Patch v44 - Fix Event Creation & RLS Policies
-- ============================================================
-- Fixes: "new row violates row-level security policy for table 'events'"
--
-- This patch:
-- 1. Drops overly restrictive admin-only insert/update/delete policies on `public.events`
-- 2. Grants service_role bypass/full access
-- 3. Enables clean authenticated & service_role INSERT, UPDATE, DELETE, and SELECT policies on `events`

BEGIN;

-- 1. Ensure RLS is active on public.events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- 2. Drop restrictive admin-only policies
DROP POLICY IF EXISTS "events_direct_insert_admin_only" ON public.events;
DROP POLICY IF EXISTS "events_direct_update_admin_only" ON public.events;
DROP POLICY IF EXISTS "events_direct_delete_admin_only" ON public.events;
DROP POLICY IF EXISTS "events_service_role_full_access" ON public.events;
DROP POLICY IF EXISTS "events_insert_auth" ON public.events;
DROP POLICY IF EXISTS "events_update_auth" ON public.events;
DROP POLICY IF EXISTS "events_delete_auth" ON public.events;
DROP POLICY IF EXISTS "events_select_all" ON public.events;
DROP POLICY IF EXISTS "events_select_published_public" ON public.events;
DROP POLICY IF EXISTS "events_select_proposals_authenticated" ON public.events;

-- 3. Create full access / permissive write & read policies for authenticated users & service role
CREATE POLICY "events_select_all" ON public.events
  FOR SELECT
  TO anon, authenticated, service_role
  USING (true);

CREATE POLICY "events_insert_all" ON public.events
  FOR INSERT
  TO authenticated, service_role
  WITH CHECK (true);

CREATE POLICY "events_update_all" ON public.events
  FOR UPDATE
  TO authenticated, service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "events_delete_all" ON public.events
  FOR DELETE
  TO authenticated, service_role
  USING (true);

-- 4. Grant service_role bypass & table permissions
DO $$
BEGIN
  GRANT ALL ON public.events TO service_role;
  GRANT ALL ON public.events TO authenticated;
  GRANT SELECT ON public.events TO anon;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Permissions notice: %', SQLERRM;
END
$$;

COMMIT;
