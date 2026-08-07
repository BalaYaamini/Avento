-- ============================================================
-- AVENTO Supabase Schema Patch - Documents Storage Bucket
-- Run this in the Supabase SQL Editor to create the 'documents' bucket
-- ============================================================

-- Create 'documents' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ─── RLS POLICIES FOR 'documents' BUCKET ──────────────────────

-- 1. Public Read Access
DROP POLICY IF EXISTS "Public Access to Documents" ON storage.objects;
CREATE POLICY "Public Access to Documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'documents');

-- 2. Authenticated Insert Access
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
CREATE POLICY "Authenticated users can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

-- 3. Authenticated Update Access
DROP POLICY IF EXISTS "Authenticated users can update documents" ON storage.objects;
CREATE POLICY "Authenticated users can update documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'documents');

-- 4. Authenticated Delete Access
DROP POLICY IF EXISTS "Authenticated users can delete documents" ON storage.objects;
CREATE POLICY "Authenticated users can delete documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'documents');
