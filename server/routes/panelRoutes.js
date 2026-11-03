const express = require('express');
const router = express.Router();
const panelController = require('../controllers/panelController');
const authMiddleware = require('../middleware/authMiddleware');

// Organizer / Admin: Full overview with panels, members and assigned students
router.get('/event/:eventId/overview', authMiddleware, panelController.getPanelsOverview);

// Organizer / Admin: Candidate panel members (faculty + event organizers)
router.get('/event/:eventId/members', authMiddleware, panelController.getPanelMemberCandidates);

// Any authenticated user: own panel membership for this event (workspace gating)
router.get('/event/:eventId/my-membership', authMiddleware, panelController.getMyPanelMembership);

// Organizer / Admin: Create a panel
router.post('/event/:eventId', authMiddleware, panelController.createPanel);

// Organizer / Admin: Update a panel
router.put('/event/:eventId/panel/:panelId', authMiddleware, panelController.updatePanel);

// Organizer / Admin: Delete a panel
router.delete('/event/:eventId/panel/:panelId', authMiddleware, panelController.deletePanel);

// Organizer / Admin: Batch assign / move / unassign students to panels
router.post('/event/:eventId/assign', authMiddleware, panelController.assignStudents);

// Organizer / Admin: Auto-distribute students evenly across panels
router.post('/event/:eventId/auto-distribute', authMiddleware, panelController.autoDistribute);

// Organizer / Admin: Unassign every student from their panels
router.delete('/event/:eventId/assignments', authMiddleware, panelController.unassignAllStudents);

module.exports = router;
