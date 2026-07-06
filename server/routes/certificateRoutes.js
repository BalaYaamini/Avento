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
  saveTemplateConfig
} = require('../controllers/certificateController');
const authMiddleware = require('../middleware/authMiddleware');

// Ensure directories exist
const uploadDir = path.join(__dirname, '../uploads/templates');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Set up multer for template uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'template-' + uniqueSuffix + path.extname(file.originalname));
  }
});

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

// Upload template (Faculty or Student Organizer)
router.post('/template/:eventId', authMiddleware, upload.single('template'), uploadTemplate);

// Get template config
router.get('/config/:eventId', authMiddleware, getTemplateConfig);

// Save template config
router.put('/config/:eventId', authMiddleware, saveTemplateConfig);

// Generate for all eligible participants
router.post('/generate/:eventId/all', authMiddleware, generateAllCertificates);

// Generate TEST certificate for preview (no DB insert)
router.post('/generate/:eventId/test', authMiddleware, generateTestCertificate);

// Generate for a single participant
router.post('/generate/:eventId/:userId', authMiddleware, generateSingleCertificate);

// Get my certificates (Student)
router.get('/my-certificates', authMiddleware, getMyCertificates);

// Public verification
router.get('/verify/:certificateId', verifyCertificate);

module.exports = router;
