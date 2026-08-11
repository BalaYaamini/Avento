const express = require('express');
const router = express.Router();
const scoringController = require('../controllers/scoringController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Get scoring config (public)
router.get(
  '/:eventId/config',
  authMiddleware,
  scoringController.getScoringConfig
);

// Create or update scoring config (admin/faculty only)
router.put(
  '/:eventId/config',
  authMiddleware,
  roleMiddleware(['admin', 'faculty', 'faculty_organizer']),
  scoringController.upsertScoringConfig
);

// Get leaderboard (public to all authenticated)
router.get(
  '/:eventId/leaderboard',
  authMiddleware,
  scoringController.getLeaderboard
);

// Submit a score (admin/faculty only)
router.post(
  '/:eventId/scores',
  authMiddleware,
  roleMiddleware(['admin', 'faculty', 'faculty_organizer']),
  scoringController.submitScore
);

// Edit a score (admin/faculty only)
router.put(
  '/:eventId/scores/:scoreId',
  authMiddleware,
  roleMiddleware(['admin', 'faculty', 'faculty_organizer']),
  scoringController.editScore
);

// Delete a score (admin/faculty only)
router.delete(
  '/:eventId/scores/:scoreId',
  authMiddleware,
  roleMiddleware(['admin', 'faculty', 'faculty_organizer']),
  scoringController.deleteScore
);

module.exports = router;
