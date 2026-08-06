const supabase = require('./config/supabaseClient');
require('dotenv').config();

async function testSupabase() {
  const { data, error } = await supabase
    .from('event_registrations')
    .select('*')
    .eq('user_id', '64b5f8c9b200000000000000');
  console.log("Error:", error);
}

testSupabase();
