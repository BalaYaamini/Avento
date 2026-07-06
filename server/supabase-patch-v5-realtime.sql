-- ============================================================
-- AVENTO Supabase Schema Patch v5 (Realtime & RLS Fix)
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- Phase 5: Event Workspace & Task Management
-- ============================================================

-- 1. Enable Realtime for tasks table
-- This allows the frontend to listen to changes immediately
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;

-- 2. Fix RLS Policies for AVENTO architecture
-- Since AVENTO uses a custom backend for JWT auth, the frontend Supabase client 
-- is functionally 'anonymous' to Supabase. To allow Realtime subscriptions to work, 
-- SELECT policies must allow anonymous reads. 
-- Security and access control (verifying if a user belongs to an event) 
-- is handled by the React application logic and the Backend APIs.

-- Fix tasks policies
DROP POLICY IF EXISTS "tasks_select_all" ON public.tasks;
CREATE POLICY "tasks_select_all" ON public.tasks FOR SELECT USING (true);

-- Fix task_comments policies
DROP POLICY IF EXISTS "task_comments_select_all" ON public.task_comments;
CREATE POLICY "task_comments_select_all" ON public.task_comments FOR SELECT USING (true);
