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

async function checkRLS() {
  console.log('🔍 Checking RLS Policies on profiles table...\n');

  try {
    const { data, error } = await supabase.rpc('query_rls_policies', { table_name: 'profiles' });
    
    // Fallback if the RPC doesn't exist, we can use a direct SQL query
    if (error) {
      console.log("RPC failed, attempting direct query using pg_policies...");
      const { data: directData, error: directError } = await supabase.from('pg_policies').select('*').eq('tablename', 'profiles');
      // Supabase PostgREST might not expose pg_policies by default, let's see.
      if (directError) {
          console.error("❌ Cannot query pg_policies via API directly:", directError);
      } else {
          console.log(directData);
      }
    } else {
      console.log(data);
    }
  } catch (err) {
    console.error("Verification failed:", err);
  }
}

checkRLS();
