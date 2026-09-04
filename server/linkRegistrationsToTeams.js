require('dotenv').config();
const supabase = require('./config/supabaseClient');

async function link() {
  const { data: event } = await supabase.from('events').select('id').ilike('title', '%Test 101%').single();
  if (!event) return;
  const eventId = event.id;

  const { data: teams } = await supabase.from('event_teams').select('id, name').eq('event_id', eventId);
  const { data: regs } = await supabase.from('event_registrations').select('id').eq('event_id', eventId);

  console.log(`Found ${(teams || []).length} teams and ${(regs || []).length} registrations.`);

  for (let t = 0; t < (teams || []).length; t++) {
    const team = teams[t];
    const teamRegs = (regs || []).slice(t * 4, (t + 1) * 4);
    for (const r of teamRegs) {
      await supabase.from('event_registrations').update({ team_id: team.id, status: 'registered' }).eq('id', r.id);
    }
  }

  const { count: teamCount } = await supabase.from('event_teams').select('*', { count: 'exact', head: true }).eq('event_id', eventId).eq('status', 'registered');
  await supabase.from('events').update({ registered_count: teamCount || 100, max_teams: 100 }).eq('id', eventId);

  console.log(`🎉 Complete! Linked all registrations to ${(teams || []).length} registered teams! Registered team count: ${teamCount}`);
}

link();
