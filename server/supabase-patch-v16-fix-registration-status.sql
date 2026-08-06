-- Fix for event_registrations check constraint

-- 1. Drop the existing constraint
ALTER TABLE public.event_registrations DROP CONSTRAINT IF EXISTS event_registrations_status_check;

-- 2. Re-create the constraint with all necessary statuses for Team Registration workflow
ALTER TABLE public.event_registrations ADD CONSTRAINT event_registrations_status_check 
  CHECK (status IN ('registered', 'attended', 'cancelled', 'waitlisted', 'pending', 'rejected', 'expired'));
