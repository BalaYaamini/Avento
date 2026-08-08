require('dotenv').config();
const supabase = require('./config/supabaseClient');

async function checkEvents() {
  const { data, error } = await supabase.from('events').select('id, title, registration_type, registered_count, capacity, max_teams');
  console.log(data);
}

checkEvents();
