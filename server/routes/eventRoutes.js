// server/routes/eventRoutes.js
const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure directories exist
const uploadDir = path.join(__dirname, '../uploads/proposals');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Set up multer for proposal document uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'proposal-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.pdf', '.docx', '.xlsx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOCX, XLSX, PNG, and JPG are allowed.'));
    }
  }
});

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

// ==========================================
// PROPOSAL WORKSPACE ROUTES
// ==========================================

// Get Proposal Workspace Details (Aggregated data)
router.get(
  '/:id/proposal-workspace',
  authMiddleware,
  roleMiddleware(['admin', 'faculty', 'faculty_organizer', 'student']),
  eventController.getProposalWorkspace
);

// Post Discussion Message
router.post(
  '/:id/discussion',
  authMiddleware,
  roleMiddleware(['admin', 'faculty', 'faculty_organizer', 'student']),
  eventController.postProposalDiscussion
);

// Upload Proposal Document
router.post(
  '/:id/documents',
  authMiddleware,
  roleMiddleware(['student', 'faculty', 'faculty_organizer']),
  upload.single('document'),
  eventController.uploadProposalDocument
);

// Update Proposal Status (Faculty)
router.put(
  '/:id/proposal-status',
  authMiddleware,
  roleMiddleware(['faculty', 'faculty_organizer', 'admin']),
  eventController.updateProposalStatus
);

// Resubmit Proposal (Student)
router.put(
  '/:id/proposal-resubmit',
  authMiddleware,
  roleMiddleware(['student']),
  eventController.resubmitProposal
);

// Get Proposal Team
router.get(
  '/:id/proposal-team',
  authMiddleware,
  roleMiddleware(['admin', 'faculty', 'faculty_organizer', 'student']),
  eventController.getProposalTeam
);

// Add Proposal Team Member
router.post(
  '/:id/proposal-team',
  authMiddleware,
  roleMiddleware(['admin', 'faculty', 'faculty_organizer', 'student']),
  eventController.addProposalTeamMember
);

// Remove Proposal Team Member
router.delete(
  '/:id/proposal-team/:memberId',
  authMiddleware,
  roleMiddleware(['admin', 'faculty', 'faculty_organizer', 'student']),
  eventController.removeProposalTeamMember
);

// getEventById — must come AFTER all static subroutes
router.get('/:id', eventController.getEventById);

module.exports = router;
