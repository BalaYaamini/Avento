const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '.env') });
const supabase = require('./config/supabaseClient');

async function applyMigration() {
  console.log('Applying v53 student score comments migration...');

  const sqlFile = path.join(__dirname, 'supabase-patch-v53-student-score-comments.sql');
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

  // Verify the new table exists (allow schema cache to reload first)
  await new Promise(r => setTimeout(r, 2500));
  const vRes = await supabase.from('student_score_comments').select('id, event_id, registration_id, comment').limit(1);
  console.log('Verification student_score_comments:', vRes.error ? vRes.error.message : 'SUCCESS');

  console.log('Migration v53 completed!');
  process.exit(0);
}

applyMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
