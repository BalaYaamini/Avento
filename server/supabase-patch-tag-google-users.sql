-- Tag specific known Google user
UPDATE profiles SET registration_method = 'google' WHERE email = 'charan.sattarapu@gmail.com';

-- Auto-detect Google OAuth users from Supabase Auth metadata
-- and update their profiles accordingly
UPDATE profiles
SET registration_method = 'google'
WHERE id IN (
  SELECT au.id
  FROM auth.users au
  WHERE au.raw_app_meta_data->>'provider' = 'google'
)
AND registration_method != 'google';

-- Verify results
SELECT email, name, registration_method
FROM profiles
WHERE registration_method = 'google'
ORDER BY created_at DESC;
