const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY,
  {
    realtime: {
      transport: ws
    }
  }
);

module.exports = supabase;
