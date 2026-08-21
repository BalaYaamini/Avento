-- ============================================================
-- AVENTO SUPABASE PATCH v38 — Custom Feedback Questions
-- Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================================

-- 1. Add feedback_questions column to events table
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS feedback_questions JSONB DEFAULT NULL;

-- 2. Add responses column to feedbacks table
ALTER TABLE public.feedbacks 
ADD COLUMN IF NOT EXISTS responses JSONB DEFAULT NULL;
