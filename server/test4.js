const supabase = require('./config/supabaseClient');
async function test4() {
  const { data: reg, error } = await supabase
      .from('event_registrations')
      .select('*')
      .limit(1)
      .maybeSingle();
  console.log("Error:", error);
  console.log("Data:", reg);
}
test4();
