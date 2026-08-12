-- ============================================================
-- AVENTO Fix: Foreign Keys for Supabase PostgREST Joins
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Create exec_sql helper function (for future programmatic access)
CREATE OR REPLACE FUNCTION public.exec_sql(query TEXT)
RETURNS VOID AS $$
BEGIN
  EXECUTE query;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fix event_registrations.user_id -> profiles (was auth.users)
ALTER TABLE public.event_registrations
  DROP CONSTRAINT IF EXISTS event_registrations_user_id_fkey,
  ADD CONSTRAINT event_registrations_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 3. Fix task_comments.user_id -> profiles
ALTER TABLE public.task_comments
  DROP CONSTRAINT IF EXISTS task_comments_user_id_fkey,
  ADD CONSTRAINT task_comments_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 4. Fix tasks.assigned_to -> profiles
ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_assigned_to_fkey,
  ADD CONSTRAINT tasks_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 5. Fix tasks.created_by -> profiles
ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_created_by_fkey,
  ADD CONSTRAINT tasks_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 6. Fix event_members.user_id -> profiles
ALTER TABLE public.event_members
  DROP CONSTRAINT IF EXISTS event_members_user_id_fkey,
  ADD CONSTRAINT event_members_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 7. Fix certificates.user_id -> profiles
ALTER TABLE public.certificates
  DROP CONSTRAINT IF EXISTS certificates_user_id_fkey,
  ADD CONSTRAINT certificates_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 8. Fix feedbacks.user_id -> profiles
ALTER TABLE public.feedbacks
  DROP CONSTRAINT IF EXISTS feedbacks_user_id_fkey,
  ADD CONSTRAINT feedbacks_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 9. Fix notifications.recipient_id -> profiles
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_recipient_id_fkey,
  ADD CONSTRAINT notifications_recipient_id_fkey
    FOREIGN KEY (recipient_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 10. Fix event_teams.leader_id -> profiles
ALTER TABLE public.event_teams
  DROP CONSTRAINT IF EXISTS event_teams_leader_id_fkey,
  ADD CONSTRAINT event_teams_leader_id_fkey
    FOREIGN KEY (leader_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 11. Fix event_organizers.student_id -> profiles
ALTER TABLE public.event_organizers
  DROP CONSTRAINT IF EXISTS event_organizers_student_id_fkey,
  ADD CONSTRAINT event_organizers_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 12. Fix organizer_requests.student_id -> profiles
ALTER TABLE public.organizer_requests
  DROP CONSTRAINT IF EXISTS organizer_requests_student_id_fkey,
  ADD CONSTRAINT organizer_requests_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 13. Fix proposal_discussions.user_id -> profiles
ALTER TABLE public.proposal_discussions
  DROP CONSTRAINT IF EXISTS proposal_discussions_user_id_fkey,
  ADD CONSTRAINT proposal_discussions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 14. Fix proposal_documents.user_id -> profiles
ALTER TABLE public.proposal_documents
  DROP CONSTRAINT IF EXISTS proposal_documents_user_id_fkey,
  ADD CONSTRAINT proposal_documents_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 15. Fix proposal_timeline.user_id -> profiles
ALTER TABLE public.proposal_timeline
  DROP CONSTRAINT IF EXISTS proposal_timeline_user_id_fkey,
  ADD CONSTRAINT proposal_timeline_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
