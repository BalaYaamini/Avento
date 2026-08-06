const supabase = require('./config/supabaseClient');
require('dotenv').config();

async function checkCols() {
  const { data, error } = await supabase.rpc('get_event_columns'); // no such rpc probably
  // just fetch one event
  const { data: evs } = await supabase.from('events').select('*').limit(1);
  console.log("Keys in event:", evs ? Object.keys(evs[0]) : "No events");
}
checkCols();
