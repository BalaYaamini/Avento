const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const authMiddleware = require('../middleware/authMiddleware');

// Verify QR token and record attendance (organizer/admin/faculty)
router.post('/verify', authMiddleware, attendanceController.verifyQrToken);

// Get attendance list for a specific event (organizer view)
router.get('/event/:eventId', authMiddleware, attendanceController.getEventAttendance);

// ── PERIODIC ATTENDANCE ROUTES ──────────────────────────────────────────
// Get periodic attendance metrics and progress list for an event
router.get('/event/:eventId/periods', authMiddleware, attendanceController.getEventPeriodicAttendance);

// Auto-generate periodic intervals (default 4h)
router.post('/event/:eventId/periods/auto-generate', authMiddleware, attendanceController.autoGeneratePeriods);

// Create custom attendance period
router.post('/event/:eventId/periods', authMiddleware, attendanceController.createCustomPeriod);

// Update attendance period
router.put('/event/:eventId/periods/:periodId', authMiddleware, attendanceController.updatePeriod);

// Delete attendance period
router.delete('/event/:eventId/periods/:periodId', authMiddleware, attendanceController.deletePeriod);

// Update certificate eligibility threshold
router.put('/event/:eventId/certificate-threshold', authMiddleware, attendanceController.updateCertificateThreshold);

module.exports = router;
