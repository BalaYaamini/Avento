// server/scripts/verifyEvents.js
require('dotenv').config();
const supabase = require('../config/supabaseClient');

async function verify() {
  const { data: events, error } = await supabase
    .from('events')
    .select('id, title, category, status, date, registration_deadline, registration_type, capacity, max_teams, min_team_size, max_team_size, registered_count')
    .eq('status', 'published')
    .order('date', { ascending: true });

  if (error) {
    console.error('Error fetching events:', error);
  } else {
    console.log(`\nFound ${events.length} published events:`);
    events.forEach((evt, idx) => {
      console.log(`\n${idx + 1}. Title: ${evt.title}`);
      console.log(`   Category: ${evt.category}`);
      console.log(`   Status: ${evt.status} (Open for Registration)`);
      console.log(`   Registration Type: ${evt.registration_type} (Capacity/Max Teams: ${evt.capacity || evt.max_teams})`);
      console.log(`   Event Date: ${evt.date}`);
      console.log(`   Deadline: ${evt.registration_deadline}`);
    });
  }
  process.exit(0);
}

verify();
