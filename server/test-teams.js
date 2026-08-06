const supabase = require('./config/supabaseClient');
async function checkTeams() {
  const { data, error } = await supabase.from('event_teams').select('*').limit(1);
  console.log("Teams error:", error);
}
checkTeams();
