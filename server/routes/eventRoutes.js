// server/routes/eventRoutes.js
const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const scoringController = require('../controllers/scoringController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Use memory storage for Supabase uploads
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, Word, Excel, PowerPoint documents and images are allowed.'));
    }
  }
});

// Public routes
router.get('/', eventController.getEvents);
router.get('/:eventId/scoring', authMiddleware, scoringController.getScoring);
router.put('/:eventId/scoring', authMiddleware, scoringController.updateConfig);
router.put('/:eventId/scoring/score', authMiddleware, scoringController.updateScore);
router.put('/:eventId/scoring/bulk', authMiddleware, scoringController.bulkUpdateScores);

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
  roleMiddleware(['admin', 'student', 'student_organizer']),
  eventController.createEvent
);

router.put(
  '/:id',
  authMiddleware,
  roleMiddleware(['admin', 'faculty', 'faculty_organizer', 'student']),
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
  roleMiddleware(['admin', 'student', 'organizer', 'student_organizer', 'student_head']),
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

// Get confirmed team members
router.get('/:id/confirmed-team-members', eventController.getConfirmedTeamMembers);

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
  roleMiddleware(['admin', 'student', 'faculty', 'faculty_organizer']),
  upload.single('document'),
  eventController.uploadProposalDocument
);

// Remove Proposal Document
router.delete(
  '/:id/documents/:docId',
  authMiddleware,
  roleMiddleware(['admin', 'student', 'faculty', 'faculty_organizer']),
  eventController.removeProposalDocument
);

// Update Proposal Status (Faculty)
router.put(
  '/:id/proposal-status',
  authMiddleware,
  roleMiddleware(['faculty', 'faculty_organizer', 'admin']),
  eventController.updateProposalStatus
);

// Resubmit Proposal (Student / Organizer / Creator)
router.put(
  '/:id/proposal-resubmit',
  authMiddleware,
  roleMiddleware(['student', 'student_organizer', 'organizer', 'student_head', 'faculty', 'faculty_organizer', 'admin']),
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

// Update Proposal Team Member Role
router.put(
  '/:id/proposal-team/:memberId/role',
  authMiddleware,
  roleMiddleware(['admin', 'faculty', 'faculty_organizer', 'student']),
  eventController.updateProposalTeamMemberRole
);

// Update Proposal Team Member Module Permissions
router.put(
  '/:id/proposal-team/:memberId/permissions',
  authMiddleware,
  roleMiddleware(['admin', 'faculty', 'faculty_organizer', 'student']),
  eventController.updateProposalTeamMemberPermissions
);

// Update Proposal Details
router.put(
  '/:id/proposal-details',
  authMiddleware,
  roleMiddleware(['admin', 'faculty', 'faculty_organizer', 'student']),
  eventController.updateProposalDescription
);

// Close & open registrations (Admin, Faculty Coordinator, Organizers)
router.post(
  '/admin/:id/close-registrations',
  authMiddleware,
  roleMiddleware(['admin', 'faculty', 'faculty_organizer', 'student']),
  eventController.adminCloseRegistrations
);

router.post(
  '/admin/:id/open-registrations',
  authMiddleware,
  roleMiddleware(['admin', 'faculty', 'faculty_organizer', 'student']),
  eventController.adminOpenRegistrations
);

// Confirmation Email Config Routes
router.put(
  '/:id/confirmation-email',
  authMiddleware,
  roleMiddleware(['admin', 'faculty', 'faculty_organizer', 'student', 'organizer']),
  eventController.saveConfirmationEmailConfig
);

router.post(
  '/:id/confirmation-attachment',
  authMiddleware,
  roleMiddleware(['admin', 'faculty', 'faculty_organizer', 'student', 'organizer']),
  upload.single('attachment'),
  eventController.uploadConfirmationAttachment
);

router.delete(
  '/:id/confirmation-attachment',
  authMiddleware,
  roleMiddleware(['admin', 'faculty', 'faculty_organizer', 'student', 'organizer']),
  eventController.deleteConfirmationAttachment
);

// Higher Official Event Permissions Routes
router.get(
  '/official-permissions/all',
  authMiddleware,
  roleMiddleware(['admin', 'official']),
  eventController.getAllOfficialPermissions
);

router.post(
  '/:id/official-permission',
  authMiddleware,
  roleMiddleware(['admin', 'faculty', 'faculty_organizer', 'student', 'student_organizer', 'organizer']),
  upload.any(),
  eventController.requestOfficialPermission
);

router.get(
  '/:id/official-permission',
  authMiddleware,
  roleMiddleware(['admin', 'faculty', 'faculty_organizer', 'student', 'student_organizer', 'organizer']),
  eventController.getEventOfficialPermissions
);

router.put(
  '/:id/official-permission/:permissionId/decision',
  authMiddleware,
  roleMiddleware(['admin', 'official']),
  eventController.decideOfficialPermission
);

// getEventById — must come AFTER all static subroutes
router.get('/:id', eventController.getEventById);

module.exports = router;
