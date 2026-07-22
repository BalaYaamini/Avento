-- ============================================================
-- AVENTO SUPABASE PATCH V8 — User Management
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add status and first_login to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS first_login BOOLEAN DEFAULT true;

-- 2. Add constraint to status
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_status_check
  CHECK (status IN ('active', 'inactive'));
