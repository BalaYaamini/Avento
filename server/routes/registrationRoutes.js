const express = require('express');
const router = express.Router();
const registrationController = require('../controllers/registrationController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Student features (protected)
router.post('/', authMiddleware, registrationController.registerForEvent);
router.post('/team', authMiddleware, registrationController.registerTeamForEvent);
router.post('/team/:teamId/confirm', authMiddleware, registrationController.confirmTeamRegistration);
router.post('/team/:teamId/admin-approve', authMiddleware, roleMiddleware(['admin', 'faculty_organizer', 'student']), registrationController.adminApproveTeam);
router.post('/team/:teamId/admin-reject', authMiddleware, roleMiddleware(['admin', 'faculty_organizer', 'student']), registrationController.adminRejectTeam);
router.put('/team/:teamId', authMiddleware, registrationController.updateTeamName);
router.post('/team/:teamId/members', authMiddleware, registrationController.addTeamMember);
router.delete('/team/:teamId/members/:userId', authMiddleware, registrationController.removeTeamMember);
router.get('/my-registrations', authMiddleware, registrationController.getMyRegistrations);
router.get('/event/:id/eligible-students', authMiddleware, registrationController.getEligibleStudents);
router.get('/event/:id/check-team-name', authMiddleware, registrationController.checkTeamName);
router.delete('/event/:eventId', authMiddleware, registrationController.cancelRegistrationByEventId);
router.delete('/:id', authMiddleware, registrationController.cancelRegistration);

router.post('/:registrationId/accept', authMiddleware, registrationController.acceptTeamInvitation);
router.post('/:registrationId/reject', authMiddleware, registrationController.rejectTeamInvitation);
router.post('/team/leave', authMiddleware, registrationController.leaveTeam);

// Admin-only features (protected)
router.get('/all', authMiddleware, adminMiddleware, registrationController.getAllRegistrations);
router.get('/event/:eventId', authMiddleware, roleMiddleware(['admin', 'faculty_organizer', 'student']), registrationController.getEventRegistrations);
router.get('/event/:eventId/confirmed-teams', authMiddleware, roleMiddleware(['admin', 'faculty_organizer', 'student']), registrationController.getConfirmedTeams);

module.exports = router;
