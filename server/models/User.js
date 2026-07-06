const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  _id: {
    type: String,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    required: true,
    enum: ['student', 'faculty', 'admin', 'faculty_organizer', 'organizer'],
    default: 'student',
  },
  isVerified: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
