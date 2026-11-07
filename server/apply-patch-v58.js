const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '.env') });
const supabase = require('./config/supabaseClient');

async function applyMigration() {
  console.log('Applying v58 score report email tracking migration to event_registrations...');
  const sql = `
    ALTER TABLE public.event_registrations ADD COLUMN IF NOT EXISTS report_email_sent_at TIMESTAMPTZ;
    ALTER TABLE public.event_registrations ADD COLUMN IF NOT EXISTS report_email_sent_to TEXT;
    CREATE INDEX IF NOT EXISTS idx_event_registrations_report_email_sent_at ON public.event_registrations (report_email_sent_at);
  `;

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
    console.log('exec_sql RPC result:', text || '(empty)');
  } catch (err) {
    console.log('exec_sql error (will verify columns):', err.message);
  }

  // Verify columns exist by selecting them
  const { data, error } = await supabase
    .from('event_registrations')
    .select('id, report_email_sent_at, report_email_sent_to')
    .limit(1);

  if (error) {
    console.log('VERIFY FAILED: report_email_* columns check:', error.message);
    process.exit(1);
  } else {
    console.log('VERIFY SUCCESS: report_email_sent_at / report_email_sent_to columns are available on event_registrations!');
  }
  process.exit(0);
}

applyMigration();
