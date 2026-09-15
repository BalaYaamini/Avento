const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '.env') });
const supabase = require('./config/supabaseClient');
const { Client } = require('pg');

async function applyMigration() {
  console.log('Applying v45 allowed_modules migration to event_members and event_organizers tables...');
  
  const sqls = [
    `ALTER TABLE public.event_members ADD COLUMN IF NOT EXISTS allowed_modules TEXT[] DEFAULT ARRAY['all'::text];`,
    `ALTER TABLE public.event_organizers ADD COLUMN IF NOT EXISTS allowed_modules TEXT[] DEFAULT ARRAY['all'::text];`
  ];

  // Try via RPC exec_sql first
  for (const sql of sqls) {
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
      console.log('exec_sql RPC result for', sql.substring(0, 45), ':', text);
    } catch (err) {
      console.log('exec_sql error:', err.message);
    }
  }

  // Check if DATABASE_URL or direct pg connection is available
  if (process.env.DATABASE_URL || process.env.SUPABASE_DB_URL) {
    try {
      const client = new Client({
        connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
        ssl: { rejectUnauthorized: false }
      });
      await client.connect();
      for (const sql of sqls) {
        await client.query(sql);
        console.log('PG direct query succeeded:', sql.substring(0, 45));
      }
      await client.end();
    } catch (pgErr) {
      console.log('PG direct connection error:', pgErr.message);
    }
  }

  // Verify columns
  const mRes = await supabase.from('event_members').select('id, allowed_modules').limit(1);
  const oRes = await supabase.from('event_organizers').select('id, allowed_modules').limit(1);

  console.log('Verification event_members.allowed_modules:', mRes.error ? mRes.error.message : 'SUCCESS');
  console.log('Verification event_organizers.allowed_modules:', oRes.error ? oRes.error.message : 'SUCCESS');

  process.exit(0);
}

applyMigration();
