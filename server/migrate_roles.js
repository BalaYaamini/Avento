const mongoose = require('mongoose');
require('dotenv').config();
const supabase = require('./config/supabaseClient'); // reuse the working client

const mongoUri = process.env.MONGO_URI;

async function updateRoles() {
  try {
    console.log('Updating Supabase profiles...');
    const { data, error } = await supabase
      .from('profiles')
      .update({ role: 'student' })
      .eq('role', 'student_organizer');
      
    if (error) {
      console.error('Supabase Error:', error.message);
    } else {
      console.log('Supabase updated successfully.');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    
    console.log('Updating MongoDB users...');
    const result = await mongoose.connection.db.collection('users').updateMany(
      { role: 'student_organizer' },
      { $set: { role: 'student' } }
    );
    
    console.log(`MongoDB Updated: matched ${result.matchedCount}, modified ${result.modifiedCount}`);
    
    mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

updateRoles();
