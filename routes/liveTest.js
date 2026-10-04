// routes/liveTest.js
const express = require('express');
const router = express.Router();
const liveTestController = require('../controllers/liveTestController');
const { auth, adminAuth } = require('../middleware/auth');
const { uploadAnswerSheet } = require('../config/r2');
const requireMains = (req, res, next) => {
  if (req.user.role === 'admin' || ['mains', 'combo'].includes(req.user.type)) return next();
  return res.status(403).json({ success: false, message: 'An active Mains plan is required.', messageHindi: 'सक्रिय मेन्स प्लान आवश्यक है।' });
};

// ============================================
// ADMIN ROUTES
// ============================================

// Create a new live test
router.post('/', auth, adminAuth, liveTestController.createLiveTest);

// Get all live tests (admin)
router.get('/admin', auth, adminAuth, liveTestController.getAllLiveTests);
router.get('/admin/submissions', auth, adminAuth, liveTestController.getSubmissions);
router.get('/submissions/:submissionId/file', auth, require('../controllers/submissionFileController').getSubmissionFile);
router.get('/:id/submissions', auth, adminAuth, liveTestController.getSubmissions);

router.get('/student/all', auth, requireMains, liveTestController.getAvailableTests);
router.get('/student/available', auth, requireMains, liveTestController.getCurrentlyAvailableTests);
router.get('/student/upcoming', auth, requireMains, liveTestController.getUpcomingTests);
router.get('/student/my-participations', auth, liveTestController.getMyParticipations);
router.post('/:id/reopen', auth, adminAuth, liveTestController.reopenLiveTest);
router.post('/:id/submit', auth, requireMains, uploadAnswerSheet, liveTestController.submitLiveTestAnswer);

// Get single live test
router.get('/:id', auth, adminAuth, liveTestController.getLiveTestById);

// Update live test
router.put('/:id', auth, adminAuth, liveTestController.updateLiveTest);

// Toggle live test status
router.patch('/:id/toggle-status', auth, adminAuth, liveTestController.toggleLiveTestStatus);

// Delete live test
router.delete('/:id', auth, adminAuth, liveTestController.deleteLiveTest);

// ============================================
// STUDENT ROUTES
// ============================================

module.exports = router;
