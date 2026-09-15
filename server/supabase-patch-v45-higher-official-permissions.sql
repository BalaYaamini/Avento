-- ============================================================
-- AVENTO Supabase Patch v45 - Higher Official Event Permissions
-- ============================================================
-- Enables Student Coordinators and Faculty Coordinators to request
-- formal permissions from Higher Officials / University Admins
-- before an event proposal is approved.

BEGIN;

-- 1. Create table for official permissions
CREATE TABLE IF NOT EXISTS public.proposal_official_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  official_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject TEXT DEFAULT 'Formal Permission Request for Event Proposal',
  proposal_letter TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb, -- [{ file_name, file_url, file_type, file_size }]
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'granted', 'rejected', 'revision_requested'
  official_remarks TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup by proposal_id and official_id
CREATE INDEX IF NOT EXISTS idx_official_perms_proposal ON public.proposal_official_permissions(proposal_id);
CREATE INDEX IF NOT EXISTS idx_official_perms_official ON public.proposal_official_permissions(official_id);
CREATE INDEX IF NOT EXISTS idx_official_perms_status ON public.proposal_official_permissions(status);

-- Enable RLS
ALTER TABLE public.proposal_official_permissions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "proposal_official_permissions_all" ON public.proposal_official_permissions;
DROP POLICY IF EXISTS "proposal_official_permissions_select" ON public.proposal_official_permissions;
DROP POLICY IF EXISTS "proposal_official_permissions_insert" ON public.proposal_official_permissions;
DROP POLICY IF EXISTS "proposal_official_permissions_update" ON public.proposal_official_permissions;
DROP POLICY IF EXISTS "proposal_official_permissions_delete" ON public.proposal_official_permissions;

-- Permissive policies for authenticated users & service role
CREATE POLICY "proposal_official_permissions_select" ON public.proposal_official_permissions
  FOR SELECT TO anon, authenticated, service_role USING (true);

CREATE POLICY "proposal_official_permissions_insert" ON public.proposal_official_permissions
  FOR INSERT TO authenticated, service_role WITH CHECK (true);

CREATE POLICY "proposal_official_permissions_update" ON public.proposal_official_permissions
  FOR UPDATE TO authenticated, service_role USING (true) WITH CHECK (true);

CREATE POLICY "proposal_official_permissions_delete" ON public.proposal_official_permissions
  FOR DELETE TO authenticated, service_role USING (true);

-- Grant table privileges
DO $$
BEGIN
  GRANT ALL ON public.proposal_official_permissions TO service_role;
  GRANT ALL ON public.proposal_official_permissions TO authenticated;
  GRANT SELECT ON public.proposal_official_permissions TO anon;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Permissions notice: %', SQLERRM;
END
$$;

COMMIT;
