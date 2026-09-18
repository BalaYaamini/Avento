-- ============================================================
-- AVENTO - Complete Supabase Schema (Fresh Install)
-- Run this in Supabase SQL Editor: Dashboard > SQL Editor > New Query > Paste > Run
-- ============================================================
-- This script creates ALL tables, RLS policies, RPC functions,
-- and constraints needed for the Avento platform.
-- ============================================================

-- ─── 0. PROFILES TABLE (Supabase Auth extended) ─────────────
-- Creates the profiles table linked to Supabase auth.users.
-- This table stores additional user metadata used by Avento.
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student'
    CHECK (role IN ('admin', 'student', 'faculty', 'student_organizer', 'faculty_organizer', 'organizer')),
  status TEXT DEFAULT 'active',
  first_login BOOLEAN DEFAULT true,
  department TEXT,
  employee_id TEXT,
  roll_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ─── 1. EVENTS TABLE ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft', 'submitted', 'pending_approval', 'under_review', 'needs_revision',
    'approved', 'rejected', 'published', 'completed', 'cancelled', 'active', 'withdrawn'
  )),
  category TEXT,
  venue TEXT,
  date TIMESTAMPTZ,
  capacity INTEGER,
  image_url TEXT,

  -- Organizer references
  proposed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  faculty_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  organizer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  student_organizer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Approval & publishing
  approval_remarks TEXT,
  approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Counts
  registered_count INTEGER DEFAULT 0,
  attendance_count INTEGER DEFAULT 0,

  -- Team registration settings
  registration_type TEXT DEFAULT 'individual',
  max_teams INTEGER,
  min_team_size INTEGER DEFAULT 1,
  max_team_size INTEGER DEFAULT 1,
  allow_cross_department BOOLEAN DEFAULT true,
  team_leader_registration_required BOOLEAN DEFAULT true,
  join_team_enabled BOOLEAN DEFAULT false,

  -- Registration deadline
  registration_deadline TIMESTAMPTZ,

  -- Optional UPI payment settings
  payment_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  payment_amount NUMERIC(10, 2),
  payment_upi_id TEXT,
  payment_qr_url TEXT,
  payment_instructions TEXT,

  -- Proposal revision tracking
  revision_number INTEGER DEFAULT 1,

  -- Certificate template settings
  certificate_template TEXT,
  certificate_template_uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  certificate_template_uploaded_at TIMESTAMPTZ,
  certificate_fields_config JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ─── 2. EVENT_MEMBERS TABLE ─────────────────────────────────
-- Pre-publication organizers / team members assigned to an event
CREATE TABLE IF NOT EXISTS public.event_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  roll_number TEXT,
  email TEXT,
  role TEXT DEFAULT 'Volunteer',
  organizer_type TEXT DEFAULT 'normal',
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ─── 3. EVENT_TEAMS TABLE ───────────────────────────────────
-- Teams for team-registration events
CREATE TABLE IF NOT EXISTS public.event_teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  leader_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  leader_contact_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, name)
);


-- ─── 4. EVENT_REGISTRATIONS TABLE ───────────────────────────
-- Individual and team member registrations
CREATE TABLE IF NOT EXISTS public.event_registrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.event_teams(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'registered',
  attendance_status TEXT DEFAULT 'Absent',
  attendance_timestamp TIMESTAMPTZ,
  utr_number TEXT,
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'submitted', 'verified', 'rejected')),
  payment_rejection_reason TEXT,
  payment_verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  payment_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

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


-- ─── 5. EVENT_ORGANIZERS TABLE ──────────────────────────────
-- Recruited student organizers (post-publication)
CREATE TABLE IF NOT EXISTS public.event_organizers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  organizer_role TEXT DEFAULT 'normal' CHECK (organizer_role IN ('core', 'normal')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, student_id)
);


-- ─── 6. ORGANIZER_REQUESTS TABLE ────────────────────────────
-- Join team requests from students
CREATE TABLE IF NOT EXISTS public.organizer_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, student_id)
);


-- ─── 7. TASKS TABLE ─────────────────────────────────────────
-- Event workspace tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  priority TEXT DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
  status TEXT DEFAULT 'To Do' CHECK (status IN ('To Do', 'In Progress', 'Completed', 'Blocked')),
  deadline TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ─── 8. TASK_COMMENTS TABLE ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.task_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ─── 9. NOTIFICATIONS TABLE ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ─── 10. CERTIFICATES TABLE ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.certificates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  certificate_id TEXT NOT NULL UNIQUE,
  certificate_url TEXT NOT NULL,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);


-- ─── 11. FEEDBACKS TABLE ────────────────────────────────────
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


-- ─── 12. PROPOSAL_DISCUSSIONS TABLE ─────────────────────────
CREATE TABLE IF NOT EXISTS public.proposal_discussions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ─── 13. PROPOSAL_DOCUMENTS TABLE ───────────────────────────
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


-- ─── 14. PROPOSAL_TIMELINE TABLE ────────────────────────────
CREATE TABLE IF NOT EXISTS public.proposal_timeline (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ─── 15. ANNOUNCEMENTS TABLE ─────────────────────────────────
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

-- ─── 16. ANNOUNCEMENT_READS TABLE ────────────────────────────
CREATE TABLE IF NOT EXISTS public.announcement_reads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, announcement_id)
);

CREATE INDEX IF NOT EXISTS idx_announcement_reads_user ON public.announcement_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_announcement ON public.announcement_reads(announcement_id);

-- ─── 17. TEAM_ALLOCATIONS TABLE ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.team_allocations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.event_teams(id) ON DELETE CASCADE,
  venue_room TEXT NOT NULL,
  problem_statement TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, team_id)
);


-- ══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ══════════════════════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_organizers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;

-- ─── ANNOUNCEMENTS ──────────────────────────────────────────
DROP POLICY IF EXISTS "announcements_select_all" ON public.announcements;
CREATE POLICY "announcements_select_all" ON public.announcements FOR SELECT USING (true);

DROP POLICY IF EXISTS "announcements_insert_all" ON public.announcements;
CREATE POLICY "announcements_insert_all" ON public.announcements FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "announcements_update_all" ON public.announcements;
CREATE POLICY "announcements_update_all" ON public.announcements FOR UPDATE USING (true);

DROP POLICY IF EXISTS "announcements_delete_all" ON public.announcements;
CREATE POLICY "announcements_delete_all" ON public.announcements FOR DELETE USING (true);

-- ─── ANNOUNCEMENT_READS ─────────────────────────────────────
DROP POLICY IF EXISTS "announcement_reads_all" ON public.announcement_reads;
CREATE POLICY "announcement_reads_all" ON public.announcement_reads FOR ALL USING (true);

-- ─── PROFILES ───────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- ─── EVENTS ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "events_select_all" ON public.events;
CREATE POLICY "events_select_all" ON public.events FOR SELECT USING (true);

DROP POLICY IF EXISTS "events_insert_auth" ON public.events;
CREATE POLICY "events_insert_auth" ON public.events FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "events_update_auth" ON public.events;
CREATE POLICY "events_update_auth" ON public.events FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "events_delete_auth" ON public.events;
CREATE POLICY "events_delete_auth" ON public.events FOR DELETE USING (auth.uid() IS NOT NULL);

-- ─── EVENT_MEMBERS ──────────────────────────────────────────
DROP POLICY IF EXISTS "event_members_all" ON public.event_members;
CREATE POLICY "event_members_all" ON public.event_members FOR ALL USING (auth.uid() IS NOT NULL);

-- ─── EVENT_TEAMS ────────────────────────────────────────────
DROP POLICY IF EXISTS "event_teams_select_all" ON public.event_teams;
CREATE POLICY "event_teams_select_all" ON public.event_teams FOR SELECT USING (true);

DROP POLICY IF EXISTS "event_teams_insert_auth" ON public.event_teams;
CREATE POLICY "event_teams_insert_auth" ON public.event_teams FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "event_teams_update_auth" ON public.event_teams;
CREATE POLICY "event_teams_update_auth" ON public.event_teams FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "event_teams_delete_auth" ON public.event_teams;
CREATE POLICY "event_teams_delete_auth" ON public.event_teams FOR DELETE USING (auth.uid() IS NOT NULL);

-- ─── EVENT_REGISTRATIONS ────────────────────────────────────
DROP POLICY IF EXISTS "event_registrations_select_own" ON public.event_registrations;
CREATE POLICY "event_registrations_select_own" ON public.event_registrations
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "event_registrations_insert_auth" ON public.event_registrations;
CREATE POLICY "event_registrations_insert_auth" ON public.event_registrations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "event_registrations_delete_own" ON public.event_registrations;
CREATE POLICY "event_registrations_delete_own" ON public.event_registrations
  FOR DELETE USING (auth.uid() = user_id OR auth.uid() IS NOT NULL);

-- ─── EVENT_ORGANIZERS ───────────────────────────────────────
DROP POLICY IF EXISTS "event_organizers_all" ON public.event_organizers;
CREATE POLICY "event_organizers_all" ON public.event_organizers FOR ALL USING (auth.uid() IS NOT NULL);

-- ─── ORGANIZER_REQUESTS ─────────────────────────────────────
DROP POLICY IF EXISTS "organizer_requests_all" ON public.organizer_requests;
CREATE POLICY "organizer_requests_all" ON public.organizer_requests FOR ALL USING (auth.uid() IS NOT NULL);

-- ─── TASKS ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "tasks_select_all" ON public.tasks;
CREATE POLICY "tasks_select_all" ON public.tasks FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "tasks_insert_auth" ON public.tasks;
CREATE POLICY "tasks_insert_auth" ON public.tasks FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "tasks_update_auth" ON public.tasks;
CREATE POLICY "tasks_update_auth" ON public.tasks FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "tasks_delete_auth" ON public.tasks;
CREATE POLICY "tasks_delete_auth" ON public.tasks FOR DELETE USING (auth.uid() IS NOT NULL);

-- ─── TASK_COMMENTS ──────────────────────────────────────────
DROP POLICY IF EXISTS "task_comments_select_all" ON public.task_comments;
CREATE POLICY "task_comments_select_all" ON public.task_comments FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "task_comments_insert_auth" ON public.task_comments;
CREATE POLICY "task_comments_insert_auth" ON public.task_comments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "task_comments_update_auth" ON public.task_comments;
CREATE POLICY "task_comments_update_auth" ON public.task_comments FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "task_comments_delete_auth" ON public.task_comments;
CREATE POLICY "task_comments_delete_auth" ON public.task_comments FOR DELETE USING (auth.uid() IS NOT NULL);

-- ─── NOTIFICATIONS ──────────────────────────────────────────
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (auth.uid() = recipient_id OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (auth.uid() = recipient_id OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
CREATE POLICY "notifications_delete_own" ON public.notifications
  FOR DELETE USING (auth.uid() = recipient_id OR auth.uid() IS NOT NULL);

-- ─── CERTIFICATES ───────────────────────────────────────────
DROP POLICY IF EXISTS "certificates_select_own" ON public.certificates;
CREATE POLICY "certificates_select_own" ON public.certificates
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "certificates_insert_auth" ON public.certificates;
CREATE POLICY "certificates_insert_auth" ON public.certificates
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "certificates_update_auth" ON public.certificates;
CREATE POLICY "certificates_update_auth" ON public.certificates
  FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "certificates_delete_auth" ON public.certificates;
CREATE POLICY "certificates_delete_auth" ON public.certificates
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ─── FEEDBACKS ──────────────────────────────────────────────
DROP POLICY IF EXISTS "feedbacks_select_all" ON public.feedbacks;
CREATE POLICY "feedbacks_select_all" ON public.feedbacks FOR SELECT USING (true);

DROP POLICY IF EXISTS "feedbacks_insert_auth" ON public.feedbacks;
CREATE POLICY "feedbacks_insert_auth" ON public.feedbacks FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "feedbacks_update_auth" ON public.feedbacks;
CREATE POLICY "feedbacks_update_auth" ON public.feedbacks FOR UPDATE USING (auth.uid() = user_id);

-- ─── PROPOSAL_DISCUSSIONS ───────────────────────────────────
DROP POLICY IF EXISTS "proposal_discussions_select" ON public.proposal_discussions;
CREATE POLICY "proposal_discussions_select" ON public.proposal_discussions
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "proposal_discussions_insert" ON public.proposal_discussions;
CREATE POLICY "proposal_discussions_insert" ON public.proposal_discussions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ─── PROPOSAL_DOCUMENTS ─────────────────────────────────────
DROP POLICY IF EXISTS "proposal_documents_select" ON public.proposal_documents;
CREATE POLICY "proposal_documents_select" ON public.proposal_documents
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "proposal_documents_insert" ON public.proposal_documents;
CREATE POLICY "proposal_documents_insert" ON public.proposal_documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ─── PROPOSAL_TIMELINE ──────────────────────────────────────
DROP POLICY IF EXISTS "proposal_timeline_select" ON public.proposal_timeline;
CREATE POLICY "proposal_timeline_select" ON public.proposal_timeline
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "proposal_timeline_insert" ON public.proposal_timeline;
CREATE POLICY "proposal_timeline_insert" ON public.proposal_timeline
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ─── TEAM_ALLOCATIONS ───────────────────────────────────────
DROP POLICY IF EXISTS "team_allocations_select_all" ON public.team_allocations;
CREATE POLICY "team_allocations_select_all" ON public.team_allocations FOR SELECT USING (true);

DROP POLICY IF EXISTS "team_allocations_insert_auth" ON public.team_allocations;
CREATE POLICY "team_allocations_insert_auth" ON public.team_allocations
  FOR ALL USING (auth.role() = 'authenticated');


-- ══════════════════════════════════════════════════════════════
-- RPC FUNCTIONS
-- ══════════════════════════════════════════════════════════════

-- ─── accept_team_invitation ──────────────────────────────────
-- Atomically accepts a team invitation, expires all other pending
-- invitations for the same event for this user.
CREATE OR REPLACE FUNCTION public.accept_team_invitation(p_registration_id UUID, p_user_id UUID)
RETURNS void AS $$
DECLARE
    v_event_id UUID;
    v_status TEXT;
    v_deadline TIMESTAMPTZ;
BEGIN
    SELECT event_id, status INTO v_event_id, v_status
    FROM public.event_registrations
    WHERE id = p_registration_id AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Registration not found or unauthorized.';
    END IF;

    IF v_status != 'pending' THEN
        RAISE EXCEPTION 'Registration is not in a pending state.';
    END IF;

    SELECT registration_deadline INTO v_deadline
    FROM public.events
    WHERE id = v_event_id;

    IF v_deadline IS NOT NULL AND NOW() > v_deadline THEN
        RAISE EXCEPTION 'Registration deadline has passed.';
    END IF;

    UPDATE public.event_registrations
    SET status = 'registered'
    WHERE id = p_registration_id;

    DELETE FROM public.event_registrations
    WHERE user_id = p_user_id
      AND event_id = v_event_id
      AND status = 'pending'
      AND id != p_registration_id;
END;
$$ LANGUAGE plpgsql;


-- ─── confirm_team_registration ───────────────────────────────
-- Atomically confirms a team: validates min size, max teams,
-- locks the team row, and increments event registered_count.
CREATE OR REPLACE FUNCTION public.confirm_team_registration(p_team_id UUID, p_leader_id UUID)
RETURNS void AS $$
DECLARE
    v_event_id UUID;
    v_team_status TEXT;
    v_min_size INTEGER;
    v_max_teams INTEGER;
    v_accepted_members INTEGER;
    v_current_teams INTEGER;
BEGIN
    SELECT event_id, status INTO v_event_id, v_team_status
    FROM public.event_teams
    WHERE id = p_team_id AND leader_id = p_leader_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Team not found or you are not the leader.';
    END IF;

    IF v_team_status = 'registered' THEN
        RAISE EXCEPTION 'Team is already confirmed.';
    END IF;

    SELECT min_team_size, max_teams INTO v_min_size, v_max_teams
    FROM public.events
    WHERE id = v_event_id;

    SELECT COUNT(DISTINCT user_id) INTO v_accepted_members
    FROM (
        SELECT user_id FROM public.event_registrations WHERE team_id = p_team_id AND status = 'registered'
        UNION
        SELECT p_leader_id AS user_id
    ) t;

    IF v_accepted_members < v_min_size THEN
        RAISE EXCEPTION 'Minimum team size not reached yet.';
    END IF;

    IF v_max_teams IS NOT NULL THEN
        SELECT COUNT(*) INTO v_current_teams
        FROM public.event_teams
        WHERE event_id = v_event_id AND status = 'registered';

        IF v_current_teams >= v_max_teams THEN
            RAISE EXCEPTION 'Maximum number of teams for this event has been reached.';
        END IF;
    END IF;

    UPDATE public.event_teams
    SET status = 'registered'
    WHERE id = p_team_id;

    UPDATE public.events
    SET registered_count = registered_count + 1
    WHERE id = v_event_id;
END;
$$ LANGUAGE plpgsql;


-- ─── decrement_registered_count_by ───────────────────────────
-- Atomically decrements the registered_count on an event.
CREATE OR REPLACE FUNCTION public.decrement_registered_count_by(row_id UUID, amount INTEGER)
RETURNS void AS $$
BEGIN
    UPDATE public.events
    SET registered_count = GREATEST(0, registered_count - amount)
    WHERE id = row_id;
END;
$$ LANGUAGE plpgsql;


-- ─── update_updated_at trigger ───────────────────────────────
-- Auto-update updated_at on events and team_allocations
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_events_updated_at ON public.events;
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_team_allocations_updated_at ON public.team_allocations;
CREATE TRIGGER update_team_allocations_updated_at
  BEFORE UPDATE ON public.team_allocations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON public.tasks;
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ─── Seed admin profile ─────────────────────────────────────
-- Ensure admin profile exists with correct role
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'admin.avento@gmail.com';
