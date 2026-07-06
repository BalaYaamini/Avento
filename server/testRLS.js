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

async function testRLS() {
  console.log('🧪 Testing SELECT from profiles table as authenticated admin user...\n');

  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'admin.avento@gmail.com',
        password: 'admin123'
    });
    
    if (authError) throw authError;

    console.log("Logged in successfully. User ID:", authData.user.id);

    const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();

    if (profileError) {
        console.error("❌ Select failed:", profileError);
    } else {
        console.log("✅ Select result:", profileData);
    }
  } catch (err) {
    console.error("Failed:", err);
  }
}

testRLS();
