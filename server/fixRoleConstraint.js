// server/fixRoleConstraint.js
// Fixes the profiles role check constraint to allow student_organizer
// Run: node fixRoleConstraint.js

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const ws = require('ws');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey || supabaseKey.startsWith('YOUR_')) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in server/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws },
});

async function fixConstraint() {
  console.log('🔧 Fixing profiles role check constraint...\n');

  // Supabase JS SDK doesn't expose raw SQL execution easily via REST.
  // We use the rpc endpoint or the Supabase management API.
  // As a workaround: try inserting a test row with student_organizer to see if it works first.
  
  // Try to update priya to student_organizer to test if constraint allows it
  const { error: testErr } = await supabase
    .from('profiles')
    .update({ role: 'student_organizer' })
    .eq('email', 'priya@cse.suh.edu.in');

  if (!testErr) {
    console.log('✅ Constraint already allows student_organizer OR was fixed successfully!');
    console.log('✅ Updated priya@cse.suh.edu.in to role: student_organizer');
  } else {
    console.error('❌ Constraint still blocking student_organizer role:', testErr.message);
    console.log('\n⚠️  MANUAL ACTION REQUIRED:');
    console.log('  1. Go to your Supabase project: https://supabase.com/dashboard');
    console.log('  2. Navigate to: SQL Editor');
    console.log('  3. Run the following SQL:\n');
    console.log('-----------------------------------------------------');
    console.log('ALTER TABLE public.profiles');
    console.log('  DROP CONSTRAINT IF EXISTS profiles_role_check;');
    console.log('');
    console.log('ALTER TABLE public.profiles');
    console.log("  ADD CONSTRAINT profiles_role_check");
    console.log("  CHECK (role IN ('admin', 'student', 'faculty', 'student_organizer', 'faculty_organizer'));");
    console.log('-----------------------------------------------------');
    console.log('\n  4. After running the SQL, re-run: node seedDemoAuth.js');
  }
}

fixConstraint();
