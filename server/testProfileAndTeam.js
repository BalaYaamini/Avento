require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false }, realtime: { transport: ws } }
);

async function testPT() {
  const ts = Date.now();
  const email = `test.leader.${ts}@avento.test`;

  const { data: newUser, error: uErr } = await supabase.auth.admin.createUser({
    email,
    password: 'student123',
    email_confirm: true,
    user_metadata: { full_name: 'Test Leader', role: 'student' }
  });

  if (uErr) return console.error('Auth create error:', uErr.message);

  const uId = newUser.user.id;
  console.log('1. Created Auth User:', uId);

  const { data: pData, error: pErr } = await supabase.from('profiles').upsert({
    id: uId,
    email,
    name: 'Test Leader',
    roll_number: `2026TEST${ts.toString().slice(-4)}`,
    college_name: 'Apex Institute',
    department: 'CSE',
    role: 'student'
  }).select();

  if (pErr) console.error('2. Profile error:', pErr.message);
  else console.log('2. Profile created:', pData);

  const { data: event } = await supabase.from('events').select('id').ilike('title', '%Test 101%').single();

  const { data: team, error: tErr } = await supabase.from('event_teams').insert({
    event_id: event.id,
    name: `Test Team ${ts}`,
    leader_id: uId,
    status: 'registered'
  }).select().single();

  if (tErr) console.error('3. Team insert error:', tErr.message);
  else console.log('3. Team created:', team.id);
}

testPT();
