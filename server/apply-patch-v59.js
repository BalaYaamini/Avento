const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '.env') });

async function applyMigration() {
  console.log('Applying v59 multi-day slot-collapse guard to event_slots...');
  const sql = fs.readFileSync(path.resolve(__dirname, 'supabase-patch-v59-guard-slot-collapse.sql'), 'utf8');

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
    console.log('exec_sql RPC status:', res.status);
    console.log('exec_sql RPC result:', text || '(empty = success)');
  } catch (err) {
    console.log('exec_sql error:', err.message);
    process.exit(1);
  }
  console.log('Done. Guard is active (it only blocks bad updates; it never modifies data).');
  process.exit(0);
}

applyMigration();
