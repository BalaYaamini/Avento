const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const authMiddleware = require('../middleware/authMiddleware');

// Verify QR token and record attendance (organizer/admin/faculty)
router.post('/verify', authMiddleware, attendanceController.verifyQrToken);

// Get attendance list for a specific event (organizer view)
router.get('/event/:eventId', authMiddleware, attendanceController.getEventAttendance);

module.exports = router;
