require('dotenv').config();
const supabase = require('./config/supabaseClient');

async function checkTeams() {
  const { data, error } = await supabase
    .from('event_teams')
    .select('id, name, event_id, status');
  console.log("Teams Data:", data);
  console.log("Error:", error);
}

checkTeams();
