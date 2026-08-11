-- ============================================================
-- Drop ALL foreign key constraints that reference auth.users(id)
-- because user IDs come from MongoDB, not Supabase Auth.
-- Only profiles.id should reference auth.users(id).
-- Run this in: Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- Profiles: KEEP the FK (profiles.id references auth.users.id) — this is the only one that should stay

-- Events table
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_proposed_by_fkey;
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_faculty_id_fkey;
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_organizer_id_fkey;
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_student_organizer_id_fkey;
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_published_by_fkey;
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_certificate_template_uploaded_by_fkey;

-- Event Members table
ALTER TABLE public.event_members DROP CONSTRAINT IF EXISTS event_members_user_id_fkey;

-- Event Registrations table
ALTER TABLE public.event_registrations DROP CONSTRAINT IF EXISTS event_registrations_user_id_fkey;

-- Event Teams table
ALTER TABLE public.event_teams DROP CONSTRAINT IF EXISTS event_teams_leader_id_fkey;

-- Event Organizers table
ALTER TABLE public.event_organizers DROP CONSTRAINT IF EXISTS event_organizers_student_id_fkey;

-- Organizer Requests table
ALTER TABLE public.organizer_requests DROP CONSTRAINT IF EXISTS organizer_requests_student_id_fkey;

-- Tasks table
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_assigned_to_fkey;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_created_by_fkey;

-- Task Comments table
ALTER TABLE public.task_comments DROP CONSTRAINT IF EXISTS task_comments_user_id_fkey;

-- Notifications table
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_recipient_id_fkey;

-- Proposal Discussions table
ALTER TABLE public.proposal_discussions DROP CONSTRAINT IF EXISTS proposal_discussions_user_id_fkey;

-- Proposal Documents table
ALTER TABLE public.proposal_documents DROP CONSTRAINT IF EXISTS proposal_documents_user_id_fkey;

-- Proposal Timeline table
ALTER TABLE public.proposal_timeline DROP CONSTRAINT IF EXISTS proposal_timeline_user_id_fkey;

-- Feedbacks table
ALTER TABLE public.feedbacks DROP CONSTRAINT IF EXISTS feedbacks_user_id_fkey;

-- Certificates table
ALTER TABLE public.certificates DROP CONSTRAINT IF EXISTS certificates_user_id_fkey;

-- Event Scores table
ALTER TABLE public.event_scores DROP CONSTRAINT IF EXISTS event_scores_scored_by_fkey;
