const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const ws = require('ws');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in server/.env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws }
});

const checkAccounts = [
  'admin.avento@gmail.com',
  'student.demo@cse.suh.edu.in',
  'faculty.demo@suh.edu.in'
];

async function verify() {
  console.log('🔍 Starting Auth Verification...\n');

  try {
    const { data: usersData, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) throw authError;

    const { data: profiles, error: profileError } = await supabase.from('profiles').select('*');
    if (profileError) throw profileError;

    for (const email of checkAccounts) {
      console.log(`Checking ${email}...`);
      const user = usersData.users.find(u => u.email === email);
      if (user) {
        console.log(`  ✅ Found in auth.users (ID: ${user.id})`);
        
        // Also ensure password hash exists
        if (user.encrypted_password) {
             console.log(`  ✅ Password is set`);
        } else {
             console.log(`  ❌ Password is MISSING! User may have only requested OTP.`);
        }

        const profile = profiles.find(p => p.id === user.id);
        if (profile) {
          console.log(`  ✅ Found in profiles table`);
          console.log(`  ℹ️  Role: ${profile.role}, Roles Array: ${JSON.stringify(profile.roles || [])}`);
        } else {
          console.log(`  ❌ MISSING from profiles table`);
        }
      } else {
        console.log(`  ❌ MISSING from auth.users`);
      }
      console.log('---');
    }

  } catch (err) {
    console.error("Verification failed:", err);
  }
}

verify();
