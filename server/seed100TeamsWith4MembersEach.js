require('dotenv').config();
const { randomUUID } = require('crypto');
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

async function seedFullTeams() {
  try {
    console.log('🚀 Searching for event "Test 101"...');
    
    let { data: event } = await supabase
      .from('events')
      .select('*')
      .ilike('title', '%Test 101%')
      .maybeSingle();

    if (!event) {
      const { data: allEvents } = await supabase.from('events').select('id, title');
      event = (allEvents || []).find(e => e.title.toLowerCase().includes('test 101'));
    }

    if (!event) {
      console.error('❌ Could not find event "Test 101" in database!');
      return;
    }

    const eventId = event.id;
    console.log(`✅ Target Event Found: "${event.title}" (ID: ${eventId})`);

    const totalTeams = 100;
    const membersPerTeam = 4;
    const totalParticipants = totalTeams * membersPerTeam;

    console.log(`Preparing 100 teams x 4 members = ${totalParticipants} total participants...`);

    // Fetch existing Auth users up to 1000
    const { data: listData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existingUsersMap = new Map((listData?.users || []).map(u => [u.email, u.id]));

    const userMap = new Map(); // pIndex -> userId
    const profiles = [];

    for (let p = 1; p <= totalParticipants; p++) {
      const fn = firstNames[(p - 1) % firstNames.length];
      const ln = lastNames[(p - 1) % lastNames.length].trim();
      const fullName = `${fn} ${ln}`;
      const rollNum = `2026CS${String(p).padStart(3, '0')}`;
      const email = `student${p}.test101@avento.test`;
      const college = colleges[(p - 1) % colleges.length];
      const dept = departments[(p - 1) % departments.length];
      const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=student_${p}`;

      let uId = existingUsersMap.get(email);

      if (!uId) {
        try {
          const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
            email,
            password: 'student123',
            email_confirm: true,
            user_metadata: { full_name: fullName, role: 'student' }
          });
          if (newUser?.user) {
            uId = newUser.user.id;
          } else if (createErr) {
            uId = randomUUID();
          }
        } catch (e) {
          uId = randomUUID();
        }
      }

      if (!uId) uId = randomUUID();

      userMap.set(p, uId);

      profiles.push({
        id: uId,
        email,
        name: fullName,
        roll_number: rollNum,
        college_name: college,
        department: dept,
        degree_program: 'B.Tech Computer Science',
        avatar_url: avatar,
        phone: `+91 98765 ${String(10000 + p)}`,
        role: 'student'
      });
    }

    console.log(`Upserting ${profiles.length} student profiles into profiles table...`);
    for (let i = 0; i < profiles.length; i += 50) {
      await supabase.from('profiles').upsert(profiles.slice(i, i + 50), { onConflict: 'id' });
    }
    console.log('✅ Student profiles upserted!');

    // Clean previous records for Test 101
    console.log('Cleaning up previous team/registration records for Test 101...');
    await supabase.from('event_registrations').delete().eq('event_id', eventId);
    await supabase.from('event_teams').delete().eq('event_id', eventId);

    const registrationsToInsert = [];
    let insertedTeamsCount = 0;

    for (let t = 1; t <= totalTeams; t++) {
      const teamName = `Team Alpha ${String(t).padStart(3, '0')}`;
      const startIndex = (t - 1) * membersPerTeam + 1;
      const leaderId = userMap.get(startIndex);

      if (!leaderId) continue;

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

      insertedTeamsCount++;

      // Add registrations for all 4 team members
      for (let m = 0; m < membersPerTeam; m++) {
        const pIdx = startIndex + m;
        const mUserId = userMap.get(pIdx);
        if (!mUserId) continue;

        registrationsToInsert.push({
          user_id: mUserId,
          event_id: eventId,
          team_id: teamObj.id,
          status: 'registered',
          attendance_status: 'Absent',
          created_at: new Date().toISOString()
        });
      }

      if (t % 10 === 0) {
        console.log(`  ✓ Inserted ${t} / 100 teams into event_teams table (${t * 4} participants)`);
      }
    }

    console.log(`Inserting ${registrationsToInsert.length} member registrations linked to 100 teams...`);
    for (let i = 0; i < registrationsToInsert.length; i += 50) {
      await supabase.from('event_registrations').insert(registrationsToInsert.slice(i, i + 50));
    }
    console.log('✅ Registrations linked to teams successfully!');

    // Update Event properties
    await supabase.from('events').update({
      registered_count: insertedTeamsCount,
      max_teams: 100,
      min_team_size: 4,
      max_team_size: 4,
      registration_type: 'team'
    }).eq('id', eventId);

    console.log(`\n🎉 PERFECT SUCCESS! Seeded ${insertedTeamsCount} Teams with EXACTLY 4 Members each (Total: ${registrationsToInsert.length} Participants with complete dummy profiles) for "${event.title}"!`);
  } catch (err) {
    console.error('Fatal seed error:', err);
  }
}

seedFullTeams();
