-- AVENTO Patch v34: Problem Statement PDF URL on Events Table
-- Run this in your Supabase SQL Editor if you want native column support for problem statement PDFs.

ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS problem_statement_pdf_url TEXT;

COMMENT ON COLUMN public.events.problem_statement_pdf_url IS 'Public storage URL for the event Problem Statement information PDF.';
