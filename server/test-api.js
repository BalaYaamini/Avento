const supabase = require('./config/supabaseClient');
const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function testApi() {
  const { data: events } = await supabase.from('events').select('id, title').eq('status', 'published').limit(1);
  if (!events || !events.length) {
    console.log("No published events.");
    return;
  }
  const eventId = events[0].id;
  console.log("Using published event:", events[0].title);

  try {
    const token = jwt.sign(
      { id: 'cb25ada9-7603-42de-9a82-c2a95f727277', roles: ['student'] },
      process.env.JWT_SECRET || 'avento_super_secret_key_12345',
      { expiresIn: '1h' }
    );

    const res = await axios.post('http://127.0.0.1:5001/api/registrations', {
      eventId
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log("Success:", res.data);
  } catch (err) {
    console.error("API Error Status:", err.response?.status);
    console.error("API Error Data:", err.response?.data);
  }
}

testApi();
