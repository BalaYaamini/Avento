// server/verifyPublishedEvents.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const supabase = require('./config/supabaseClient');

async function verify() {
  const { data: events, error } = await supabase
    .from('events')
    .select('id, title, category, status, date, registration_deadline, registration_type, capacity, max_teams, min_team_size, max_team_size, registered_count')
    .eq('status', 'published')
    .order('date', { ascending: true });

  if (error) {
    console.error('Error fetching events:', error);
  } else {
    console.log(`\n========================================`);
    console.log(` TOTAL PUBLISHED EVENTS: ${events.length}`);
    console.log(`========================================`);
    events.forEach((evt, idx) => {
      console.log(`\n[${idx + 1}] ${evt.title}`);
      console.log(`    Category / Stream : ${evt.category}`);
      console.log(`    Status            : ${evt.status} (OPEN FOR REGISTRATION)`);
      console.log(`    Registration Type : ${evt.registration_type} (${evt.registration_type === 'team' ? 'Max Teams: ' + evt.max_teams + ', Team Size: ' + evt.min_team_size + '-' + evt.max_team_size : 'Capacity: ' + evt.capacity})`);
      console.log(`    Event Date        : ${new Date(evt.date).toLocaleString()}`);
      console.log(`    Deadline          : ${new Date(evt.registration_deadline).toLocaleString()}`);
    });
    console.log(`\n========================================\n`);
  }
  process.exit(0);
}

verify();
