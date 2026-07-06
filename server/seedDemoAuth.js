// server/seedDemoAuth.js
// Seeds all demo accounts into Supabase Auth and the profiles table.
// Run: node seedDemoAuth.js

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const ws = require('ws');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey || supabaseKey.startsWith('YOUR_')) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in server/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws },
});

// All demo/seed accounts
const accounts = [
  {
    email: 'admin.avento@gmail.com',
    password: 'admin123',
    role: 'admin',
    name: 'Avento Administrator',
    employeeId: null,
    rollNumber: null,
  },
  {
    email: 'student.demo@cse.suh.edu.in',
    password: 'student123',
    role: 'student',
    name: 'Demo Student',
    employeeId: null,
    rollNumber: '2203A51000',
  },
  {
    email: 'faculty.demo@suh.edu.in',
    password: 'faculty123',
    role: 'faculty',
    name: 'Demo Faculty',
    employeeId: 'EMP001',
    rollNumber: null,
  },
  // Additional faculty account
  {
    email: 'carter@suh.edu.in',
    password: 'faculty123',
    role: 'faculty',
    name: 'Dr. Carter Smith',
    employeeId: 'EMP002',
    rollNumber: null,
  },
];

async function seedAccount(account) {
  console.log(`\nProcessing ${account.email}...`);
  let userId = null;

  try {
    // List existing users and find by email
    const { data: usersData, error: listErr } = await supabase.auth.admin.listUsers();
    if (listErr) throw listErr;

    const existing = usersData.users.find((u) => u.email === account.email);

    if (existing) {
      console.log(`  ✓ Already exists in auth.users (ID: ${existing.id})`);
      userId = existing.id;
      // Update password and confirm email
      await supabase.auth.admin.updateUserById(userId, {
        password: account.password,
        email_confirm: true,
        user_metadata: { full_name: account.name, role: account.role },
      });
      console.log(`  ✓ Password and metadata updated`);
    } else {
      console.log(`  Creating new user...`);
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email: account.email,
        password: account.password,
        email_confirm: true,
        user_metadata: { full_name: account.name, role: account.role },
      });
      if (createErr) throw createErr;
      userId = newUser.user.id;
      console.log(`  ✓ Created with ID: ${userId}`);
    }

    // Upsert profile
    const profile = {
      id: userId,
      email: account.email,
      name: account.name,
      role: account.role,
      created_at: new Date().toISOString(),
    };
    if (account.employeeId) profile.employee_id = account.employeeId;
    if (account.rollNumber) profile.roll_number = account.rollNumber;

    const { error: profileErr } = await supabase
      .from('profiles')
      .upsert(profile, { onConflict: 'id' });

    if (profileErr) {
      console.warn(`  ⚠ Profile upsert warning: ${profileErr.message}`);
    } else {
      console.log(`  ✓ Profile upserted (role: ${account.role})`);
    }

    console.log(`✅ Done: ${account.email}`);
  } catch (err) {
    console.error(`❌ Failed ${account.email}:`, err.message);
  }
}

async function seed() {
  console.log('🌱 Starting Demo Auth Seeding...\n');
  for (const account of accounts) {
    await seedAccount(account);
  }


  console.log('\n✨ Seeding Completed.');
}

seed();
