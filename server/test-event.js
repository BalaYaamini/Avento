const supabase = require('./config/supabaseClient');
require('dotenv').config();

async function checkEvent() {
  const { data } = await supabase.from('events').select('*').eq('title', 'Dance Competition').single();
  console.log(data);
}
checkEvent();
