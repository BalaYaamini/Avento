const express = require('express');
const router = express.Router();
const registrationController = require('../controllers/registrationController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Student features (protected)
router.post('/', authMiddleware, registrationController.registerForEvent);
router.post('/team', authMiddleware, registrationController.registerTeamForEvent);
router.get('/my-registrations', authMiddleware, registrationController.getMyRegistrations);
router.get('/event/:id/eligible-students', authMiddleware, registrationController.getEligibleStudents);
router.delete('/event/:eventId', authMiddleware, registrationController.cancelRegistrationByEventId);
router.delete('/:id', authMiddleware, registrationController.cancelRegistration);

// Admin-only features (protected)
router.get('/all', authMiddleware, adminMiddleware, registrationController.getAllRegistrations);
router.get('/event/:eventId', authMiddleware, roleMiddleware(['admin', 'faculty_organizer', 'student']), registrationController.getEventRegistrations);

module.exports = router;
