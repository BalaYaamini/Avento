-- ============================================================
-- AVENTO — COMPLETE SUPABASE SETUP (Fresh Project)
-- Run this in: Supabase Dashboard > SQL Editor > New Query
-- ============================================================
-- IMPORTANT: Before running this script:
--   1. Enable Authentication in your Supabase project
--      (Dashboard > Authentication > Enable)
--   2. Then paste and run this entire script in SQL Editor.
-- ============================================================


-- ============================================================
-- 1. TABLES
-- ============================================================

-- ─── PROFILES ────────────────────────────────────────────────
-- Links to Supabase Auth. All other user_id columns are plain UUIDs
-- because user IDs come from MongoDB, not Supabase Auth.
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT,
  role TEXT DEFAULT 'student' CHECK (role IN ('admin', 'student', 'faculty', 'student_organizer', 'faculty_organizer')),
  employee_id TEXT,
  roll_number TEXT,
  department TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  first_login BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── EVENTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft',
  proposed_by UUID,
  faculty_id UUID,
  organizer_id UUID,
  student_organizer_id UUID,
  category TEXT,
  venue TEXT,
  date TIMESTAMPTZ,
  capacity INTEGER,
  approval_remarks TEXT,
  image_url TEXT,
  registered_count INTEGER DEFAULT 0,
  attendance_count INTEGER DEFAULT 0,
  registration_deadline TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  published_by UUID,
  join_team_enabled BOOLEAN DEFAULT FALSE,
  registration_type TEXT DEFAULT 'individual',
  max_teams INTEGER,
  min_team_size INTEGER DEFAULT 1,
  max_team_size INTEGER DEFAULT 1,
  allow_cross_department BOOLEAN DEFAULT true,
  team_leader_registration_required BOOLEAN DEFAULT true,
  revision_number INTEGER DEFAULT 1,
  certificate_template TEXT,
  certificate_template_uploaded_by UUID,
  certificate_template_uploaded_at TIMESTAMPTZ,
  certificate_fields_config JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── EVENT MEMBERS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID,
  name TEXT NOT NULL,
  roll_number TEXT,
  email TEXT,
  role TEXT DEFAULT 'Volunteer',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── EVENT TEAMS ────────────────────────────────────────────
-- Created before event_registrations (which references it)
CREATE TABLE IF NOT EXISTS public.event_teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  leader_id UUID NOT NULL,
  status TEXT DEFAULT 'pending',
  leader_contact_number VARCHAR(15),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, name)
);

-- ─── EVENT REGISTRATIONS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_registrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT DEFAULT 'registered',
  team_id UUID REFERENCES public.event_teams(id) ON DELETE CASCADE,
  attendance_status TEXT DEFAULT 'Absent',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── EVENT ORGANIZERS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_organizers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  category TEXT NOT NULL,
  organizer_role TEXT DEFAULT 'normal' CHECK (organizer_role IN ('core', 'normal')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, student_id)
);

-- ─── ORGANIZER REQUESTS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organizer_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  category TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, student_id)
);

-- ─── TASKS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  assigned_to UUID,
  priority TEXT DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
  status TEXT DEFAULT 'To Do' CHECK (status IN ('To Do', 'In Progress', 'Completed', 'Blocked')),
  deadline TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TASK COMMENTS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.task_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── NOTIFICATIONS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PROPOSAL DISCUSSIONS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.proposal_discussions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PROPOSAL DOCUMENTS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.proposal_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PROPOSAL TIMELINE ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.proposal_timeline (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── FEEDBACKS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feedbacks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content_rating INTEGER CHECK (content_rating BETWEEN 1 AND 5),
  speaker_rating INTEGER CHECK (speaker_rating BETWEEN 1 AND 5),
  organization_rating INTEGER CHECK (organization_rating BETWEEN 1 AND 5),
  engagement_rating INTEGER CHECK (engagement_rating BETWEEN 1 AND 5),
  overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
  suggestions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- ─── CERTIFICATES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.certificates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  certificate_id TEXT NOT NULL UNIQUE,
  certificate_url TEXT NOT NULL,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- ─── SCORING CONFIGS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scoring_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  num_levels INTEGER DEFAULT 3,
  levels JSONB DEFAULT '[
    {"level": 1, "name": "Round 1", "max_score": 100, "weight": 1},
    {"level": 2, "name": "Round 2", "max_score": 100, "weight": 2},
    {"level": 3, "name": "Final", "max_score": 100, "weight": 3}
  ]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id)
);

-- ─── EVENT SCORES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  team_id UUID NOT NULL,
  level INTEGER NOT NULL,
  score INTEGER DEFAULT 0,
  scored_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, team_id, level)
);


-- ============================================================
-- 2. CONSTRAINTS & INDEXES
-- ============================================================

-- Events status check
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_status_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_status_check
  CHECK (status IN ('draft', 'submitted', 'under_review', 'needs_revision', 'approved', 'rejected', 'published', 'completed', 'cancelled', 'active', 'withdrawn', 'pending_approval'));

-- Registration status check
ALTER TABLE public.event_registrations
  DROP CONSTRAINT IF EXISTS event_registrations_status_check;
ALTER TABLE public.event_registrations
  ADD CONSTRAINT event_registrations_status_check
  CHECK (status IN ('registered', 'attended', 'cancelled', 'waitlisted', 'pending', 'rejected', 'expired', 'left', 'auto_rejected'));

-- Drop old strict unique constraint (if it exists)
ALTER TABLE public.event_registrations
  DROP CONSTRAINT IF EXISTS event_registrations_event_id_user_id_key;

-- Partial unique index: only one 'registered' row per user per event
CREATE UNIQUE INDEX IF NOT EXISTS event_registrations_single_active_idx
  ON public.event_registrations (event_id, user_id)
  WHERE status = 'registered';

-- Partial unique index: one registration per user per team
CREATE UNIQUE INDEX IF NOT EXISTS event_registrations_unique_team_user_idx
  ON public.event_registrations (team_id, user_id)
  WHERE team_id IS NOT NULL;

-- Strict single active team per user per event
CREATE UNIQUE INDEX IF NOT EXISTS one_active_team_per_event
  ON public.event_registrations (user_id, event_id)
  WHERE status = 'registered';


-- ============================================================
-- 3. FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create profile on Supabase Auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'fullName', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Accept Team Invitation
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
    FROM public.events WHERE id = v_event_id;

    IF v_deadline IS NOT NULL AND NOW() > v_deadline THEN
        RAISE EXCEPTION 'Registration deadline has passed.';
    END IF;

    UPDATE public.event_registrations SET status = 'registered' WHERE id = p_registration_id;

    DELETE FROM public.event_registrations
    WHERE user_id = p_user_id
      AND event_id = v_event_id
      AND status = 'pending'
      AND id != p_registration_id;
END;
$$ LANGUAGE plpgsql;

-- Decrement Registered Count
CREATE OR REPLACE FUNCTION public.decrement_registered_count_by(row_id UUID, amount INTEGER)
RETURNS void AS $$
BEGIN
    UPDATE public.events
    SET registered_count = GREATEST(0, registered_count - amount)
    WHERE id = row_id;
END;
$$ LANGUAGE plpgsql;

-- Leave Team
CREATE OR REPLACE FUNCTION public.leave_team(p_team_id UUID, p_user_id UUID)
RETURNS void AS $$
DECLARE
    v_event_id UUID;
    v_leader_id UUID;
    v_registration_id UUID;
    v_deadline TIMESTAMPTZ;
BEGIN
    SELECT event_id, leader_id INTO v_event_id, v_leader_id
    FROM public.event_teams WHERE id = p_team_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Team not found.';
    END IF;

    IF v_leader_id = p_user_id THEN
        RAISE EXCEPTION 'Team Leader cannot leave the team. Use the Cancel Team Registration option instead.';
    END IF;

    SELECT registration_deadline INTO v_deadline
    FROM public.events WHERE id = v_event_id;

    IF v_deadline IS NOT NULL AND NOW() > v_deadline THEN
        RAISE EXCEPTION 'Registration deadline has passed.';
    END IF;

    SELECT id INTO v_registration_id
    FROM public.event_registrations
    WHERE team_id = p_team_id AND user_id = p_user_id AND status = 'registered'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'You do not have an active accepted registration for this team.';
    END IF;

    UPDATE public.event_registrations SET status = 'pending' WHERE id = v_registration_id;

    UPDATE public.events
    SET registered_count = registered_count - 1
    WHERE id = v_event_id;
END;
$$ LANGUAGE plpgsql;

-- Confirm Team Registration
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
    FROM public.events WHERE id = v_event_id;

    SELECT COUNT(*) INTO v_accepted_members
    FROM public.event_registrations
    WHERE team_id = p_team_id AND status = 'registered';

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

    UPDATE public.event_teams SET status = 'registered' WHERE id = p_team_id;

    UPDATE public.events
    SET registered_count = registered_count + 1
    WHERE id = v_event_id;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_organizers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoring_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_scores ENABLE ROW LEVEL SECURITY;

-- Profiles
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Events
DROP POLICY IF EXISTS "events_select_all" ON public.events;
CREATE POLICY "events_select_all" ON public.events FOR SELECT USING (true);
DROP POLICY IF EXISTS "events_insert_auth" ON public.events;
CREATE POLICY "events_insert_auth" ON public.events FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "events_update_auth" ON public.events;
CREATE POLICY "events_update_auth" ON public.events FOR UPDATE USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "events_delete_auth" ON public.events;
CREATE POLICY "events_delete_auth" ON public.events FOR DELETE USING (auth.uid() IS NOT NULL);

-- Event Members
DROP POLICY IF EXISTS "event_members_all" ON public.event_members;
CREATE POLICY "event_members_all" ON public.event_members FOR ALL USING (auth.uid() IS NOT NULL);

-- Event Registrations
DROP POLICY IF EXISTS "event_registrations_select_own" ON public.event_registrations;
CREATE POLICY "event_registrations_select_own" ON public.event_registrations FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "event_registrations_insert_auth" ON public.event_registrations;
CREATE POLICY "event_registrations_insert_auth" ON public.event_registrations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "event_registrations_delete_own" ON public.event_registrations;
CREATE POLICY "event_registrations_delete_own" ON public.event_registrations FOR DELETE USING (auth.uid() IS NOT NULL);

-- Event Teams
DROP POLICY IF EXISTS "event_teams_select_all" ON public.event_teams;
CREATE POLICY "event_teams_select_all" ON public.event_teams FOR SELECT USING (true);
DROP POLICY IF EXISTS "event_teams_insert_auth" ON public.event_teams;
CREATE POLICY "event_teams_insert_auth" ON public.event_teams FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "event_teams_update_auth" ON public.event_teams;
CREATE POLICY "event_teams_update_auth" ON public.event_teams FOR UPDATE USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "event_teams_delete_auth" ON public.event_teams;
CREATE POLICY "event_teams_delete_auth" ON public.event_teams FOR DELETE USING (auth.uid() IS NOT NULL);

-- Event Organizers
DROP POLICY IF EXISTS "event_organizers_all" ON public.event_organizers;
CREATE POLICY "event_organizers_all" ON public.event_organizers FOR ALL USING (auth.uid() IS NOT NULL);

-- Organizer Requests
DROP POLICY IF EXISTS "organizer_requests_all" ON public.organizer_requests;
CREATE POLICY "organizer_requests_all" ON public.organizer_requests FOR ALL USING (auth.uid() IS NOT NULL);

-- Tasks
DROP POLICY IF EXISTS "tasks_select_all" ON public.tasks;
CREATE POLICY "tasks_select_all" ON public.tasks FOR SELECT USING (true);
DROP POLICY IF EXISTS "tasks_insert_auth" ON public.tasks;
CREATE POLICY "tasks_insert_auth" ON public.tasks FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "tasks_update_auth" ON public.tasks;
CREATE POLICY "tasks_update_auth" ON public.tasks FOR UPDATE USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "tasks_delete_auth" ON public.tasks;
CREATE POLICY "tasks_delete_auth" ON public.tasks FOR DELETE USING (auth.uid() IS NOT NULL);

-- Task Comments
DROP POLICY IF EXISTS "task_comments_select_all" ON public.task_comments;
CREATE POLICY "task_comments_select_all" ON public.task_comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "task_comments_insert_auth" ON public.task_comments;
CREATE POLICY "task_comments_insert_auth" ON public.task_comments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "task_comments_update_auth" ON public.task_comments;
CREATE POLICY "task_comments_update_auth" ON public.task_comments FOR UPDATE USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "task_comments_delete_auth" ON public.task_comments;
CREATE POLICY "task_comments_delete_auth" ON public.task_comments FOR DELETE USING (auth.uid() IS NOT NULL);

-- Notifications
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
CREATE POLICY "notifications_delete_own" ON public.notifications FOR DELETE USING (auth.uid() IS NOT NULL);

-- Proposal Discussions
DROP POLICY IF EXISTS "proposal_discussions_select" ON public.proposal_discussions;
CREATE POLICY "proposal_discussions_select" ON public.proposal_discussions FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "proposal_discussions_insert" ON public.proposal_discussions;
CREATE POLICY "proposal_discussions_insert" ON public.proposal_discussions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Proposal Documents
DROP POLICY IF EXISTS "proposal_documents_select" ON public.proposal_documents;
CREATE POLICY "proposal_documents_select" ON public.proposal_documents FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "proposal_documents_insert" ON public.proposal_documents;
CREATE POLICY "proposal_documents_insert" ON public.proposal_documents FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Proposal Timeline
DROP POLICY IF EXISTS "proposal_timeline_select" ON public.proposal_timeline;
CREATE POLICY "proposal_timeline_select" ON public.proposal_timeline FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "proposal_timeline_insert" ON public.proposal_timeline;
CREATE POLICY "proposal_timeline_insert" ON public.proposal_timeline FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Feedbacks
DROP POLICY IF EXISTS "feedbacks_select_all" ON public.feedbacks;
CREATE POLICY "feedbacks_select_all" ON public.feedbacks FOR SELECT USING (true);
DROP POLICY IF EXISTS "feedbacks_insert_auth" ON public.feedbacks;
CREATE POLICY "feedbacks_insert_auth" ON public.feedbacks FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "feedbacks_update_auth" ON public.feedbacks;
CREATE POLICY "feedbacks_update_auth" ON public.feedbacks FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Certificates
DROP POLICY IF EXISTS "certificates_select_own" ON public.certificates;
CREATE POLICY "certificates_select_own" ON public.certificates FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "certificates_insert_auth" ON public.certificates;
CREATE POLICY "certificates_insert_auth" ON public.certificates FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "certificates_update_auth" ON public.certificates;
CREATE POLICY "certificates_update_auth" ON public.certificates FOR UPDATE USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "certificates_delete_auth" ON public.certificates;
CREATE POLICY "certificates_delete_auth" ON public.certificates FOR DELETE USING (auth.uid() IS NOT NULL);

-- Scoring Configs
DROP POLICY IF EXISTS "scoring_configs_select_all" ON public.scoring_configs;
CREATE POLICY "scoring_configs_select_all" ON public.scoring_configs FOR SELECT USING (true);
DROP POLICY IF EXISTS "scoring_configs_insert_auth" ON public.scoring_configs;
CREATE POLICY "scoring_configs_insert_auth" ON public.scoring_configs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "scoring_configs_update_auth" ON public.scoring_configs;
CREATE POLICY "scoring_configs_update_auth" ON public.scoring_configs FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Event Scores
DROP POLICY IF EXISTS "event_scores_select_all" ON public.event_scores;
CREATE POLICY "event_scores_select_all" ON public.event_scores FOR SELECT USING (true);
DROP POLICY IF EXISTS "event_scores_insert_auth" ON public.event_scores;
CREATE POLICY "event_scores_insert_auth" ON public.event_scores FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "event_scores_update_auth" ON public.event_scores;
CREATE POLICY "event_scores_update_auth" ON public.event_scores FOR UPDATE USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "event_scores_delete_auth" ON public.event_scores;
CREATE POLICY "event_scores_delete_auth" ON public.event_scores FOR DELETE USING (auth.uid() IS NOT NULL);


-- ============================================================
-- 5. REALTIME
-- ============================================================

BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;

ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;


-- ============================================================
-- 6. STORAGE BUCKETS
-- ============================================================

-- Posters bucket (public read, authenticated write)
INSERT INTO storage.buckets (id, name, public)
VALUES ('posters', 'posters', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public Access to Posters" ON storage.objects;
CREATE POLICY "Public Access to Posters"
ON storage.objects FOR SELECT
USING (bucket_id = 'posters');

DROP POLICY IF EXISTS "Authenticated users can upload posters" ON storage.objects;
CREATE POLICY "Authenticated users can upload posters"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'posters');

DROP POLICY IF EXISTS "Authenticated users can update posters" ON storage.objects;
CREATE POLICY "Authenticated users can update posters"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'posters');

DROP POLICY IF EXISTS "Authenticated users can delete posters" ON storage.objects;
CREATE POLICY "Authenticated users can delete posters"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'posters');

-- Documents bucket (public read, authenticated write)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public Access to Documents" ON storage.objects;
CREATE POLICY "Public Access to Documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'documents');

DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
CREATE POLICY "Authenticated users can upload documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents');

DROP POLICY IF EXISTS "Authenticated users can update documents" ON storage.objects;
CREATE POLICY "Authenticated users can update documents"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documents');

DROP POLICY IF EXISTS "Authenticated users can delete documents" ON storage.objects;
CREATE POLICY "Authenticated users can delete documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documents');


-- ============================================================
-- DONE! Your AVENTO database is ready.
-- ============================================================
