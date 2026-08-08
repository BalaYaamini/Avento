require('dotenv').config();
const supabase = require('./config/supabaseClient');

async function test() {
  // 1. Find a pending team
  const { data: team, error: tErr } = await supabase
    .from('event_teams')
    .select('id, leader_id, event_id, status')
    .eq('status', 'pending')
    .limit(1)
    .single();

  if (tErr || !team) {
    console.log('No pending teams found:', tErr);
    return;
  }
  
  console.log(`Found pending team: ${team.id} for event ${team.event_id}`);

  // 2. Try to update event_registrations to registered
  console.log('Updating event_registrations...');
  const { error: regErr } = await supabase
    .from('event_registrations')
    .update({ status: 'registered' })
    .eq('team_id', team.id);

  if (regErr) {
    console.log('Error updating event_registrations:', regErr);
    return;
  }
  console.log('Success updating event_registrations');

  // 3. Try to update event_teams to registered
  console.log('Updating event_teams...');
  const { error: teamStatusErr } = await supabase
    .from('event_teams')
    .update({ status: 'registered' })
    .eq('id', team.id);

  if (teamStatusErr) {
    console.log('Error updating event_teams:', teamStatusErr);
    return;
  }
  console.log('Success updating event_teams');

  // 4. Try RPC
  console.log('Calling increment_registered_count RPC...');
  const { error: rpcErr } = await supabase.rpc('increment_registered_count', { row_id: team.event_id });
  
  if (rpcErr) {
    console.log('Error calling RPC:', rpcErr);
  } else {
    console.log('RPC Success');
  }
}

test();
