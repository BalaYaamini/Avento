-- ============================================================
-- AVENTO Supabase Patch v9 - Proposal Workspace
-- ============================================================

-- 1. Create Proposal Discussions Table
CREATE TABLE IF NOT EXISTS public.proposal_discussions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Proposal Documents Table
CREATE TABLE IF NOT EXISTS public.proposal_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Proposal Timeline Table
CREATE TABLE IF NOT EXISTS public.proposal_timeline (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Update Events Table for Revision Tracking
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS revision_number INTEGER DEFAULT 1;

-- 5. Update Status Constraints
-- We must drop the existing constraint and re-add it to allow new statuses.
-- Also we migrate 'pending_approval' to 'submitted' for the new workflow.
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_status_check;
ALTER TABLE public.events ADD CONSTRAINT events_status_check
  CHECK (status IN ('draft', 'submitted', 'under_review', 'needs_revision', 'approved', 'rejected', 'published', 'completed', 'cancelled', 'active', 'withdrawn', 'pending_approval'));

-- Migrate existing pending proposals
UPDATE public.events SET status = 'submitted' WHERE status = 'pending_approval';

-- 6. Enable RLS
ALTER TABLE public.proposal_discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_timeline ENABLE ROW LEVEL SECURITY;

-- 7. Basic RLS Policies for Discussions
DROP POLICY IF EXISTS "proposal_discussions_select" ON public.proposal_discussions;
CREATE POLICY "proposal_discussions_select" ON public.proposal_discussions
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "proposal_discussions_insert" ON public.proposal_discussions;
CREATE POLICY "proposal_discussions_insert" ON public.proposal_discussions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 8. Basic RLS Policies for Documents
DROP POLICY IF EXISTS "proposal_documents_select" ON public.proposal_documents;
CREATE POLICY "proposal_documents_select" ON public.proposal_documents
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "proposal_documents_insert" ON public.proposal_documents;
CREATE POLICY "proposal_documents_insert" ON public.proposal_documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 9. Basic RLS Policies for Timeline
DROP POLICY IF EXISTS "proposal_timeline_select" ON public.proposal_timeline;
CREATE POLICY "proposal_timeline_select" ON public.proposal_timeline
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "proposal_timeline_insert" ON public.proposal_timeline;
CREATE POLICY "proposal_timeline_insert" ON public.proposal_timeline
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
