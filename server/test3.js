const supabase = require('./config/supabaseClient');
async function test3() {
  const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('*')
      .limit(1)
      .maybeSingle();
  console.log("Error:", eventErr);
}
test3();
