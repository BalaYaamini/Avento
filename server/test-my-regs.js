const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function testMyRegs() {
  try {
    const studentToken = jwt.sign(
      { id: 'cb25ada9-7603-42de-9a82-c2a95f727277', roles: ['student'] },
      process.env.JWT_SECRET || 'avento_super_secret_key_12345',
      { expiresIn: '1h' }
    );
    const regRes = await axios.get('http://127.0.0.1:5001/api/registrations/my-registrations', {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    console.log("Success:", regRes.data);
  } catch (err) {
    console.error("API Error Status:", err.response?.status);
    console.error("API Error Data:", err.response?.data);
  }
}

testMyRegs();
