require('dotenv').config();
const supabase = require('./config/supabaseClient');

async function checkDb() {
  const { data, error } = await supabase.rpc('confirm_team_registration', { p_team_id: '00000000-0000-0000-0000-000000000000', p_leader_id: '00000000-0000-0000-0000-000000000000' });
  console.log("RPC Error:", error);
}

checkDb();
