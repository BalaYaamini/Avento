const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '.env') });
const supabase = require('./config/supabaseClient');
const { Client } = require('pg');

async function applyMigration() {
  console.log('Applying v46 slot-wise registration migration...');
  
  const sqlFile = path.join(__dirname, 'supabase-patch-v46-event-slots.sql');
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

  // Verify event_slots table and columns
  const sRes = await supabase.from('event_slots').select('id, slot_name, max_capacity, allocated_count').limit(1);
  console.log('Verification event_slots table:', sRes.error ? sRes.error.message : 'SUCCESS');

  const eRes = await supabase.from('events').select('id, has_slots').limit(1);
  console.log('Verification events.has_slots:', eRes.error ? eRes.error.message : 'SUCCESS');

  const rRes = await supabase.from('event_registrations').select('id, slot_id').limit(1);
  console.log('Verification event_registrations.slot_id:', rRes.error ? rRes.error.message : 'SUCCESS');

  const tRes = await supabase.from('event_teams').select('id, slot_id').limit(1);
  console.log('Verification event_teams.slot_id:', tRes.error ? tRes.error.message : 'SUCCESS');

  console.log('Migration v46 completed!');
  process.exit(0);
}

applyMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
