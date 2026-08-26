-- Add registration_method column to profiles table
-- Run this in your Supabase SQL Editor (both dev and production)

-- Add the column with a default of 'imported' for existing users
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS registration_method TEXT DEFAULT 'imported';

-- Add a check constraint for valid values
ALTER TABLE profiles ADD CONSTRAINT profiles_registration_method_check
  CHECK (registration_method IN ('otp', 'google', 'imported', 'admin'));

-- Create an index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_profiles_registration_method ON profiles(registration_method);

-- Update existing admin account
UPDATE profiles SET registration_method = 'admin' WHERE email = 'admin.avento@gmail.com';
