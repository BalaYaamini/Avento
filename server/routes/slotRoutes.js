const express = require('express');
const router = express.Router();
const slotController = require('../controllers/slotController');
const authMiddleware = require('../middleware/authMiddleware');

// Public / Authenticated: Fetch available slots for an event
router.get('/event/:eventId', slotController.getEventSlots);

// Organizer / Admin: Full overview with participants per slot
router.get('/event/:eventId/overview', authMiddleware, slotController.getSlotsOverview);

// Organizer / Admin: Create single slot
router.post('/event/:eventId', authMiddleware, slotController.createSlot);

// Organizer / Admin: Bulk create slots
router.post('/event/:eventId/bulk', authMiddleware, slotController.bulkCreateSlots);

// Organizer / Admin: Update a slot
router.put('/event/:eventId/slot/:slotId', authMiddleware, slotController.updateSlot);

// Organizer / Admin: Delete a slot
router.delete('/event/:eventId/slot/:slotId', authMiddleware, slotController.deleteSlot);

// Organizer / Admin: Delete all slots for an event
router.delete('/event/:eventId/all', authMiddleware, slotController.deleteAllSlots);

// Organizer / Admin: Reassign participant/team to a different slot
router.put('/event/:eventId/reassign', authMiddleware, slotController.reassignParticipantSlot);

// Student: Reschedule own slot
router.put('/reschedule/:regId', authMiddleware, slotController.rescheduleStudentSlot);

module.exports = router;
