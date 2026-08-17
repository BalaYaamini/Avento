-- AVENTO Patch v35: Problem Statement Code Column
-- Run this in your Supabase SQL Editor to add problem statement code support (e.g. PS01, PS02).

ALTER TABLE public.event_problem_statements 
ADD COLUMN IF NOT EXISTS code TEXT DEFAULT '';

COMMENT ON COLUMN public.event_problem_statements.code IS 'Unique problem statement identifier code (e.g. PS01, PS02).';
