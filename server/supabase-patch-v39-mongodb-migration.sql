-- supabase-patch-v39-mongodb-migration.sql
-- Migration: Remove MongoDB dependency, move all data to Supabase
-- Run this BEFORE deploying the code changes

-- 1. OTPs table (replaces MongoDB otps collection)
CREATE TABLE IF NOT EXISTS public.otps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  otp TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otps_email ON public.otps(email);

-- OTP TTL is handled in application code (cleanup on read + periodic delete)

-- 2. Announcements table (replaces MongoDB announcements collection)
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL CHECK (char_length(title) <= 140),
  message TEXT NOT NULL CHECK (char_length(message) <= 5000),
  image_url TEXT DEFAULT '',
  audience TEXT DEFAULT 'all' CHECK (audience IN ('all', 'registered')),
  status TEXT DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  event_id TEXT DEFAULT '',
  event_name TEXT DEFAULT '',
  author_id TEXT NOT NULL,
  author_name TEXT DEFAULT 'Administrator',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_status ON public.announcements(status);
CREATE INDEX IF NOT EXISTS idx_announcements_event_id ON public.announcements(event_id);

-- 3. Announcement reads table (replaces MongoDB announcementreads collection)
CREATE TABLE IF NOT EXISTS public.announcement_reads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, announcement_id)
);

CREATE INDEX IF NOT EXISTS idx_announcement_reads_user ON public.announcement_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_announcement ON public.announcement_reads(announcement_id);

-- RLS policies for announcements (authorization enforced at Express middleware layer)
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "announcements_select_all" ON public.announcements;
CREATE POLICY "announcements_select_all" ON public.announcements FOR SELECT USING (true);
DROP POLICY IF EXISTS "announcements_insert_all" ON public.announcements;
CREATE POLICY "announcements_insert_all" ON public.announcements FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "announcements_update_all" ON public.announcements;
CREATE POLICY "announcements_update_all" ON public.announcements FOR UPDATE USING (true);
DROP POLICY IF EXISTS "announcements_delete_all" ON public.announcements;
CREATE POLICY "announcements_delete_all" ON public.announcements FOR DELETE USING (true);

-- RLS policies for announcement_reads
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "announcement_reads_all" ON public.announcement_reads;
CREATE POLICY "announcement_reads_all" ON public.announcement_reads FOR ALL USING (true);

-- 4. Problem statement documents table (replaces MongoDB problem_statement_documents)
CREATE TABLE IF NOT EXISTS public.problem_statement_documents (
  event_id TEXT PRIMARY KEY,
  pdf_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
