const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Event Task endpoints
router.get('/event/:eventId', authMiddleware, taskController.getEventTasks);
router.post('/event/:eventId', authMiddleware, taskController.createTask);

// Task endpoints
router.put('/:taskId', authMiddleware, taskController.updateTask);
router.delete('/:taskId', authMiddleware, taskController.deleteTask);

// Task Comment endpoints
router.get('/:taskId/comments', authMiddleware, taskController.getTaskComments);
router.post('/:taskId/comments', authMiddleware, taskController.addTaskComment);

module.exports = router;
