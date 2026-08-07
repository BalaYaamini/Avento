-- Fix for event_registrations check constraint to include 'left' and 'auto_rejected'

ALTER TABLE public.event_registrations DROP CONSTRAINT IF EXISTS event_registrations_status_check;

ALTER TABLE public.event_registrations ADD CONSTRAINT event_registrations_status_check 
  CHECK (status IN ('registered', 'attended', 'cancelled', 'waitlisted', 'pending', 'rejected', 'expired', 'left', 'auto_rejected'));
