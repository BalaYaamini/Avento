const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '.env') });
const supabase = require('./config/supabaseClient');

async function applyMigration() {
  console.log('Running v39 column creation against Supabase profiles table...');

  const columns = [
    { name: 'avatar_url', type: 'TEXT' },
    { name: 'phone', type: 'TEXT' },
    { name: 'gender', type: 'TEXT' },
    { name: 'degree_program', type: 'TEXT' },
    { name: 'year_of_study', type: 'TEXT' },
    { name: 'college_name', type: 'TEXT' },
  ];

  for (const col of columns) {
    const sql = `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ${col.name} ${col.type};`;
    try {
      const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({ query: sql })
      });
      const text = await res.text();
      console.log(`Column ${col.name} add result:`, text);
    } catch (err) {
      console.log(`Column ${col.name} error:`, err.message);
    }
  }

  // Verify columns query
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, avatar_url, phone, gender, degree_program, year_of_study, college_name')
    .limit(1);

  if (error) {
    console.error('VERIFY ERROR:', error.message);
  } else {
    console.log('VERIFY SUCCESS! All profile columns are active in Supabase! Row sample:', data);
  }
  process.exit(0);
}

applyMigration();
