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

async function seedFast() {
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
      console.error('❌ Event "Test 101" not found!');
      return;
    }

    const eventId = event.id;
    console.log(`✅ Target Event Found: "${event.title}" (${eventId})`);

    const totalTeams = 100;
    const membersPerTeam = 4;
    const totalParticipants = totalTeams * membersPerTeam;

    const profiles = [];
    const teams = [];
    const registrations = [];

    let pCounter = 1;

    for (let t = 1; t <= totalTeams; t++) {
      const teamId = randomUUID();
      const teamName = `Team Alpha ${String(t).padStart(3, '0')}`;
      let leaderId = null;

      for (let m = 1; m <= membersPerTeam; m++) {
        const userId = randomUUID();
        if (m === 1) leaderId = userId;

        const fn = firstNames[(pCounter - 1) % firstNames.length];
        const ln = lastNames[(pCounter - 1) % lastNames.length].trim();
        const fullName = `${fn} ${ln}`;
        const rollNum = `2026CS${String(pCounter).padStart(3, '0')}`;
        const email = `student${pCounter}.test101@avento.test`;
        const college = colleges[(pCounter - 1) % colleges.length];
        const dept = departments[(pCounter - 1) % departments.length];
        const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=student_${pCounter}`;

        profiles.push({
          id: userId,
          name: fullName,
          email: email,
          roll_number: rollNum,
          college_name: college,
          department: dept,
          degree_program: 'B.Tech Computer Science',
          avatar_url: avatar,
          phone: `+91 98765 ${String(10000 + pCounter)}`,
          role: 'student'
        });

        registrations.push({
          id: randomUUID(),
          user_id: userId,
          event_id: eventId,
          team_id: teamId,
          status: 'registered',
          attendance_status: 'Absent'
        });

        pCounter++;
      }

      teams.push({
        id: teamId,
        event_id: eventId,
        name: teamName,
        leader_id: leaderId,
        status: 'registered'
      });
    }

    console.log(`Bulk inserting ${profiles.length} profiles...`);
    for (let i = 0; i < profiles.length; i += 100) {
      await supabase.from('profiles').upsert(profiles.slice(i, i + 100), { onConflict: 'id' });
    }

    console.log(`Bulk inserting ${teams.length} teams...`);
    for (let i = 0; i < teams.length; i += 100) {
      await supabase.from('event_teams').upsert(teams.slice(i, i + 100), { onConflict: 'id' });
    }

    console.log(`Bulk inserting ${registrations.length} registrations...`);
    for (let i = 0; i < registrations.length; i += 100) {
      await supabase.from('event_registrations').upsert(registrations.slice(i, i + 100), { onConflict: 'id' });
    }

    // Update event counter
    await supabase.from('events').update({ registered_count: totalParticipants, max_teams: 100 }).eq('id', eventId);

    console.log(`\n🎉 INSTANT SUCCESS! Seeded 100 Teams (400 Total Participants) for "${event.title}"!`);
  } catch (err) {
    console.error('Fatal seed error:', err);
  }
}

seedFast();
