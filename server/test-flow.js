const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const supabase = require('./config/supabaseClient');

async function testFullFlow() {
  try {
    const adminToken = jwt.sign(
      { id: 'fb9af9e2-e09b-4fb2-9960-fa440e1d60a9', roles: ['admin'] },
      process.env.JWT_SECRET || 'avento_super_secret_key_12345',
      { expiresIn: '1h' }
    );
    const studentToken = jwt.sign(
      { id: 'cb25ada9-7603-42de-9a82-c2a95f727277', roles: ['student'] },
      process.env.JWT_SECRET || 'avento_super_secret_key_12345',
      { expiresIn: '1h' }
    );

    console.log("Creating event...");
    const createRes = await axios.post('http://127.0.0.1:5001/api/events', {
      title: 'New Test Event',
      description: 'Test event description',
      category: 'Technical',
      venue: 'Main Hall',
      date: '2026-09-01T10:00:00Z',
      capacity: 100,
      registrationType: 'individual',
      facultyCoordinator: '4aaa0f09-a176-4bec-8332-505033141569'
    }, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    const eventId = createRes.data.event.id;
    console.log("Created event:", eventId);

    console.log("Publishing event...");
    await supabase.from('events').update({ status: 'published' }).eq('id', eventId);

    console.log("Registering for event...");
    const regRes = await axios.post('http://127.0.0.1:5001/api/registrations', {
      eventId
    }, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });

    console.log("Success:", regRes.data);
  } catch (err) {
    console.error("API Error Status:", err.response?.status);
    console.error("API Error Data:", err.response?.data);
  }
}

testFullFlow();
