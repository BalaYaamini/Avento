require('dotenv').config();
const supabase = require('./config/supabaseClient');

async function testFetch() {
  const { data, error } = await supabase
    .from('event_organizers')
    .select('*')
    .limit(1);
  
  if (data && data.length > 0) {
    console.log("Columns:", Object.keys(data[0]));
  } else {
    console.log("No data, try another way or it just has 0 rows.");
    // Wait, if it has 0 rows we can't see the schema keys via select '*'.
    // Let's insert a dummy row with just the basic columns and see if it works, then select it.
  }
  process.exit(0);
}

testFetch();
