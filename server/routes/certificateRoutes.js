const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const {
  uploadTemplate,
  generateAllCertificates,
  generateSingleCertificate,
  generateTestCertificate,
  getMyCertificates,
  verifyCertificate,
  getTemplateConfig,
  saveTemplateConfig,
  getEligibleOrganizers,
  generateAllOrganizerCertificates,
  generateSingleOrganizerCertificate
} = require('../controllers/certificateController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// Ensure directories exist
const uploadDir = path.join(__dirname, '../uploads/templates');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Set up multer for template uploads
const storage = multer.memoryStorage();


const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PNG, JPG, and PDF are allowed.'));
    }
  }
});

// Upload template (Admin Only)
router.post('/template/:eventId', authMiddleware, adminMiddleware, upload.single('template'), uploadTemplate);

// Get template config (Admin Only)
router.get('/config/:eventId', authMiddleware, adminMiddleware, getTemplateConfig);

// Save template config (Admin Only)
router.put('/config/:eventId', authMiddleware, adminMiddleware, saveTemplateConfig);

// Generate for all eligible participants (Admin Only)
router.post('/generate/:eventId/all', authMiddleware, adminMiddleware, generateAllCertificates);

// Generate TEST certificate for preview (no DB insert) (Admin Only)
router.post('/generate/:eventId/test', authMiddleware, adminMiddleware, generateTestCertificate);

// Generate for a single participant (Admin Only)
router.post('/generate/:eventId/:userId', authMiddleware, adminMiddleware, generateSingleCertificate);

// Get eligible event organizers (Admin Only)
router.get('/organizers/:eventId', authMiddleware, adminMiddleware, getEligibleOrganizers);

// Generate for all event organizers (Admin Only)
router.post('/generate-organizers/:eventId/all', authMiddleware, adminMiddleware, generateAllOrganizerCertificates);

// Generate for a single event organizer (Admin Only)
router.post('/generate-organizers/:eventId/:userId', authMiddleware, adminMiddleware, generateSingleOrganizerCertificate);

// Get my certificates (Student)
router.get('/my-certificates', authMiddleware, getMyCertificates);

// Public verification
router.get('/verify/:certificateId', verifyCertificate);

module.exports = router;
