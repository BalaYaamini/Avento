const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://joekmqnkpfjuptcgzpmh.supabase.co',
  'sb_secret_nA0uD7UiBe_3ZbTfa2nImg_NqDXdnA4'
);

async function test() {
  const { data, error } = await supabase.rpc('get_schema'); // if not exist, we'll just try an insert
  console.log("Starting test...");
  
  // Create a dummy event and user if we need to insert, but let's just query the columns via standard SQL
  // Wait, service role doesn't have direct SQL execution from supabase-js v2 unless through RPC.
  // We can just try to insert a dummy row into event_registrations to see what fails.
  const { data: res, error: err } = await supabase.from('event_registrations').insert({
    user_id: '00000000-0000-0000-0000-000000000000',
    event_id: '00000000-0000-0000-0000-000000000000',
    status: 'registered'
  });
  console.log("Error:", err);
}

test();
