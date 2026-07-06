// server/routes/eventRoutes.js
const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Public routes
router.get('/', eventController.getEvents);

// IMPORTANT: /organizer/my-events MUST come before /:id to avoid being matched as an id
router.get(
  '/organizer/my-events',
  authMiddleware,
  roleMiddleware(['admin', 'faculty', 'faculty_organizer', 'student']),
  eventController.getMyEvents
);

// Protected CRUD routes
router.post(
  '/',
  authMiddleware,
  roleMiddleware(['student']),
  eventController.createEvent
);

router.put(
  '/:id',
  authMiddleware,
  roleMiddleware(['admin', 'student']),
  eventController.editEvent
);

router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware(['admin', 'student']),
  eventController.deleteEvent
);

// Status update (faculty approval / admin publish)
router.put(
  '/:id/status',
  authMiddleware,
  roleMiddleware(['admin', 'faculty', 'faculty_organizer', 'student']),
  eventController.updateStatus
);

// Publish approved event
router.put(
  '/:id/publish',
  authMiddleware,
  roleMiddleware(['student']),
  eventController.publishEvent
);

// Analytics
router.get(
  '/:id/analytics',
  authMiddleware,
  roleMiddleware(['admin', 'faculty', 'faculty_organizer', 'student']),
  eventController.getEventAnalytics
);

// Team member management (student_organizer or admin)
router.post(
  '/:id/team-members',
  authMiddleware,
  roleMiddleware(['admin', 'student']),
  eventController.addTeamMember
);

router.delete(
  '/:id/team-members/:memberId',
  authMiddleware,
  roleMiddleware(['admin', 'student']),
  eventController.removeTeamMember
);

// Get event organizers
router.get('/:id/organizers', eventController.getEventOrganizers);

// Recruit event organizer
router.post(
  '/:id/organizers',
  authMiddleware,
  roleMiddleware(['admin', 'student']),
  eventController.recruitOrganizer
);

// Remove event organizer
router.delete(
  '/:id/organizers/:studentId',
  authMiddleware,
  roleMiddleware(['admin', 'student']),
  eventController.removeOrganizer
);

// Toggle Allow Join Team
router.put(
  '/:id/join-team-toggle',
  authMiddleware,
  roleMiddleware(['admin', 'student']),
  eventController.toggleJoinTeam
);

// Submit join request
router.post(
  '/:id/organizer-requests',
  authMiddleware,
  roleMiddleware(['student']),
  eventController.submitOrganizerRequest
);

// Get join requests
router.get(
  '/:id/organizer-requests',
  authMiddleware,
  roleMiddleware(['admin', 'student']),
  eventController.getOrganizerRequests
);

// Process join request (approve/reject)
router.put(
  '/:id/organizer-requests/:requestId',
  authMiddleware,
  roleMiddleware(['admin', 'student']),
  eventController.processJoinRequest
);

// Get current student's own organizer requests
router.get(
  '/organizer-requests/my-requests',
  authMiddleware,
  roleMiddleware(['student']),
  eventController.getMyOrganizerRequests
);

// Withdraw organizer request
router.put(
  '/:id/organizer-requests/:requestId/withdraw',
  authMiddleware,
  roleMiddleware(['student']),
  eventController.withdrawOrganizerRequest
);

// Withdraw event proposal
router.put(
  '/:id/withdraw',
  authMiddleware,
  roleMiddleware(['student']),
  eventController.withdrawEvent
);

// getEventById — must come AFTER all static subroutes
router.get('/:id', eventController.getEventById);

module.exports = router;
