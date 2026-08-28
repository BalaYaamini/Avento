require('dotenv').config();
const { randomUUID } = require('crypto');
const supabase = require('./config/supabaseClient');

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

async function seed400Participants() {
  try {
    console.log('🚀 Searching for event "Test 101"...');
    
    let { data: event } = await supabase
      .from('events')
      .select('*')
      .ilike('title', '%Test 101%')
      .maybeSingle();

    if (!event) {
      console.log('Fetching all events to locate exact ID...');
      const { data: allEvents } = await supabase.from('events').select('id, title');
      console.log('All events:', allEvents);
      event = allEvents.find(e => e.title.toLowerCase().includes('test 101'));
    }

    if (!event) {
      console.error('❌ Could not find event "Test 101"');
      return;
    }

    const eventId = event.id;
    console.log(`✅ Target Event Found: "${event.title}" (ID: ${eventId})`);

    // 100 Teams with 4 Members each = 400 Total Participants
    const totalTeams = 100;
    const membersPerTeam = 4;
    const totalParticipants = totalTeams * membersPerTeam;

    console.log(`Generating ${totalTeams} teams with ${membersPerTeam} members each (${totalParticipants} total dummy participants)...`);

    const profilesToInsert = [];
    const registrationsToInsert = [];
    const teamsToInsert = [];

    let participantCounter = 1;

    for (let t = 1; t <= totalTeams; t++) {
      const teamId = randomUUID();
      const teamName = `Team Alpha ${String(t).padStart(3, '0')}`;
      const leaderUserId = randomUUID();

      teamsToInsert.push({
        id: teamId,
        event_id: eventId,
        name: teamName,
        leader_id: leaderUserId,
        status: 'registered',
        created_at: new Date().toISOString()
      });

      const teamMembersInfo = [];

      for (let m = 1; m <= membersPerTeam; m++) {
        const userId = (m === 1) ? leaderUserId : randomUUID();
        const regId = randomUUID();

        const fn = firstNames[(participantCounter - 1) % firstNames.length];
        const ln = lastNames[(participantCounter - 1) % lastNames.length].trim();
        const fullName = `${fn} ${ln}`;
        const rollNum = `2026CS${String(participantCounter).padStart(3, '0')}`;
        const email = `student${participantCounter}.test101@avento.test`;
        const college = colleges[(participantCounter - 1) % colleges.length];
        const dept = departments[(participantCounter - 1) % departments.length];
        const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=student_${participantCounter}`;

        profilesToInsert.push({
          id: userId,
          name: fullName,
          email: email,
          roll_number: rollNum,
          college_name: college,
          department: dept,
          degree_program: 'B.Tech Computer Science',
          avatar_url: avatar,
          phone: `+91 98765 ${String(10000 + participantCounter)}`,
          role: 'student',
          updated_at: new Date().toISOString()
        });

        teamMembersInfo.push({
          user_id: userId,
          name: fullName,
          email: email,
          roll_number: rollNum,
          department: dept,
          role: m === 1 ? 'Leader' : 'Member'
        });

        registrationsToInsert.push({
          id: regId,
          user_id: userId,
          event_id: eventId,
          team_id: teamId,
          team_name: teamName,
          status: 'registered',
          attendance_status: 'Absent',
          created_at: new Date().toISOString()
        });

        participantCounter++;
      }
    }

    console.log(`Inserting ${profilesToInsert.length} dummy student profiles into database...`);
    // Insert profiles in chunks of 50 to stay within Supabase payload limits
    for (let i = 0; i < profilesToInsert.length; i += 50) {
      const chunk = profilesToInsert.slice(i, i + 50);
      const { error: pErr } = await supabase.from('profiles').upsert(chunk, { onConflict: 'id' });
      if (pErr) console.warn('Profiles upsert warning:', pErr.message);
    }
    console.log('✅ Profiles inserted successfully!');

    console.log(`Inserting ${teamsToInsert.length} event teams...`);
    for (let i = 0; i < teamsToInsert.length; i += 50) {
      const chunk = teamsToInsert.slice(i, i + 50);
      const { error: tErr } = await supabase.from('event_teams').upsert(chunk, { onConflict: 'id' });
      if (tErr) console.warn('Teams upsert notice:', tErr.message);
    }
    console.log('✅ Teams inserted successfully!');

    console.log(`Inserting ${registrationsToInsert.length} event registrations...`);
    for (let i = 0; i < registrationsToInsert.length; i += 50) {
      const chunk = registrationsToInsert.slice(i, i + 50);
      const { error: rErr } = await supabase.from('event_registrations').upsert(chunk, { onConflict: 'id' });
      if (rErr) console.warn('Registrations upsert notice:', rErr.message);
    }
    console.log('✅ Event Registrations inserted successfully!');

    // Update event registered count & max teams
    await supabase.from('events').update({ registered_count: totalParticipants, max_teams: 100 }).eq('id', eventId);
    console.log(`🎉 SUCCESS! Seeded 100 Teams with 4 Members each (Total: ${totalParticipants} Participants) for "Test 101"!`);
  } catch (err) {
    console.error('Fatal seed error:', err);
  }
}

seed400Participants();
