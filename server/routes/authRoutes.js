// server/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

// OTP flow — send OTP to the entered email
router.post('/send-otp', authController.sendOtp);

// Registration (Step 3 of wizard: sets full name + password, creates profile)
router.post('/register', authController.register);

// Email/password login
router.post('/login', authController.login);

// Generate a Supabase recovery link and deliver it through Brevo.
router.post('/send-password-reset', authController.sendPasswordReset);

// Get authenticated user profile (requires valid Bearer token)
router.get('/profile', authMiddleware, authController.getProfile);

// Sync password from Supabase to MongoDB (used by Forgot Password)
router.post('/sync-password', authController.syncPassword);

module.exports = router;
