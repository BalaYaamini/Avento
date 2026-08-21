const Announcement = require('../models/Announcement');
const AnnouncementRead = require('../models/AnnouncementRead');

const mapAnnouncement = (item, isRead = undefined) => ({
  id: item._id,
  title: item.title,
  message: item.message,
  imageUrl: item.imageUrl,
  audience: item.audience,
  status: item.status,
  eventId: item.eventId || '',
  eventName: item.eventName || '',
  authorName: item.authorName,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  ...(isRead !== undefined ? { isRead } : {})
});

exports.listPublished = async (req, res) => {
  try {
    const userId = req.user.id;
    const announcements = await Announcement.find({ status: 'published' }).sort({ createdAt: -1 }).lean();
    const readRecords = await AnnouncementRead.find({ userId }).lean();
    const readSet = new Set(readRecords.map(r => r.announcementId));
    res.json(announcements.map(a => mapAnnouncement(a, readSet.has(String(a._id)))));
  } catch (err) {
    res.status(500).json({ message: 'Failed to retrieve announcements.', error: err.message });
  }
};

exports.listAll = async (req, res) => {
  try {
    const announcements = await Announcement.find().sort({ createdAt: -1 }).lean();
    res.json(announcements.map(a => mapAnnouncement(a)));
  } catch (err) {
    res.status(500).json({ message: 'Failed to retrieve announcements.', error: err.message });
  }
};

exports.getUnreadSummary = async (req, res) => {
  try {
    const userId = req.user.id;
    const announcements = await Announcement.find({ status: 'published', eventId: { $ne: '' } }).lean();
    const readRecords = await AnnouncementRead.find({ userId }).lean();
    const readSet = new Set(readRecords.map(r => r.announcementId));
    const summary = {};
    for (const a of announcements) {
      if (!readSet.has(String(a._id))) {
        const eid = a.eventId;
        if (!summary[eid]) summary[eid] = { eventId: eid, eventName: a.eventName, count: 0 };
        summary[eid].count += 1;
      }
    }
    const totalUnread = Object.values(summary).reduce((s, g) => s + g.count, 0);
    res.json({ totalUnread, byEvent: Object.values(summary) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get unread summary.', error: err.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    await AnnouncementRead.findOneAndUpdate(
      { userId, announcementId: id },
      { userId, announcementId: id },
      { upsert: true, new: true }
    );
    res.json({ message: 'Marked as read.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to mark as read.', error: err.message });
  }
};

exports.markEventRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { eventId } = req.params;
    const announcements = await Announcement.find({ status: 'published', eventId }).lean();
    const ops = announcements.map(a => ({
      updateOne: {
        filter: { userId, announcementId: String(a._id) },
        update: { $setOnInsert: { userId, announcementId: String(a._id) } },
        upsert: true
      }
    }));
    if (ops.length) await AnnouncementRead.bulkWrite(ops);
    res.json({ message: 'All announcements for this event marked as read.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to mark event announcements as read.', error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { title, message, imageUrl = '', audience = 'all', status = 'published', eventId = '', eventName = '' } = req.body;
    if (!title?.trim() || !message?.trim()) {
      return res.status(400).json({ message: 'Title and message are required.' });
    }
    const announcement = await Announcement.create({
      title, message, imageUrl, audience, status, eventId, eventName,
      authorId: req.user.id,
      authorName: req.user.fullName || 'Administrator'
    });
    res.status(201).json(mapAnnouncement(announcement));
  } catch (err) {
    res.status(400).json({ message: 'Failed to create announcement.', error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { title, message, imageUrl, audience, status, eventId, eventName } = req.body;
    const announcement = await Announcement.findByIdAndUpdate(
      req.params.id,
      { title, message, imageUrl, audience, status, eventId, eventName },
      { new: true, runValidators: true }
    ).lean();
    if (!announcement) return res.status(404).json({ message: 'Announcement not found.' });
    res.json(mapAnnouncement(announcement));
  } catch (err) {
    res.status(400).json({ message: 'Failed to update announcement.', error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const result = await Announcement.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ message: 'Announcement not found.' });
    await AnnouncementRead.deleteMany({ announcementId: req.params.id });
    res.json({ message: 'Announcement deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete announcement.', error: err.message });
  }
};
