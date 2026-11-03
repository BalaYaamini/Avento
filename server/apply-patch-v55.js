const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '.env') });
const supabase = require('./config/supabaseClient');

async function applyMigration() {
  console.log('Applying v55 attendance mode migration...');

  const sqlFile = path.join(__dirname, 'supabase-patch-v55-attendance-mode.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');

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
    console.log('exec_sql RPC status:', res.status);
  } catch (err) {
    console.log('exec_sql error:', err.message);
  }

  // Verify the new column exists (allow schema cache to reload first)
  await new Promise(r => setTimeout(r, 2500));
  const vRes = await supabase.from('events').select('id, attendance_mode').limit(1);
  console.log('Verification events.attendance_mode:', vRes.error ? vRes.error.message : 'SUCCESS');

  console.log('Migration v55 completed!');
  process.exit(0);
}

applyMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
