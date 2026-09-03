const express = require('express');
const router = express.Router();
const multer = require('multer');
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Configure multer for profile photo uploads (memory storage for Supabase)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
});

// Restricted lookup routes (admin + organizers only, blocks regular students)
const organizerRoles = ['admin', 'faculty', 'faculty_organizer', 'student_organizer'];
router.get('/faculty-coordinators', authMiddleware, roleMiddleware(organizerRoles), userController.getFacultyCoordinators);
router.get('/students', authMiddleware, roleMiddleware(organizerRoles), userController.getStudents);
router.get('/search', authMiddleware, roleMiddleware(organizerRoles), userController.searchUsers);

// Admin-only route
router.get('/', authMiddleware, adminMiddleware, userController.getUsers);

router.post('/import', authMiddleware, adminMiddleware, userController.importUsers);
router.post('/bulk-delete', authMiddleware, adminMiddleware, userController.bulkDeleteUsers);
router.post('/profile/complete-first-login', authMiddleware, userController.completeFirstLogin);
router.put('/:id/reset-password', authMiddleware, adminMiddleware, userController.resetPassword);
router.put('/:id/deactivate', authMiddleware, adminMiddleware, userController.deactivateUser);
router.put('/:id/activate', authMiddleware, adminMiddleware, userController.activateUser);
router.put('/:id', authMiddleware, adminMiddleware, userController.updateUserDetails);
router.delete('/:id', authMiddleware, adminMiddleware, userController.deleteUser);

// Authenticated user: update profile details (name, phone, gender, degree, year, college, roll number)
router.put('/profile/details', authMiddleware, userController.updateProfileDetails);

// Authenticated user: upload profile photo
router.put('/profile/photo', authMiddleware, upload.single('photo'), userController.uploadProfilePhoto);

// Authenticated user: full profile update (photo, phone, college, gender)
router.put('/profile/full', authMiddleware, userController.updateFullProfile);
router.get('/profile/full', authMiddleware, userController.getFullProfile);

// Public route for contact form
router.post('/contact', userController.submitContactForm);

module.exports = router;
