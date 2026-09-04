const express = require('express');
const router = express.Router();
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage });
const registrationController = require('../controllers/registrationController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Student features (protected)
router.post('/', authMiddleware, registrationController.registerForEvent);
router.post('/team', authMiddleware, registrationController.registerTeamForEvent);
router.post('/team/:teamId/confirm', authMiddleware, registrationController.confirmTeamRegistration);
router.put('/:registrationId/payment-status', authMiddleware, registrationController.updatePaymentStatus);
router.put('/team/:teamId', authMiddleware, registrationController.updateTeamName);
router.post('/team/:teamId/members', authMiddleware, registrationController.addTeamMember);
router.delete('/team/:teamId/members/:userId', authMiddleware, registrationController.removeTeamMember);
router.post('/team/:teamId/invite-external', authMiddleware, registrationController.inviteExternalMember);
router.get('/team/:teamId/invites', authMiddleware, registrationController.getTeamInvites);
router.delete('/team/:teamId/invites/:inviteId', authMiddleware, registrationController.revokeTeamInvite);
router.get('/my-registrations', authMiddleware, registrationController.getMyRegistrations);
router.get('/event/:id/eligible-students', authMiddleware, registrationController.getEligibleStudents);
router.get('/event/:id/check-team-name', authMiddleware, registrationController.checkTeamName);
router.delete('/event/:eventId', authMiddleware, registrationController.cancelRegistrationByEventId);
router.delete('/:id', authMiddleware, registrationController.cancelRegistration);

router.post('/:registrationId/accept', authMiddleware, registrationController.acceptTeamInvitation);
router.post('/:registrationId/reject', authMiddleware, registrationController.rejectTeamInvitation);
router.post('/team/leave', authMiddleware, registrationController.leaveTeam);

// Public invite routes (no auth required)
router.get('/invite/:token', registrationController.getInviteByToken);
router.post('/invite/:token/accept', authMiddleware, registrationController.acceptInviteByToken);

// Admin-only features (protected with adminMiddleware)
router.get('/all', authMiddleware, adminMiddleware, registrationController.getAllRegistrations);
router.post('/admin/team', authMiddleware, adminMiddleware, registrationController.adminCreateTeam);
router.delete('/admin/team/:teamId', authMiddleware, adminMiddleware, registrationController.adminCancelTeamRegistration);
router.post('/admin/approve-request/:registrationId', authMiddleware, adminMiddleware, registrationController.adminApproveTeamRequest);
router.get('/admin/event/:eventId/eligible-students', authMiddleware, adminMiddleware, registrationController.getNonOrganizerStudentsForEvent);

// Admin & Organizer features (protected)
router.get('/event/:eventId', authMiddleware, roleMiddleware(['admin', 'faculty', 'faculty_organizer', 'student_organizer', 'student']), registrationController.getEventRegistrations);
router.get('/event/:eventId/confirmed-teams', authMiddleware, roleMiddleware(['admin', 'faculty', 'faculty_organizer', 'student_organizer', 'student']), registrationController.getConfirmedTeams);

// Student Photo Import Endpoints & Public Image Proxy
router.get('/drive-proxy', registrationController.proxyDriveImage);
router.post('/event/:eventId/import-photos', authMiddleware, roleMiddleware(['admin', 'faculty', 'faculty_organizer', 'student_organizer', 'student']), upload.array('photos', 200), registrationController.importStudentPhotos);
router.post('/event/:eventId/import-drive-links', authMiddleware, roleMiddleware(['admin', 'faculty', 'faculty_organizer', 'student_organizer', 'student']), registrationController.importStudentPhotoLinks);

module.exports = router;

