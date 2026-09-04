-- Add new profile fields for phone, gender, degree/program, year, and college name
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS degree_program TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS year_of_study TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS college_name TEXT;

-- Enforce Indian 10-digit mobile number format (digits only, starts with 6-9)
-- Allow NULL for optional field
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS chk_phone_india;
ALTER TABLE public.profiles ADD CONSTRAINT chk_phone_india
  CHECK (phone IS NULL OR phone ~ '^[6-9][0-9]{9}$');
