const express = require('express');
const router = express.Router();
const controller = require('../controllers/announcementController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

router.get('/', authMiddleware, controller.listPublished);
router.get('/admin', authMiddleware, adminMiddleware, controller.listAll);
router.get('/unread-summary', authMiddleware, controller.getUnreadSummary);
router.post('/:id/read', authMiddleware, controller.markAsRead);
router.post('/event/:eventId/read-all', authMiddleware, controller.markEventRead);
router.post('/', authMiddleware, adminMiddleware, controller.create);
router.put('/:id', authMiddleware, adminMiddleware, controller.update);
router.delete('/:id', authMiddleware, adminMiddleware, controller.remove);

module.exports = router;
