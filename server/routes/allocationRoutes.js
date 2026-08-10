const express = require('express');
const router = express.Router();
const allocationController = require('../controllers/allocationController');
const authMiddleware = require('../middleware/authMiddleware');

// Organizer routes
router.get('/event/:eventId', authMiddleware, allocationController.getEventAllocations);
router.get('/event/:eventId/template', authMiddleware, allocationController.getAllocationTemplateData);
router.post('/event/:eventId', authMiddleware, allocationController.saveTeamAllocations);

// Participant route
router.get('/event/:eventId/my-allocation', authMiddleware, allocationController.getMyTeamAllocation);

module.exports = router;
