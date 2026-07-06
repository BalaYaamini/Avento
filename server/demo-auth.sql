-- Demo Accounts Seeding Script
-- Run this directly in the Supabase SQL Editor if you don't have the Service Role Key

-- 1. Create Admin Account
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'admin.avento@gmail.com',
  crypt('admin123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now(),
  '',
  '',
  '',
  ''
) ON CONFLICT (email) DO NOTHING;

-- Insert into public.profiles
INSERT INTO public.profiles (id, email, name, role, created_at)
SELECT id, email, 'Avento Administrator', 'admin', now() 
FROM auth.users 
WHERE email = 'admin.avento@gmail.com'
ON CONFLICT (id) DO NOTHING;

-- 2. Create Demo Student Account
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'student.demo@cse.suh.edu.in',
  crypt('student123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now(),
  '',
  '',
  '',
  ''
) ON CONFLICT (email) DO NOTHING;

-- Insert into public.profiles
INSERT INTO public.profiles (id, email, name, role, created_at)
SELECT id, email, 'Demo Student', 'student', now() 
FROM auth.users 
WHERE email = 'student.demo@cse.suh.edu.in'
ON CONFLICT (id) DO NOTHING;

-- 3. Create Demo Faculty Account
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'faculty.demo@suh.edu.in',
  crypt('faculty123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now(),
  '',
  '',
  '',
  ''
) ON CONFLICT (email) DO NOTHING;

-- Insert into public.profiles
INSERT INTO public.profiles (id, email, name, role, created_at)
SELECT id, email, 'Demo Faculty', 'faculty', now() 
FROM auth.users 
WHERE email = 'faculty.demo@suh.edu.in'
ON CONFLICT (id) DO NOTHING;
