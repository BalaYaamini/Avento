const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 140 },
  message: { type: String, required: true, trim: true, maxlength: 5000 },
  imageUrl: { type: String, default: '' },
  audience: { type: String, enum: ['all', 'registered'], default: 'all' },
  status: { type: String, enum: ['draft', 'published'], default: 'published' },
  eventId: { type: String, default: '' },
  eventName: { type: String, default: '' },
  authorId: { type: String, required: true },
  authorName: { type: String, default: 'Administrator' }
}, { timestamps: true });

module.exports = mongoose.model('Announcement', announcementSchema);
