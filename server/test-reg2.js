const supabase = require('./config/supabaseClient');

async function testFull() {
  const { data: users } = await supabase.from('profiles').select('id').limit(1);
  const { data: events } = await supabase.from('events').select('*').limit(1);
  
  if (!users || !users.length || !events || !events.length) return;
  const userId = users[0].id;
  const eventId = events[0].id;
  const event = events[0];

  try {
    const newReg = {
      user_id: userId,
      event_id: eventId,
      status: 'registered',
      created_at: new Date().toISOString()
    };

    const { data: registration, error: regErr } = await supabase
      .from('event_registrations')
      .insert(newReg)
      .select()
      .single();

    if (regErr) {
      if (regErr.code !== '23505') throw regErr; // Ignore duplicate if exists
    }

    // Update event registered count
    await supabase.rpc('increment_registered_count', { row_id: eventId });
    // Alternative if rpc not available:
    await supabase.from('events').update({ registered_count: event.registered_count + 1 }).eq('id', eventId);

    console.log("Passed increment");

    // Notification Mock
    console.log("Full logic completed without throw.");

  } catch (e) {
    console.log("THREW EXCEPTION:", e.message);
  }
}

testFull();
