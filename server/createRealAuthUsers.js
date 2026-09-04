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

async function createRealAuthUsersAndTeams() {
  try {
    console.log('🚀 Searching for event "Test 101"...');
    let { data: event } = await supabase.from('events').select('*').ilike('title', '%Test 101%').maybeSingle();
    if (!event) {
      const { data: allEvents } = await supabase.from('events').select('id, title');
      event = (allEvents || []).find(e => e.title.toLowerCase().includes('test 101'));
    }

    if (!event) {
      console.error('❌ Could not find event "Test 101"');
      return;
    }

    const eventId = event.id;
    console.log(`✅ Found Event: "${event.title}" (${eventId})`);

    const totalTeams = 100;
    const membersPerTeam = 4;
    const totalParticipants = totalTeams * membersPerTeam;

    console.log(`Creating 400 Supabase Auth users...`);

    // Fetch existing users
    let { data: listData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const userEmailToIdMap = new Map((listData?.users || []).map(u => [u.email, u.id]));

    const participantData = [];

    for (let p = 1; p <= totalParticipants; p++) {
      const fn = firstNames[(p - 1) % firstNames.length];
      const ln = lastNames[(p - 1) % lastNames.length].trim();
      const fullName = `${fn} ${ln}`;
      const rollNum = `2026CS${String(p).padStart(3, '0')}`;
      const email = `student${p}.test101@avento.test`;
      const college = colleges[(p - 1) % colleges.length];
      const dept = departments[(p - 1) % departments.length];
      const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=student_${p}`;
      const teamIndex = Math.floor((p - 1) / membersPerTeam) + 1;

      let authId = userEmailToIdMap.get(email);

      if (!authId) {
        const { data: newUser, error: cErr } = await supabase.auth.admin.createUser({
          email,
          password: 'student123',
          email_confirm: true,
          user_metadata: { full_name: fullName, role: 'student' }
        });
        if (newUser?.user) {
          authId = newUser.user.id;
          userEmailToIdMap.set(email, authId);
        } else if (cErr) {
          // Re-fetch users to locate if created
          const { data: relist } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const found = (relist?.users || []).find(u => u.email === email);
          if (found) {
            authId = found.id;
            userEmailToIdMap.set(email, authId);
          } else {
            console.error(`Failed to create auth user for ${email}:`, cErr.message);
          }
        }
      }

      if (authId) {
        participantData.push({
          pIndex: p,
          teamIndex,
          authId,
          email,
          fullName,
          rollNum,
          college,
          dept,
          avatar
        });
      }

      if (p % 50 === 0) {
        console.log(`  ✓ Auth accounts created/verified: ${participantData.length} / ${totalParticipants}`);
      }
    }

    console.log(`✅ Total Auth Users ready: ${participantData.length}`);

    // Upsert Profiles
    const profiles = participantData.map(p => ({
      id: p.authId,
      email: p.email,
      name: p.fullName,
      roll_number: p.rollNum,
      college_name: p.college,
      department: p.dept,
      degree_program: 'B.Tech Computer Science',
      avatar_url: p.avatar,
      phone: `+91 98765 ${String(10000 + p.pIndex)}`,
      role: 'student'
    }));

    console.log(`Upserting ${profiles.length} student profiles...`);
    for (let i = 0; i < profiles.length; i += 50) {
      await supabase.from('profiles').upsert(profiles.slice(i, i + 50), { onConflict: 'id' });
    }
    console.log('✅ Student profiles upserted!');

    // Clean old records for Test 101
    await supabase.from('event_registrations').delete().eq('event_id', eventId);
    await supabase.from('event_teams').delete().eq('event_id', eventId);

    // Create 100 Teams & Registrations
    const registrationsToInsert = [];
    let createdTeamsCount = 0;

    for (let t = 1; t <= totalTeams; t++) {
      const teamName = `Team Alpha ${String(t).padStart(3, '0')}`;
      const teamMembers = participantData.filter(p => p.teamIndex === t);

      if (teamMembers.length === 0) continue;
      const leaderAuthId = teamMembers[0].authId;

      const { data: teamObj, error: tErr } = await supabase.from('event_teams').insert({
        event_id: eventId,
        name: teamName,
        leader_id: leaderAuthId,
        status: 'registered',
        created_at: new Date().toISOString()
      }).select().single();

      if (tErr) {
        console.error(`Error inserting team ${teamName}:`, tErr.message);
        continue;
      }

      createdTeamsCount++;

      for (const m of teamMembers) {
        registrationsToInsert.push({
          user_id: m.authId,
          event_id: eventId,
          team_id: teamObj.id,
          status: 'registered',
          attendance_status: 'Absent',
          created_at: new Date().toISOString()
        });
      }

      if (t % 10 === 0) {
        console.log(`  ✓ Created ${t} / 100 teams (${createdTeamsCount * 4} member registrations ready)`);
      }
    }

    console.log(`Inserting ${registrationsToInsert.length} member registrations...`);
    for (let i = 0; i < registrationsToInsert.length; i += 50) {
      await supabase.from('event_registrations').insert(registrationsToInsert.slice(i, i + 50));
    }

    // Update event properties
    await supabase.from('events').update({
      registered_count: createdTeamsCount,
      max_teams: 100,
      min_team_size: 4,
      max_team_size: 4,
      registration_type: 'team'
    }).eq('id', eventId);

    console.log(`\n🎉 PERFECT SUCCESS! Created ${createdTeamsCount} Teams with EXACTLY 4 Members each (Total: ${registrationsToInsert.length} Participants with complete dummy accounts & profiles) for "${event.title}"!`);
  } catch (err) {
    console.error('Fatal seed error:', err);
  }
}

createRealAuthUsersAndTeams();
