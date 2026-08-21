const express = require('express');
const router = express.Router();
const multer = require('multer');
const allocationController = require('../controllers/allocationController');
const authMiddleware = require('../middleware/authMiddleware');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed for Problem Statement document.'));
    }
  }
});

// Organizer routes
router.get('/event/:eventId', authMiddleware, allocationController.getEventAllocations);
router.get('/event/:eventId/template', authMiddleware, allocationController.getAllocationTemplateData);
router.post('/event/:eventId', authMiddleware, allocationController.saveTeamAllocations);
router.get('/event/:eventId/problem-statements', authMiddleware, allocationController.getProblemStatements);
router.post('/event/:eventId/problem-statements', authMiddleware, allocationController.saveProblemStatements);
router.delete('/event/:eventId/target/:targetId', authMiddleware, allocationController.deleteAllocation);

const uploadPdfMiddleware = (req, res, next) => {
  upload.single('pdf')(req, res, (err) => {
    if (err) {
      console.error('Multer upload error:', err.message);
      return res.status(400).json({ message: err.message || 'Only PDF files are allowed for Problem Statement document.' });
    }
    next();
  });
};

// Problem Statement PDF routes
router.get('/event/:eventId/problem-statement-pdf', authMiddleware, allocationController.getProblemStatementPdf);
router.post('/event/:eventId/problem-statement-pdf', authMiddleware, uploadPdfMiddleware, allocationController.uploadProblemStatementPdf);

// Participant routes
router.get('/event/:eventId/my-allocation', authMiddleware, allocationController.getMyTeamAllocation);
router.post('/event/:eventId/select-problem-statement', authMiddleware, allocationController.selectProblemStatement);

module.exports = router;

