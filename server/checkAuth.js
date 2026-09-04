require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAuth() {
  const { data, error } = await supabase.auth.admin.listUsers();
  console.log('List users result:', error ? error.message : `${data.users.length} users`);
  if (data && data.users && data.users.length > 0) {
    console.log('Sample users:', data.users.slice(0, 3).map(u => ({ id: u.id, email: u.email })));
  }
}

checkAuth();
