-- ============================================================
-- AVENTO SUPABASE PATCH — Feedback Module
-- Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================================

-- ─── 1. FEEDBACKS table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feedbacks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_rating INTEGER CHECK (content_rating BETWEEN 1 AND 5),
  speaker_rating INTEGER CHECK (speaker_rating BETWEEN 1 AND 5),
  organization_rating INTEGER CHECK (organization_rating BETWEEN 1 AND 5),
  engagement_rating INTEGER CHECK (engagement_rating BETWEEN 1 AND 5),
  overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
  suggestions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- ─── 2. Enable Row Level Security ─────────────────────────────
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

-- ─── 3. RLS POLICIES ──────────────────────────────────────────
DROP POLICY IF EXISTS "feedbacks_select_all" ON public.feedbacks;
CREATE POLICY "feedbacks_select_all" ON public.feedbacks FOR SELECT USING (true);

DROP POLICY IF EXISTS "feedbacks_insert_auth" ON public.feedbacks;
CREATE POLICY "feedbacks_insert_auth" ON public.feedbacks FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "feedbacks_update_auth" ON public.feedbacks;
CREATE POLICY "feedbacks_update_auth" ON public.feedbacks FOR UPDATE USING (auth.uid() = user_id);
