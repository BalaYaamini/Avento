-- ============================================================
-- AVENTO Supabase Schema Setup Patch v7
-- Notifications Table
-- ============================================================

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

-- ─── RLS POLICIES ────────────────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Select own notifications
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (auth.uid() = recipient_id OR auth.uid() IS NOT NULL);

-- Update own notifications (e.g., mark as read)
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (auth.uid() = recipient_id OR auth.uid() IS NOT NULL);

-- Insert notifications (system or admin)
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Delete own notifications
DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
CREATE POLICY "notifications_delete_own" ON public.notifications
  FOR DELETE USING (auth.uid() = recipient_id OR auth.uid() IS NOT NULL);
