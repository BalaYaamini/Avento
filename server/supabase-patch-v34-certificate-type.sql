-- ============================================================
-- AVENTO Supabase Additive Migration Patch v34
-- Add certificate_type column to public.certificates table
-- DO NOT EXECUTE AUTOMATICALLY - Report for manual application
-- ============================================================

ALTER TABLE public.certificates 
  ADD COLUMN IF NOT EXISTS certificate_type TEXT DEFAULT 'participant';

-- Drop old unique constraint if present and add compound unique constraint including certificate_type
ALTER TABLE public.certificates 
  DROP CONSTRAINT IF EXISTS certificates_event_id_user_id_key;

ALTER TABLE public.certificates 
  ADD CONSTRAINT certificates_event_id_user_id_type_key UNIQUE (event_id, user_id, certificate_type);
