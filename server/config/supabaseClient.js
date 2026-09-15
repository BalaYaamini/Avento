const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

console.log('[supabaseClient] Initializing... process.env keys available:', Object.keys(process.env).filter(k => k.includes('SUPABASE')).join(', ') || 'NONE');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

console.log('[supabaseClient] supabaseUrl:', supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'UNDEFINED');
console.log('[supabaseClient] supabaseKey:', supabaseKey ? supabaseKey.substring(0, 12) + '...' : 'UNDEFINED');
console.log('[supabaseClient] using service role key?', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    '[Supabase] CRITICAL: SUPABASE_SERVICE_ROLE_KEY is not set. ' +
    'Falling back to anon key. RLS policies WILL be enforced on server-side queries, ' +
    'which WILL cause write operations (e.g., proposal resubmission, status updates) to fail for non-admin users. ' +
    'Ensure .env is in the server/ directory.'
  );
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  realtime: {
    transport: ws
  }
});

module.exports = supabase;
