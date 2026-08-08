require('dotenv').config();
const supabase = require('./config/supabaseClient');

async function testConfirmedTeams() {
  const eventId = '4564fd0d-b0ce-477c-9da4-d4f46f4f787d'; // Hackathon event
  
  // 1. Get confirmed teams
  const { data: teams, error: teamErr } = await supabase
    .from('event_teams')
    .select('*')
    .eq('event_id', eventId)
    .eq('status', 'registered');
    
  console.log("Teams:", teams, teamErr);
  
  // 2. Get registrations for these teams
  if (teams && teams.length > 0) {
    const teamIds = teams.map(t => t.id);
    const { data: regs, error: regErr } = await supabase
      .from('event_registrations')
      .select(`
        id, team_id, status, user_id,
        profiles(id, name, email, department)
      `)
      .in('team_id', teamIds)
      .eq('status', 'registered');
      
    console.log("Regs:", JSON.stringify(regs, null, 2), regErr);
  }
}

testConfirmedTeams();
