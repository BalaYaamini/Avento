const dotenv = require('dotenv');
dotenv.config({ path: '.env' });
const { registerTeamForEvent } = require('./controllers/registrationController');
const supabase = require('./config/supabaseClient');

async function main() {
  // Get an active event
  const { data: event } = await supabase.from('events').select('id, title').eq('status', 'published').eq('registration_type', 'team').limit(1).single();
  if (!event) {
    console.log("No team event found");
    return;
  }
  
  // Get a leader user
  const { data: leader } = await supabase.from('profiles').select('id').eq('role', 'student').limit(1).single();
  // Get a member user
  const { data: member } = await supabase.from('profiles').select('id').eq('role', 'student').neq('id', leader.id).limit(1).single();

  const req = { 
    user: { id: leader.id }, 
    body: { 
      eventId: event.id, 
      teamName: 'Test Team Error ' + Date.now(), 
      memberIds: [member.id] 
    } 
  }; 
  const res = { 
    status: (code) => { 
      console.log('STATUS:', code); 
      return { json: (data) => console.log('JSON:', JSON.stringify(data, null, 2)) }; 
    }, 
    json: (data) => console.log('JSON:', JSON.stringify(data, null, 2)) 
  }; 
  
  console.log(`Registering team for event ${event.id} with leader ${leader.id} and member ${member.id}`);
  
  try {
    await registerTeamForEvent(req, res);
    console.log('Done');
  } catch (err) {
    console.error('Crash Error:', err);
  }
  process.exit(0); 
}
main();
