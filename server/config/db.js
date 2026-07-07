const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    // Removed process.exit(1) to prevent the server from crashing abruptly,
    // which was causing the 502 Bad Gateway and "Network Error" on the frontend.
  }
};

module.exports = connectDB;
