-- Fix RLS policies for team_email_invites table
-- The table exists but has no permissive policies, causing inserts to fail

-- Enable RLS (in case it's not)
ALTER TABLE team_email_invites ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (team leaders) to insert invites for their own teams
DO $$ BEGIN
  CREATE POLICY "Team leaders can insert invites"
    ON team_email_invites FOR INSERT
    TO authenticated
    WITH CHECK (
      invited_by = auth.uid()
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Allow authenticated users to view invites for their teams
DO $$ BEGIN
  CREATE POLICY "Team leaders can view their team invites"
    ON team_email_invites FOR SELECT
    TO authenticated
    USING (
      invited_by = auth.uid()
      OR email = (SELECT email FROM profiles WHERE id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Allow authenticated users to update invites they sent
DO $$ BEGIN
  CREATE POLICY "Team leaders can update their invites"
    ON team_email_invites FOR UPDATE
    TO authenticated
    USING (invited_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Allow authenticated users to delete invites they sent
DO $$ BEGIN
  CREATE POLICY "Team leaders can delete their invites"
    ON team_email_invites FOR DELETE
    TO authenticated
    USING (invited_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Also ensure service_role can do everything (bypass RLS)
DO $$ BEGIN
  CREATE POLICY "Service role full access"
    ON team_email_invites FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
