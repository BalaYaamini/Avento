const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '.env') });
const supabase = require('./config/supabaseClient');
const { Client } = require('pg');

async function applyMigration() {
  console.log('Applying v50 panel allocation migration...');

  const sqlFile = path.join(__dirname, 'supabase-patch-v50-panel-allocation.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');

  // Try via RPC exec_sql first
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
    console.log('exec_sql error:', err.message);
  }

  // Also try pg direct connection if available
  if (process.env.DATABASE_URL || process.env.SUPABASE_DB_URL) {
    try {
      const client = new Client({
        connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
        ssl: { rejectUnauthorized: false }
      });
      await client.connect();
      await client.query(sql);
      console.log('PG direct query succeeded!');
      await client.end();
    } catch (pgErr) {
      console.log('PG direct connection error/skip:', pgErr.message);
    }
  }

  // Verify new tables and columns (allow the PostgREST schema cache to reload first)
  await new Promise(r => setTimeout(r, 2500));
  const pRes = await supabase.from('event_panels').select('id, event_id, name, venue_room, max_capacity, status').limit(1);
  console.log('Verification event_panels table:', pRes.error ? pRes.error.message : 'SUCCESS');

  const mRes = await supabase.from('panel_members').select('id, panel_id, user_id').limit(1);
  console.log('Verification panel_members table:', mRes.error ? mRes.error.message : 'SUCCESS');

  const aRes = await supabase.from('panel_assignments').select('id, panel_id, event_id, registration_id').limit(1);
  console.log('Verification panel_assignments table:', aRes.error ? aRes.error.message : 'SUCCESS');

  console.log('Migration v50 completed!');
  process.exit(0);
}

applyMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
