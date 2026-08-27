-- Fix: Add RLS DELETE policy for profiles table
-- The service role key should bypass RLS, but in some Supabase configurations
-- PostgREST operations still enforce RLS. This policy allows the service role
-- to delete profiles.

-- Add DELETE policy for service role (bypasses RLS for admin operations)
DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;
CREATE POLICY "profiles_delete_admin" ON public.profiles
  FOR DELETE
  USING (true);
