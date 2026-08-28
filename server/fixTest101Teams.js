require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws },
});

const firstNames = [
  'Aarav', 'Ananya', 'Rohan', 'Priya', 'Aditya', 'Siddharth', 'Kavya', 'Vikram', 'Neha', 'Rahul',
  'Meera', 'Arjun', 'Pooja', 'Varun', 'Divya', 'Karan', 'Isha', 'Rishi', 'Sneha', 'Yash'
];

const lastNames = [
  'Sharma', 'Iyer', 'Patel', 'Gupta', 'Reddy', 'Verma', 'Nair', 'Kumar', 'Singh', 'Deshmukh'
];

async function fixTeams() {
  try {
    const { data: event } = await supabase.from('events').select('*').ilike('title', '%Test 101%').single();
    if (!event) {
      console.log('Event Test 101 not found.');
      return;
    }
    const eventId = event.id;
    console.log(`Fixing teams for event Test 101 (${eventId})...`);

    // Fetch existing registrations for event
    const { data: regs } = await supabase.from('event_registrations').select('id, user_id').eq('event_id', eventId);
    console.log(`Found ${(regs || []).length} existing registrations.`);

    const totalTeams = 100;
    
    for (let t = 1; t <= totalTeams; t++) {
      const teamName = `Team Alpha ${String(t).padStart(3, '0')}`;
      const leaderEmail = `leader${t}.test101@avento.test`;
      const fn = firstNames[(t - 1) % firstNames.length];
      const ln = lastNames[(t - 1) % lastNames.length];
      const fullName = `${fn} ${ln}`;

      let leaderId = null;

      const { data: listData } = await supabase.auth.admin.listUsers();
      const existing = (listData?.users || []).find(u => u.email === leaderEmail);

      if (existing) {
        leaderId = existing.id;
      } else {
        const { data: newUser, error: cErr } = await supabase.auth.admin.createUser({
          email: leaderEmail,
          password: 'leader123',
          email_confirm: true,
          user_metadata: { full_name: fullName, role: 'student' }
        });
        if (newUser?.user) leaderId = newUser.user.id;
        else if (cErr) console.warn('Create leader notice:', cErr.message);
      }

      if (!leaderId) continue;

      // Upsert profile for leader
      await supabase.from('profiles').upsert({
        id: leaderId,
        email: leaderEmail,
        name: fullName,
        roll_number: `2026LEAD${String(t).padStart(3, '0')}`,
        college_name: 'Apex Institute of Technology',
        department: 'Computer Science & Engineering',
        degree_program: 'B.Tech Computer Science',
        role: 'student'
      }, { onConflict: 'id' });

      // Upsert team into event_teams with status = 'registered'
      const { data: teamData, error: tErr } = await supabase.from('event_teams').upsert({
        event_id: eventId,
        name: teamName,
        leader_id: leaderId,
        status: 'registered'
      }, { onConflict: 'event_id, name' }).select().single();

      if (tErr) console.warn(`Team ${teamName} notice:`, tErr.message);

      if (teamData && teamData.id) {
        // Assign 4 registrations to this team_id
        const teamRegs = (regs || []).slice((t - 1) * 4, t * 4);
        for (const reg of teamRegs) {
          await supabase.from('event_registrations').update({
            team_id: teamData.id,
            status: 'registered'
          }).eq('id', reg.id);
        }
      }

      if (t % 10 === 0) console.log(`✓ Processed ${t} / 100 teams into event_teams...`);
    }

    // Update event stats
    const { count: teamCount } = await supabase.from('event_teams').select('*', { count: 'exact', head: true }).eq('event_id', eventId).eq('status', 'registered');
    await supabase.from('events').update({ registered_count: teamCount || 100, max_teams: 100 }).eq('id', eventId);

    console.log(`\n🎉 SUCCESS! Created and registered ${teamCount} teams in event_teams table!`);
  } catch (e) {
    console.error('Error fixing teams:', e);
  }
}

fixTeams();
