const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

async function main() {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/event_registrations?limit=1`, {
    headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY }
  });
  const data = await res.json();
  console.log("Registrations sample:", data);

  const res2 = await fetch(`${process.env.SUPABASE_URL}/rest/v1/event_teams?limit=1`, {
    headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY }
  });
  const data2 = await res2.json();
  console.log("Teams sample:", data2);
}
main();
