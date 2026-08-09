require('dotenv').config();
const supabase = require('./config/supabaseClient');

async function testInsert() {
  const { data, error } = await supabase
    .from('event_organizers')
    .insert({
      event_id: '00000000-0000-0000-0000-000000000000',
      student_id: '00000000-0000-0000-0000-000000000000',
      category: 'Volunteer',
      role: 'normal',
      joined_at: new Date().toISOString()
    })
    .select();
  
  console.log("Data:", data);
  console.log("Error:", error);
  process.exit(0);
}

testInsert();
