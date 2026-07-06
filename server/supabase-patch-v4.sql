-- ============================================================
-- AVENTO Supabase Schema Setup Patch v4
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- Phase 5: Event Workspace & Task Management
-- ============================================================

-- Create tasks table
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

-- Create task_comments table
CREATE TABLE IF NOT EXISTS public.task_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- Setup RLS Policies for tasks
-- Read access: All authenticated users (further filtered in application code by workspace membership)
DROP POLICY IF EXISTS "tasks_select_all" ON public.tasks;
CREATE POLICY "tasks_select_all" ON public.tasks FOR SELECT USING (auth.uid() IS NOT NULL);

-- Insert/Update/Delete access: Handled via backend application using service_role key, 
-- but allow basic authenticated access if querying from client directly
DROP POLICY IF EXISTS "tasks_insert_auth" ON public.tasks;
CREATE POLICY "tasks_insert_auth" ON public.tasks FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "tasks_update_auth" ON public.tasks;
CREATE POLICY "tasks_update_auth" ON public.tasks FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "tasks_delete_auth" ON public.tasks;
CREATE POLICY "tasks_delete_auth" ON public.tasks FOR DELETE USING (auth.uid() IS NOT NULL);


-- Setup RLS Policies for task_comments
DROP POLICY IF EXISTS "task_comments_select_all" ON public.task_comments;
CREATE POLICY "task_comments_select_all" ON public.task_comments FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "task_comments_insert_auth" ON public.task_comments;
CREATE POLICY "task_comments_insert_auth" ON public.task_comments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "task_comments_update_auth" ON public.task_comments;
CREATE POLICY "task_comments_update_auth" ON public.task_comments FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "task_comments_delete_auth" ON public.task_comments;
CREATE POLICY "task_comments_delete_auth" ON public.task_comments FOR DELETE USING (auth.uid() IS NOT NULL);
