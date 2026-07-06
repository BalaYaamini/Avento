const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Get notifications for logged-in user
router.get('/my', authMiddleware, notificationController.getUserNotifications);

// Mark a notification as read
router.patch('/:id/read', authMiddleware, notificationController.markAsRead);

// Mark all notifications as read
router.patch('/my/read-all', authMiddleware, notificationController.markAllAsRead);

// Admin/System route for generic alerts
router.post('/', authMiddleware, adminMiddleware, notificationController.createNotification);

// Organizer route for event announcements
router.post('/announce/:eventId', authMiddleware, roleMiddleware(['admin', 'faculty_organizer', 'student']), notificationController.sendEventAnnouncement);

module.exports = router;
