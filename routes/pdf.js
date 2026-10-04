const express = require('express');
const router = express.Router();
const pdfController = require('../controllers/pdfController');
const { auth, adminAuth } = require('../middleware/auth');



// Get question paper as base64
router.post('/question-paper-base64', auth, adminAuth, pdfController.getQuestionPaperBase64);

module.exports = router;