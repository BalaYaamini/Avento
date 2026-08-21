const mongoose = require('mongoose');

const announcementReadSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  announcementId: { type: String, required: true, index: true }
}, { timestamps: true });

announcementReadSchema.index({ userId: 1, announcementId: 1 }, { unique: true });

module.exports = mongoose.model('AnnouncementRead', announcementReadSchema);
