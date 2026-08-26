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
  phone: {
    type: String,
    default: null,
  },
  gender: {
    type: String,
    default: null,
  },
  degreeProgram: {
    type: String,
    default: null,
  },
  yearOfStudy: {
    type: String,
    default: null,
  },
  collegeName: {
    type: String,
    default: null,
  },
  rollNumber: {
    type: String,
    default: null,
  },
  department: {
    type: String,
    default: null,
  },
  avatarUrl: {
    type: String,
    default: null,
  },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
