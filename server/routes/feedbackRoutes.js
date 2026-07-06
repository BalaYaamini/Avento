const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { 
  submitFeedback, 
  getEventFeedbacks, 
  getUserFeedbackStatus,
  getMyFeedbackStatuses
} = require('../controllers/feedbackController');

// Submit feedback
router.post('/', authMiddleware, submitFeedback);

// Get my feedback statuses
router.get('/my-statuses', authMiddleware, getMyFeedbackStatuses);

// Get feedback analytics for an event
router.get('/event/:eventId', authMiddleware, getEventFeedbacks);

// Check if user submitted feedback
router.get('/event/:eventId/user/:userId/status', authMiddleware, getUserFeedbackStatus);

module.exports = router;
