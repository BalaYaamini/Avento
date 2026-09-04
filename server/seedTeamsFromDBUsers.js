require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws }
});

const firstNames = [
  'Aarav', 'Ananya', 'Rohan', 'Priya', 'Aditya', 'Siddharth', 'Kavya', 'Vikram', 'Neha', 'Rahul',
  'Meera', 'Arjun', 'Pooja', 'Varun', 'Divya', 'Karan', 'Isha', 'Rishi', 'Sneha', 'Yash',
  'Sanjana', 'Manish', 'Rhea', 'Gautam', 'Tarun', 'Shreya', 'Amit', 'Deepika', 'Rajesh', 'Swati',
  'Nikhil', 'Tanvi', 'Harsh', 'Anusha', 'Kunal', 'Bhavna', 'Pranav', 'Simran', 'Akash', 'Shruti'
];

const lastNames = [
  'Sharma', 'Iyer', 'Patel', 'Gupta', 'Reddy', 'Verma', 'Nair', 'Kumar', 'Singh', 'Deshmukh',
  'Joshi', 'Chawla', 'Mehta', 'Rao', 'Agarwal', 'Chatterjee', 'Pillai', 'Bhat', 'Saxena', 'Kapoor',
  'Trivedi', 'Bhasin', 'Dutta', 'Menon', 'Kulkarni', 'Sengupta', 'Mishra', 'Gowda', 'Shetty', 'Kaushik'
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

async function seedFromUsers() {
  try {
    const { data: event } = await supabase.from('events').select('*').ilike('title', '%Test 101%').single();
    if (!event) {
      console.log('Test 101 event not found.');
      return;
    }
    const eventId = event.id;
    console.log(`Target Event: "${event.title}" (${eventId})`);

    // Fetch all Auth users
    let { data: listData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    let authUsers = (listData?.users || []).filter(u => u.email && u.email.endsWith('@avento.test'));
    console.log(`Found ${authUsers.length} existing @avento.test Auth users in Supabase.`);

    // If fewer than 400 exist, create remaining
    const totalNeeded = 400;
    if (authUsers.length < totalNeeded) {
      console.log(`Creating remaining ${totalNeeded - authUsers.length} Auth users...`);
      for (let i = authUsers.length + 1; i <= totalNeeded; i++) {
        const email = `student${i}.test101@avento.test`;
        const fn = firstNames[(i - 1) % firstNames.length];
        const ln = lastNames[(i - 1) % lastNames.length].trim();
        const fullName = `${fn} ${ln}`;

        try {
          const { data: newUser } = await supabase.auth.admin.createUser({
            email,
            password: 'student123',
            email_confirm: true,
            user_metadata: { full_name: fullName, role: 'student' }
          });
          if (newUser?.user) authUsers.push(newUser.user);
        } catch (e) {}
      }
      console.log(`Total Auth users now: ${authUsers.length}`);
    }

    // Sort authUsers by email so student1 ... student400 are in clean order
    authUsers.sort((a, b) => a.email.localeCompare(b.email, undefined, { numeric: true }));

    // Prepare 400 Profiles
    const profiles = authUsers.slice(0, 400).map((u, idx) => {
      const pNum = idx + 1;
      const fn = firstNames[(idx) % firstNames.length];
      const ln = lastNames[(idx) % lastNames.length].trim();
      const fullName = `${fn} ${ln}`;
      return {
        id: u.id,
        email: u.email,
        name: fullName,
        roll_number: `2026CS${String(pNum).padStart(3, '0')}`,
        college_name: colleges[(idx) % colleges.length],
        department: departments[(idx) % departments.length],
        degree_program: 'B.Tech Computer Science',
        avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=student_${pNum}`,
        phone: `+91 98765 ${String(10000 + pNum)}`,
        role: 'student'
      };
    });

    console.log(`Upserting ${profiles.length} student profiles...`);
    for (let i = 0; i < profiles.length; i += 50) {
      await supabase.from('profiles').upsert(profiles.slice(i, i + 50), { onConflict: 'id' });
    }
    console.log('✅ Profiles upserted successfully!');

    // Clean old teams and registrations for Test 101
    await supabase.from('event_registrations').delete().eq('event_id', eventId);
    await supabase.from('event_teams').delete().eq('event_id', eventId);

    // Group into 100 teams of 4 members each
    const totalTeams = 100;
    const membersPerTeam = 4;

    const registrationsToInsert = [];
    let registeredTeamsCount = 0;

    for (let t = 1; t <= totalTeams; t++) {
      const teamName = `Team Alpha ${String(t).padStart(3, '0')}`;
      const teamUsers = authUsers.slice((t - 1) * membersPerTeam, t * membersPerTeam);

      if (teamUsers.length < membersPerTeam) break;

      const leaderUser = teamUsers[0];

      // Create Team in event_teams
      const { data: teamObj, error: tErr } = await supabase.from('event_teams').insert({
        event_id: eventId,
        name: teamName,
        leader_id: leaderUser.id,
        status: 'registered',
        created_at: new Date().toISOString()
      }).select().single();

      if (tErr) {
        console.error(`Error creating team ${teamName}:`, tErr.message);
        continue;
      }

      registeredTeamsCount++;

      // Create 4 member registrations for this team
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

      if (t % 10 === 0) {
        console.log(`  ✓ Created ${t} / 100 teams with 4 members each`);
      }
    }

    console.log(`Inserting ${registrationsToInsert.length} member registrations linked to ${registeredTeamsCount} teams...`);
    for (let i = 0; i < registrationsToInsert.length; i += 50) {
      await supabase.from('event_registrations').insert(registrationsToInsert.slice(i, i + 50));
    }

    // Update event properties
    await supabase.from('events').update({
      registered_count: registeredTeamsCount,
      max_teams: 100,
      min_team_size: 4,
      max_team_size: 4,
      registration_type: 'team'
    }).eq('id', eventId);

    console.log(`\n🎉 PERFECT SUCCESS! Created ${registeredTeamsCount} Teams with EXACTLY 4 Members each (Total: ${registrationsToInsert.length} Participants with complete dummy accounts & profiles) for "${event.title}"!`);
  } catch (err) {
    console.error('Fatal seed error:', err);
  }
}

seedFromUsers();
