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

async function seed() {
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
    console.log(`✅ Found Event: "${event.title}" (${eventId})`);

    const totalTeams = 100;
    const membersPerTeam = 4;
    let participantCounter = 1;

    console.log(`Starting creation of ${totalTeams} teams x 4 members = 400 auth & profile accounts...`);

    // Fetch existing users map for speed
    const { data: usersData } = await supabase.auth.admin.listUsers();
    const existingUsersMap = new Map((usersData?.users || []).map(u => [u.email, u.id]));

    for (let t = 1; t <= totalTeams; t++) {
      const teamName = `Team Alpha ${String(t).padStart(3, '0')}`;
      let leaderId = null;

      for (let m = 1; m <= membersPerTeam; m++) {
        const fn = firstNames[(participantCounter - 1) % firstNames.length];
        const ln = lastNames[(participantCounter - 1) % lastNames.length].trim();
        const fullName = `${fn} ${ln}`;
        const rollNum = `2026CS${String(participantCounter).padStart(3, '0')}`;
        const email = `student${participantCounter}.test101@avento.test`;
        const college = colleges[(participantCounter - 1) % colleges.length];
        const dept = departments[(participantCounter - 1) % departments.length];
        const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=student_${participantCounter}`;

        let userId = existingUsersMap.get(email);

        if (!userId) {
          const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
            email,
            password: 'student123',
            email_confirm: true,
            user_metadata: { full_name: fullName, role: 'student' }
          });
          if (!createErr && newUser?.user) {
            userId = newUser.user.id;
            existingUsersMap.set(email, userId);
          }
        }

        if (!userId) {
          participantCounter++;
          continue;
        }

        if (m === 1) leaderId = userId;

        // Upsert Profile with complete details
        await supabase.from('profiles').upsert({
          id: userId,
          email,
          name: fullName,
          roll_number: rollNum,
          college_name: college,
          department: dept,
          degree_program: 'B.Tech Computer Science',
          avatar_url: avatar,
          phone: `+91 98765 ${String(10000 + participantCounter)}`,
          role: 'student'
        }, { onConflict: 'id' });

        // Upsert Registration
        await supabase.from('event_registrations').upsert({
          user_id: userId,
          event_id: eventId,
          status: 'registered',
          attendance_status: 'Absent'
        }, { onConflict: 'event_id, user_id' });

        participantCounter++;
      }

      // Upsert Team
      if (leaderId) {
        await supabase.from('event_teams').upsert({
          event_id: eventId,
          name: teamName,
          leader_id: leaderId,
          status: 'registered'
        }, { onConflict: 'event_id, leader_id' });
      }

      if (t % 10 === 0) {
        console.log(`✓ Processed ${t} teams (${t * 4} / 400 participants)...`);
      }
    }

    // Update event registered count & max teams
    const { count } = await supabase.from('event_registrations').select('*', { count: 'exact', head: true }).eq('event_id', eventId);
    await supabase.from('events').update({ registered_count: count || 400, max_teams: 100 }).eq('id', eventId);

    console.log(`\n🎉 SUCCESS! Fully seeded 100 Teams with 4 Members each (${count || 400} Total Participants) for "${event.title}"!`);
  } catch (err) {
    console.error('Fatal seed error:', err);
  }
}

seed();
