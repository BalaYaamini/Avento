const express = require('express');
const router = express.Router();
const allocationController = require('../controllers/allocationController');
const authMiddleware = require('../middleware/authMiddleware');

// Organizer routes
router.get('/event/:eventId', authMiddleware, allocationController.getEventAllocations);
router.get('/event/:eventId/template', authMiddleware, allocationController.getAllocationTemplateData);
router.post('/event/:eventId', authMiddleware, allocationController.saveTeamAllocations);
router.get('/event/:eventId/problem-statements', authMiddleware, allocationController.getProblemStatements);
router.post('/event/:eventId/problem-statements', authMiddleware, allocationController.saveProblemStatements);

// Participant routes
router.get('/event/:eventId/my-allocation', authMiddleware, allocationController.getMyTeamAllocation);
router.post('/event/:eventId/select-problem-statement', authMiddleware, allocationController.selectProblemStatement);

module.exports = router;
