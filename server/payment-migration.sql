-- AVENTO payment support. Run this once in Supabase SQL Editor.
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS payment_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(10, 2);
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS payment_upi_id TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS payment_qr_url TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS payment_instructions TEXT;

ALTER TABLE public.event_registrations ADD COLUMN IF NOT EXISTS utr_number TEXT;
ALTER TABLE public.event_registrations ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.event_registrations ADD COLUMN IF NOT EXISTS payment_rejection_reason TEXT;
ALTER TABLE public.event_registrations ADD COLUMN IF NOT EXISTS payment_verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.event_registrations ADD COLUMN IF NOT EXISTS payment_verified_at TIMESTAMPTZ;

ALTER TABLE public.event_registrations DROP CONSTRAINT IF EXISTS event_registrations_payment_status_check;
ALTER TABLE public.event_registrations ADD CONSTRAINT event_registrations_payment_status_check
  CHECK (payment_status IN ('pending', 'submitted', 'verified', 'rejected'));

-- A UTR identifies one bank transaction and may only be submitted once.
CREATE UNIQUE INDEX IF NOT EXISTS event_registrations_utr_number_unique
  ON public.event_registrations (UPPER(TRIM(utr_number)))
  WHERE utr_number IS NOT NULL AND TRIM(utr_number) <> '';

CREATE TABLE IF NOT EXISTS public.payment_verification_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  registration_id UUID NOT NULL REFERENCES public.event_registrations(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  utr_number TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('submitted', 'verified', 'rejected')),
  reason TEXT,
  acted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  acted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payment_verification_history_registration_idx
  ON public.payment_verification_history (registration_id, acted_at DESC);

-- Public read is intentional: published event QR images must be visible before login/payment.
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-qr', 'payment-qr', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

DROP POLICY IF EXISTS "Public can read payment QR codes" ON storage.objects;
CREATE POLICY "Public can read payment QR codes" ON storage.objects
  FOR SELECT USING (bucket_id = 'payment-qr');

DROP POLICY IF EXISTS "Authenticated users can upload payment QR codes" ON storage.objects;
CREATE POLICY "Authenticated users can upload payment QR codes" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'payment-qr');

DROP POLICY IF EXISTS "Authenticated users can update payment QR codes" ON storage.objects;
CREATE POLICY "Authenticated users can update payment QR codes" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'payment-qr') WITH CHECK (bucket_id = 'payment-qr');
