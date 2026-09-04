require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false }, realtime: { transport: ws } }
);

async function testSingle() {
  const email = `test.leader.${Date.now()}@avento.test`;
  const { data: newUser, error: uErr } = await supabase.auth.admin.createUser({
    email,
    password: 'student123',
    email_confirm: true,
    user_metadata: { full_name: 'Test Leader' }
  });

  if (uErr || !newUser?.user) {
    console.error('User create error:', uErr);
    return;
  }

  const userId = newUser.user.id;
  console.log('Created user ID in auth.users:', userId);

  await supabase.from('profiles').upsert({ id: userId, email, name: 'Test Leader' });

  const { data: event } = await supabase.from('events').select('id').ilike('title', '%Test 101%').single();

  const { data: team, error: tErr } = await supabase.from('event_teams').insert({
    event_id: event.id,
    name: `Single Test Team ${Date.now()}`,
    leader_id: userId,
    status: 'registered'
  }).select().single();

  if (tErr) {
    console.error('Team insert error:', tErr);
  } else {
    console.log('Team inserted successfully:', team.id);
  }
}

testSingle();
