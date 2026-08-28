require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkFK() {
  const { data: team, error } = await supabase.from('event_teams').select('*').limit(1);
  console.log('event_teams select sample:', error ? error.message : team);

  const { data: profiles, error: pErr } = await supabase.from('profiles').select('id').limit(5);
  console.log('profiles sample IDs:', (profiles || []).map(p => p.id));
}

checkFK();
