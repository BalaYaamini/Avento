-- ============================================================
-- AVENTO Supabase Schema Patch - Posters Storage Bucket
-- Run this in the Supabase SQL Editor to create the 'posters' bucket
-- ============================================================

-- Create 'posters' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('posters', 'posters', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ─── RLS POLICIES FOR 'posters' BUCKET ──────────────────────

-- 1. Public Read Access
DROP POLICY IF EXISTS "Public Access to Posters" ON storage.objects;
CREATE POLICY "Public Access to Posters"
ON storage.objects FOR SELECT
USING (bucket_id = 'posters');

-- 2. Authenticated Insert Access
DROP POLICY IF EXISTS "Authenticated users can upload posters" ON storage.objects;
CREATE POLICY "Authenticated users can upload posters"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'posters');

-- 3. Authenticated Update Access (optional for replacing)
DROP POLICY IF EXISTS "Authenticated users can update posters" ON storage.objects;
CREATE POLICY "Authenticated users can update posters"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'posters');

-- 4. Authenticated Delete Access (optional for cleanup)
DROP POLICY IF EXISTS "Authenticated users can delete posters" ON storage.objects;
CREATE POLICY "Authenticated users can delete posters"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'posters');
