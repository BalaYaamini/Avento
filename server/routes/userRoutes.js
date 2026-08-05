const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// Protected lookup routes for dropdowns
router.get('/faculty-coordinators', authMiddleware, userController.getFacultyCoordinators);
router.get('/students', authMiddleware, userController.getStudents);
router.get('/search', authMiddleware, userController.searchUsers);

// Admin-only route
router.get('/', authMiddleware, adminMiddleware, userController.getUsers);

router.post('/import', authMiddleware, adminMiddleware, userController.importUsers);
router.post('/profile/complete-first-login', authMiddleware, userController.completeFirstLogin);
router.put('/:id/reset-password', authMiddleware, adminMiddleware, userController.resetPassword);
router.put('/:id/deactivate', authMiddleware, adminMiddleware, userController.deactivateUser);
router.put('/:id/activate', authMiddleware, adminMiddleware, userController.activateUser);
router.put('/:id', authMiddleware, adminMiddleware, userController.updateUserDetails);
router.delete('/:id', authMiddleware, adminMiddleware, userController.deleteUser);

// Authenticated user: update display name only
router.put('/profile/name', authMiddleware, userController.updateDisplayName);

// Public route for contact form
router.post('/contact', userController.submitContactForm);

module.exports = router;
