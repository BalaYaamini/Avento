const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

async function main() {
  const query = `
    SELECT
      tc.constraint_name,
      tc.constraint_type,
      kcu.column_name
    FROM
      information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    WHERE
      tc.table_name = 'event_registrations'
      AND tc.constraint_type = 'UNIQUE';
  `;
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql?query=${encodeURIComponent(query)}`, {
    headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY }
  });
  console.log(await res.text());
}
main();
