const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const ws = require('ws');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in server/.env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws }
});

async function fixRoles() {
  console.log('🔧 Starting Roles Array Fix...');

  try {
    const { data: profiles, error: profileError } = await supabase.from('profiles').select('*');
    if (profileError) throw profileError;

    for (const profile of profiles) {
      if (profile.role && (!profile.roles || profile.roles.length === 0)) {
        console.log(`Fixing roles for ${profile.email}... Setting roles to ['${profile.role}']`);
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ roles: [profile.role] })
          .eq('id', profile.id);
        
        if (updateError) {
          console.error(`❌ Error updating ${profile.email}:`, updateError.message);
        } else {
          console.log(`✅ Updated ${profile.email}`);
        }
      } else {
        console.log(`⏩ Skipping ${profile.email}, roles array looks good:`, profile.roles);
      }
    }
    
    console.log('\n✨ Roles Fix Completed Successfully.');

  } catch (err) {
    console.error("Fix failed:", err);
  }
}

fixRoles();
