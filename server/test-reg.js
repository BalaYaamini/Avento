const supabase = require('./config/supabaseClient');

async function test() {
  const { data: users } = await supabase.from('profiles').select('id').limit(1);
  const { data: events } = await supabase.from('events').select('id').limit(1);
  
  if (!users || users.length === 0 || !events || events.length === 0) {
    console.log('No users or events found.');
    return;
  }
  
  const userId = users[0].id;
  const eventId = events[0].id;

  console.log(`Testing with user_id: ${userId}, event_id: ${eventId}`);
  
  const newReg = {
    user_id: userId,
    event_id: eventId,
    status: 'registered',
    created_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('event_registrations')
    .insert(newReg)
    .select()
    .single();

  console.log('Result:', error || 'Success');
}

test();
