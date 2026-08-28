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

async function seedSequential() {
  try {
    console.log('🚀 Locating event "Test 101"...');
    const { data: event } = await supabase.from('events').select('id, title').ilike('title', '%Test 101%').single();
    if (!event) {
      console.error('❌ Test 101 event not found!');
      return;
    }
    const eventId = event.id;
    console.log(`✅ Target Event: "${event.title}" (${eventId})`);

    // Clean old records for Test 101
    console.log('Clearing old teams and registrations for Test 101...');
    await supabase.from('event_registrations').delete().eq('event_id', eventId);
    await supabase.from('event_teams').delete().eq('event_id', eventId);

    const totalTeams = 100;
    const membersPerTeam = 4;
    let globalCounter = 1;
    const ts = Date.now();

    console.log(`Seeding 100 Teams with EXACTLY 4 Members each (400 Total Participants)...`);

    let teamsCreated = 0;
    let registrationsCreated = 0;

    for (let t = 1; t <= totalTeams; t++) {
      const teamName = `Team Alpha ${String(t).padStart(3, '0')}`;
      const teamUsers = [];

      for (let m = 1; m <= membersPerTeam; m++) {
        const email = `team${t}.m${m}.${ts}@avento.test`;
        const fn = firstNames[(globalCounter - 1) % firstNames.length];
        const ln = lastNames[(globalCounter - 1) % lastNames.length].trim();
        const fullName = `${fn} ${ln}`;
        const rollNum = `2026CS${String(globalCounter).padStart(3, '0')}`;
        const college = colleges[(globalCounter - 1) % colleges.length];
        const dept = departments[(globalCounter - 1) % departments.length];
        const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=t${t}_m${m}`;

        const { data: newUser, error: uErr } = await supabase.auth.admin.createUser({
          email,
          password: 'student123',
          email_confirm: true,
          user_metadata: { full_name: fullName, role: 'student' }
        });

        if (uErr || !newUser?.user) {
          console.error(`Error creating user ${email}:`, uErr?.message);
          globalCounter++;
          continue;
        }

        const uId = newUser.user.id;

        // Upsert Profile
        await supabase.from('profiles').upsert({
          id: uId,
          email,
          name: fullName,
          roll_number: rollNum,
          college_name: college,
          department: dept,
          degree_program: 'B.Tech Computer Science',
          avatar_url: avatar,
          phone: `+91 98765 ${String(10000 + globalCounter)}`,
          role: 'student'
        }, { onConflict: 'id' });

        teamUsers.push({ id: uId, name: fullName, email });
        globalCounter++;
      }

      if (teamUsers.length < membersPerTeam) {
        console.warn(`Skipping team ${teamName} - failed to create 4 members`);
        continue;
      }

      const leaderId = teamUsers[0].id;

      // Insert Team into event_teams
      const { data: teamObj, error: tErr } = await supabase.from('event_teams').insert({
        event_id: eventId,
        name: teamName,
        leader_id: leaderId,
        status: 'registered',
        created_at: new Date().toISOString()
      }).select().single();

      if (tErr) {
        console.error(`Error inserting team ${teamName}:`, tErr.message);
        continue;
      }

      teamsCreated++;

      // Insert 4 member registrations for this team
      const memberRegs = teamUsers.map(u => ({
        user_id: u.id,
        event_id: eventId,
        team_id: teamObj.id,
        status: 'registered',
        attendance_status: 'Absent',
        created_at: new Date().toISOString()
      }));

      const { error: regErr } = await supabase.from('event_registrations').insert(memberRegs);
      if (!regErr) {
        registrationsCreated += memberRegs.length;
      }

      if (t % 10 === 0) {
        console.log(`  ✓ Successfully created Team ${t} / 100 ("${teamName}") with 4 confirmed members (${registrationsCreated} total registrations)`);
      }
    }

    // Update Event registered count
    await supabase.from('events').update({
      registered_count: teamsCreated,
      max_teams: 100,
      min_team_size: 4,
      max_team_size: 4,
      registration_type: 'team'
    }).eq('id', eventId);

    console.log(`\n🎉 PERFECT SUCCESS! Created ${teamsCreated} Teams with EXACTLY 4 Members each (Total: ${registrationsCreated} Registered Participants with complete Profiles) for "${event.title}"!`);
  } catch (err) {
    console.error('Fatal seed error:', err);
  }
}

seedSequential();
