const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const supabase = require('./config/supabaseClient');

async function testTeamFlow() {
  try {
    const adminToken = jwt.sign(
      { id: 'fb9af9e2-e09b-4fb2-9960-fa440e1d60a9', roles: ['admin'] },
      process.env.JWT_SECRET || 'avento_super_secret_key_12345',
      { expiresIn: '1h' }
    );
    const student1Token = jwt.sign(
      { id: 'cb25ada9-7603-42de-9a82-c2a95f727277', roles: ['student'] },
      process.env.JWT_SECRET || 'avento_super_secret_key_12345',
      { expiresIn: '1h' }
    );
    
    // We need a second student for the team
    const { data: students } = await supabase.from('profiles').select('id').eq('role', 'student').neq('id', 'cb25ada9-7603-42de-9a82-c2a95f727277').limit(1);
    const student2Id = students[0].id;

    // Find an existing event with team registration
    const { data: events } = await supabase
      .from('events')
      .select('id')
      .eq('registration_type', 'team')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (!events || events.length === 0) {
      console.log("No team event found.");
      return;
    }
    const eventId = events[0].id;
    console.log("Found team event:", eventId);

    // Skipping publish because event should already be published

    console.log("Registering team for event...");
    const regRes = await axios.post('http://127.0.0.1:5001/api/registrations/team', {
      eventId,
      teamName: 'The Innovators',
      memberIds: [student2Id]
    }, {
      headers: { Authorization: `Bearer ${student1Token}` }
    });

    console.log("Success:", regRes.data);
  } catch (err) {
    console.error("API Error Status:", err.response?.status);
    console.error("API Error Data:", err.response?.data);
  }
}

testTeamFlow();
