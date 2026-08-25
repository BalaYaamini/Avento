const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '.env') });
const supabase = require('./config/supabaseClient');

async function applyMigration() {
  console.log('Applying v38 avatar_url migration to profiles table...');
  const sql = `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;`;

  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ query: sql })
    });
    const text = await res.text();
    console.log('exec_sql RPC result:', text);
  } catch (err) {
    console.log('exec_sql error (will verify column):', err.message);
  }

  // Verify column status
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, avatar_url')
    .limit(1);

  if (error) {
    console.log('VERIFY: avatar_url column check:', error.message);
  } else {
    console.log('VERIFY SUCCESS: avatar_url column is available in profiles table!');
  }
  process.exit(0);
}

applyMigration();
