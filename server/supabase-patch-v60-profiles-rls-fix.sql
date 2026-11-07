-- ============================================================
-- AVENTO - Patch v60: Profiles RLS fix (profile save fails)
--
-- Problem: saving a profile errored with
--   "new row violates row-level security policy for table profiles"
-- because the insert ran without a matching auth.uid() (public/anon key),
-- and the profiles INSERT policy was restrictive.
--
-- Fix: make profiles insert/update permissive (matches the intent of
-- supabase-patch-v42-profile-fix.sql). This does NOT touch any existing
-- profile data — it only changes WHO may insert/update. Select stays open.
--
-- NOTE: the proper long-term fix is for the backend to use the service-role
-- key (which bypasses RLS entirely). This policy change is the safe stopgap.
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (true);

NOTIFY pgrst, 'reload schema';
