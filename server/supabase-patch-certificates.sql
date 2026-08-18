-- ============================================================
-- AVENTO Supabase Schema Update for Certificates
-- Run this in the Supabase SQL Editor
-- ============================================================

-- ─── EVENTS TABLE UPDATES ────────────────────────────────────
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS certificate_template TEXT,
  ADD COLUMN IF NOT EXISTS certificate_template_uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS certificate_template_uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS certificate_fields_config JSONB;

-- ─── CERTIFICATES TABLE ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.certificates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  certificate_id TEXT NOT NULL UNIQUE,
  certificate_url TEXT NOT NULL,
  status TEXT DEFAULT 'valid',
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'valid';

-- ─── RLS POLICIES FOR CERTIFICATES ───────────────────────────
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- Allow public verification of certificates by certificate_id
DROP POLICY IF EXISTS "certificates_select_public_verify" ON public.certificates;
CREATE POLICY "certificates_select_public_verify" ON public.certificates
  FOR SELECT USING (true);

-- Event organizers and faculty can insert/update/delete (Admin bypassed by service role)
DROP POLICY IF EXISTS "certificates_insert_auth" ON public.certificates;
CREATE POLICY "certificates_insert_auth" ON public.certificates
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "certificates_update_auth" ON public.certificates;
CREATE POLICY "certificates_update_auth" ON public.certificates
  FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "certificates_delete_auth" ON public.certificates;
CREATE POLICY "certificates_delete_auth" ON public.certificates
  FOR DELETE USING (auth.uid() IS NOT NULL);
