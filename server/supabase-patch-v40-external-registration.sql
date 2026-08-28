-- =====================================================
-- PATCH: External participant registration support
-- Run in production SQL Editor (joekmqnkpfjuptcgzpmh)
-- =====================================================

-- 1. Add new columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS college TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Team email invites table (for external participants)
CREATE TABLE IF NOT EXISTS team_email_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES event_teams(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  invite_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  UNIQUE(event_id, team_id, email)
);

-- 3. Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_team_email_invites_email ON team_email_invites(email);
CREATE INDEX IF NOT EXISTS idx_team_email_invites_token ON team_email_invites(invite_token);
CREATE INDEX IF NOT EXISTS idx_team_email_invites_status ON team_email_invites(status);

-- 4. Create Supabase Storage bucket for profile photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('profile-photos', 'profile-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- 5. Storage policies (public read, authenticated write)
DO $$ BEGIN
  CREATE POLICY "Public read access for profile photos"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'profile-photos');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can upload profile photos"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'profile-photos' AND auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update their own profile photos"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'profile-photos' AND auth.uid()::text = (string_to_array(name, '/'))[1]);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
