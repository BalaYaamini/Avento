require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws }
});

const firstNames = [
  'Aarav', 'Ananya', 'Rohan', 'Priya', 'Aditya', 'Siddharth', 'Kavya', 'Vikram', 'Neha', 'Rahul',
  'Meera', 'Arjun', 'Pooja', 'Varun', 'Divya', 'Karan', 'Isha', 'Rishi', 'Sneha', 'Yash',
  'Sanjana', 'Manish', 'Rhea', 'Gautam', 'Tarun', 'Shreya', 'Amit', 'Deepika', 'Rajesh', 'Swati'
];

const lastNames = [
  'Sharma', 'Iyer', 'Patel', 'Gupta', 'Reddy', 'Verma', 'Nair', 'Kumar', 'Singh', 'Deshmukh',
  'Joshi', 'Chawla', 'Mehta', 'Rao', 'Agarwal', 'Chatterjee', 'Pillai', 'Bhat', 'Saxena', 'Kapoor'
];

const colleges = [
  'Apex Institute of Technology',
  'National Institute of Science & Tech',
  'City Engineering College',
  'State Technological University',
  'Metropolitan Institute of Tech'
];

const departments = [
  'Computer Science & Engineering',
  'Information Technology',
  'Artificial Intelligence & Data Science',
  'Electronics & Communication'
];

async function seedRealList() {
  try {
    const { data: event } = await supabase.from('events').select('id, title').ilike('title', '%Test 101%').single();
    if (!event) return console.error('Test 101 event not found');
    const eventId = event.id;

    // Delete old records for Test 101
    await supabase.from('event_registrations').delete().eq('event_id', eventId);
    await supabase.from('event_teams').delete().eq('event_id', eventId);

    // Get 400 real Auth users directly from Supabase auth.users
    const { data: listData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const rawUsers = listData?.users || [];
    console.log(`Found ${rawUsers.length} total Auth users in Supabase auth.users table.`);

    // If fewer than 400 users, create extra real auth users
    while (rawUsers.length < 400) {
      const idx = rawUsers.length + 1;
      const { data: nu } = await supabase.auth.admin.createUser({
        email: `dummy${idx}.user@avento.test`,
        password: 'student123',
        email_confirm: true,
        user_metadata: { full_name: `Student ${idx}`, role: 'student' }
      });
      if (nu?.user) rawUsers.push(nu.user);
      else break;
    }

    const selectedUsers = rawUsers.slice(0, 400);
    console.log(`Selected ${selectedUsers.length} valid auth.users IDs.`);

    // Upsert 400 profiles with complete dummy data
    const profiles = selectedUsers.map((u, idx) => {
      const fn = firstNames[idx % firstNames.length];
      const ln = lastNames[idx % lastNames.length];
      const fullName = `${fn} ${ln}`;
      return {
        id: u.id,
        email: u.email || `student${idx + 1}@avento.test`,
        name: fullName,
        roll_number: `2026CS${String(idx + 1).padStart(3, '0')}`,
        college_name: colleges[idx % colleges.length],
        department: departments[idx % departments.length],
        degree_program: 'B.Tech Computer Science',
        avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=student_${idx + 1}`,
        phone: `+91 98765 ${String(10000 + idx + 1)}`,
        role: 'student'
      };
    });

    console.log(`Upserting ${profiles.length} student profiles...`);
    for (let i = 0; i < profiles.length; i += 50) {
      await supabase.from('profiles').upsert(profiles.slice(i, i + 50), { onConflict: 'id' });
    }
    console.log('✅ Profiles upserted.');

    const totalTeams = 100;
    const membersPerTeam = 4;

    const registrationsToInsert = [];
    let teamsCreated = 0;

    for (let t = 1; t <= totalTeams; t++) {
      const teamName = `Team Alpha ${String(t).padStart(3, '0')}`;
      const teamUsers = selectedUsers.slice((t - 1) * membersPerTeam, t * membersPerTeam);
      const leaderUser = teamUsers[0];

      // Insert Team into event_teams
      const { data: teamObj, error: tErr } = await supabase.from('event_teams').insert({
        event_id: eventId,
        name: teamName,
        leader_id: leaderUser.id,
        status: 'registered',
        created_at: new Date().toISOString()
      }).select().single();

      if (tErr) {
        console.error(`Error inserting team ${teamName}:`, tErr.message);
        continue;
      }

      teamsCreated++;

      for (const mUser of teamUsers) {
        registrationsToInsert.push({
          user_id: mUser.id,
          event_id: eventId,
          team_id: teamObj.id,
          status: 'registered',
          attendance_status: 'Absent',
          created_at: new Date().toISOString()
        });
      }
    }

    console.log(`Inserting ${registrationsToInsert.length} member registrations linked to ${teamsCreated} teams...`);
    for (let i = 0; i < registrationsToInsert.length; i += 50) {
      await supabase.from('event_registrations').insert(registrationsToInsert.slice(i, i + 50));
    }

    await supabase.from('events').update({
      registered_count: teamsCreated,
      max_teams: 100,
      min_team_size: 4,
      max_team_size: 4,
      registration_type: 'team'
    }).eq('id', eventId);

    console.log(`\n🎉 PERFECT SUCCESS! Created ${teamsCreated} Teams with EXACTLY 4 Members each (Total: ${registrationsToInsert.length} Participants with complete profiles) for "${event.title}"!`);
  } catch (err) {
    console.error('Fatal seed error:', err);
  }
}

seedRealList();
