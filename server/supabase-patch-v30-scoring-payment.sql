-- AVENTO scoring and payment gate patch.
-- Run in the Supabase SQL Editor after supabase-full-schema.sql.
-- Safe to run more than once.

-- ============================================================
-- PAYMENT GATE (UPI / UTR VERIFICATION)
-- ============================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS payment_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS payment_upi_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_qr_url TEXT,
  ADD COLUMN IF NOT EXISTS payment_instructions TEXT;

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS utr_number TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS payment_verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_verified_at TIMESTAMPTZ;

ALTER TABLE public.event_registrations
  DROP CONSTRAINT IF EXISTS event_registrations_payment_status_check;

ALTER TABLE public.event_registrations
  ADD CONSTRAINT event_registrations_payment_status_check
  CHECK (payment_status IN ('pending', 'submitted', 'verified', 'rejected'));

-- A UTR can only be used by one registration.
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

CREATE INDEX IF NOT EXISTS event_registrations_payment_status_idx
  ON public.event_registrations (event_id, payment_status);

-- The QR must be readable before login so participants can make payment.
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-qr', 'payment-qr', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

DROP POLICY IF EXISTS "Public can read payment QR codes" ON storage.objects;
CREATE POLICY "Public can read payment QR codes" ON storage.objects
  FOR SELECT USING (bucket_id = 'payment-qr');

DROP POLICY IF EXISTS "Authenticated users can upload payment QR codes" ON storage.objects;
CREATE POLICY "Authenticated users can upload payment QR codes" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-qr');

DROP POLICY IF EXISTS "Authenticated users can update payment QR codes" ON storage.objects;
CREATE POLICY "Authenticated users can update payment QR codes" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'payment-qr')
  WITH CHECK (bucket_id = 'payment-qr');

-- ============================================================
-- LIVE SCORING
-- ============================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS scoring_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS scoreboard_visible BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.scoring_rounds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.scoring_subrounds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  round_id UUID NOT NULL REFERENCES public.scoring_rounds(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  max_score NUMERIC(10, 2) NOT NULL DEFAULT 100 CHECK (max_score >= 0),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.scoring_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.event_teams(id) ON DELETE CASCADE,
  subround_id UUID NOT NULL REFERENCES public.scoring_subrounds(id) ON DELETE CASCADE,
  score NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (score >= 0),
  evaluator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, subround_id)
);

CREATE INDEX IF NOT EXISTS scoring_rounds_event_idx
  ON public.scoring_rounds(event_id, display_order);

CREATE INDEX IF NOT EXISTS scoring_subrounds_round_idx
  ON public.scoring_subrounds(round_id, display_order);

CREATE INDEX IF NOT EXISTS scoring_scores_event_idx
  ON public.scoring_scores(event_id, team_id);

-- The API uses the service role and enforces event ownership/visibility. Keep
-- direct client access disabled so unpublished scores cannot be bypassed.
ALTER TABLE public.scoring_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoring_subrounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoring_scores ENABLE ROW LEVEL SECURITY;
