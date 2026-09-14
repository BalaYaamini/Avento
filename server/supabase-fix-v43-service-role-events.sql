-- Fix: Allow service_role full access to events table
-- Paste this entire block into Supabase SQL Editor and run it

-- Step 1: Grant BYPASSRLS to service_role on events
DO $$
BEGIN
  GRANT BYPASSRLS ON public.events TO service_role;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not grant BYPASSRLS: %', SQLERRM;
END
$$;

-- Step 2: Create explicit service_role policy as safety net
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'events_service_role_full_access'
      AND tablename = 'events'
      AND schemaname = 'public'
  ) THEN
    CREATE POLICY "events_service_role_full_access" ON public.events
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
    RAISE NOTICE 'Created events_service_role_full_access policy';
  ELSE
    RAISE NOTICE 'Policy already exists';
  END IF;
END
$$;
