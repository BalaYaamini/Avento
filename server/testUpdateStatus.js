const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  try {
    const { error: updateErr } = await supabase
      .from('event_registrations')
      .update({ status: 'cancelled' })
      .eq('id', 'dummy-id-1234');

    if (updateErr) {
      console.error('Supabase Error:', updateErr);
    } else {
      console.log('Update success!');
    }
  } catch (err) {
    console.error('Catch Error:', err);
  }
}
main();
