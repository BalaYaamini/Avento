const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const ws = require('ws');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Error: SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in server/.env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws }
});

const accounts = [
  { email: 'admin.avento@gmail.com', password: 'admin123' },
  { email: 'student.demo@cse.suh.edu.in', password: 'student123' },
  { email: 'faculty.demo@suh.edu.in', password: 'faculty123' }
];

async function testLogin() {
  console.log('🧪 Testing Login for Demo Accounts...\n');

  for (const account of accounts) {
    try {
      console.log(`Logging in ${account.email}...`);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: account.email,
        password: account.password
      });

      if (error) {
        console.error(`  ❌ Failed: ${error.message}`);
      } else {
        console.log(`  ✅ Success! User ID: ${data.user.id}`);
      }
    } catch (err) {
      console.error(`  ❌ Failed:`, err);
    }
    console.log('---');
  }
}

testLogin();
