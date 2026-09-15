-- Add allowed_modules column to event_members and event_organizers
ALTER TABLE public.event_members ADD COLUMN IF NOT EXISTS allowed_modules TEXT[] DEFAULT ARRAY['all'::text];
ALTER TABLE public.event_organizers ADD COLUMN IF NOT EXISTS allowed_modules TEXT[] DEFAULT ARRAY['all'::text];
