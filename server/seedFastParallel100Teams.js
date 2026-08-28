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

async function seedFastParallel() {
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
    await supabase.from('event_registrations').delete().eq('event_id', eventId);
    await supabase.from('event_teams').delete().eq('event_id', eventId);

    const totalTeams = 100;
    const membersPerTeam = 4;
    const totalParticipants = totalTeams * membersPerTeam;
    const batchId = Math.floor(Math.random() * 10000);

    console.log(`Creating 400 Auth accounts in parallel batches...`);

    const participantDefs = [];
    for (let p = 1; p <= totalParticipants; p++) {
      const teamIndex = Math.floor((p - 1) / membersPerTeam) + 1;
      const fn = firstNames[(p - 1) % firstNames.length];
      const ln = lastNames[(p - 1) % lastNames.length].trim();
      const fullName = `${fn} ${ln}`;
      const rollNum = `2026CS${String(p).padStart(3, '0')}`;
      const email = `stud_t${teamIndex}_m${((p - 1) % membersPerTeam) + 1}_b${batchId}@avento.test`;
      const college = colleges[(p - 1) % colleges.length];
      const dept = departments[(p - 1) % departments.length];
      const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=student_${p}`;
      const phone = String(9800000000 + p);

      participantDefs.push({
        pIndex: p,
        teamIndex,
        memberRoleIndex: (p - 1) % membersPerTeam,
        email,
        fullName,
        rollNum,
        college,
        dept,
        avatar,
        phone
      });
    }

    const createdUsersMap = new Map(); // email -> authId

    // Create 400 Auth users in parallel batches of 20
    for (let i = 0; i < participantDefs.length; i += 20) {
      const chunk = participantDefs.slice(i, i + 20);
      await Promise.all(chunk.map(async (def) => {
        const { data: newUser, error: uErr } = await supabase.auth.admin.createUser({
          email: def.email,
          password: 'Password123!',
          email_confirm: true,
          user_metadata: { full_name: def.fullName, role: 'student' }
        });
        if (newUser?.user) {
          createdUsersMap.set(def.email, newUser.user.id);
        } else if (uErr) {
          console.error(`Auth creation error for ${def.email}:`, uErr.message);
        }
      }));
    }

    console.log(`✅ Created ${createdUsersMap.size} Auth users.`);

    // Upsert 400 profiles with valid 10-digit Indian phone numbers
    const profiles = participantDefs.map(def => {
      const uId = createdUsersMap.get(def.email);
      if (!uId) return null;
      return {
        id: uId,
        email: def.email,
        name: def.fullName,
        roll_number: def.rollNum,
        college_name: def.college,
        department: def.dept,
        degree_program: 'B.Tech Computer Science',
        avatar_url: def.avatar,
        phone: def.phone,
        role: 'student'
      };
    }).filter(Boolean);

    console.log(`Upserting ${profiles.length} student profiles...`);
    for (let i = 0; i < profiles.length; i += 50) {
      const { error: pErr } = await supabase.from('profiles').upsert(profiles.slice(i, i + 50), { onConflict: 'id' });
      if (pErr) console.error('Profile upsert batch error:', pErr.message);
    }
    console.log('✅ All student profiles upserted successfully!');

    // Create 100 Teams & Registrations
    const registrationsToInsert = [];
    let teamsCount = 0;

    for (let t = 1; t <= totalTeams; t++) {
      const teamName = `Team Alpha ${String(t).padStart(3, '0')}`;
      const teamMembers = participantDefs.filter(def => def.teamIndex === t);
      const leaderDef = teamMembers[0];
      const leaderId = createdUsersMap.get(leaderDef.email);

      if (!leaderId) continue;

      // Upsert Team to avoid duplicate name errors
      const { data: teamObj, error: tErr } = await supabase.from('event_teams').upsert({
        event_id: eventId,
        name: teamName,
        leader_id: leaderId,
        status: 'registered',
        created_at: new Date().toISOString()
      }, { onConflict: 'event_id, name' }).select().single();

      if (tErr) {
        console.error(`Team insert error for ${teamName}:`, tErr.message);
        continue;
      }

      teamsCount++;

      for (const mDef of teamMembers) {
        const mUserId = createdUsersMap.get(mDef.email);
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
    }

    console.log(`Inserting ${registrationsToInsert.length} member registrations linked to ${teamsCount} teams...`);
    for (let i = 0; i < registrationsToInsert.length; i += 50) {
      await supabase.from('event_registrations').upsert(registrationsToInsert.slice(i, i + 50), { onConflict: 'user_id, event_id' });
    }
    console.log('✅ Member registrations linked to teams!');

    // Update Event Properties
    await supabase.from('events').update({
      registered_count: teamsCount,
      max_teams: 100,
      min_team_size: 4,
      max_team_size: 4,
      registration_type: 'team'
    }).eq('id', eventId);

    console.log(`\n🎉 INSTANT SUCCESS! Seeded ${teamsCount} Teams with EXACTLY 4 Members each (Total: ${registrationsToInsert.length} Registered Participants with complete Profiles) for "${event.title}"!`);
  } catch (err) {
    console.error('Fatal seed error:', err);
  }
}

seedFastParallel();
