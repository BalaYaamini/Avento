const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// Protected lookup routes for dropdowns
router.get('/faculty-coordinators', authMiddleware, userController.getFacultyCoordinators);
router.get('/students', authMiddleware, userController.getStudents);

// Admin-only route
router.get('/', authMiddleware, adminMiddleware, userController.getUsers);

// Authenticated user: update display name only
router.put('/profile/name', authMiddleware, userController.updateDisplayName);

// Public route for contact form
router.post('/contact', userController.submitContactForm);

module.exports = router;
