-- ==============================================================================
-- MIGRATION: Realtime slot sync (v48)
-- Broadcasts slot bookings, slot changes and team changes over Supabase Realtime
-- so every open screen (student registration cards, register/change-slot modal,
-- organizer slot manager) updates live across accounts.
--
-- Run this once in the Supabase SQL Editor.
-- ==============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'event_slots'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_slots;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'event_registrations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_registrations;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'event_teams'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_teams;
  END IF;
END $$;
