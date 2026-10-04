const express = require('express');
const router = express.Router();
const { 
  createDemoTest,
  getDemoTests,
  updateDemoTest,
  deleteDemoTest,
  toggleDemoTestStatus,
  getAvailableDemoTests,
  getDemoTestById,
  submitDemoTest,
  checkDemoTestAvailability,
  getStudentDemoTestResult,
  getStudentDemoResults
} = require('../controllers/demoTestController');
const { auth, studentAuth, adminAuth } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

// Apply authentication and rate limiting to all routes
router.use(auth, apiLimiter);

// Admin routes
router.post('/create', adminAuth, createDemoTest);
router.get('/admin', adminAuth, getDemoTests);
router.put('/:id', adminAuth, updateDemoTest);
router.delete('/delete/:id', adminAuth, deleteDemoTest);
router.patch('/:id/toggle-status', adminAuth, toggleDemoTestStatus);

// Student routes
router.get('/available', getAvailableDemoTests);
router.get('/:id', getDemoTestById);
router.post('/:id/submit', studentAuth, submitDemoTest);
router.get('/:id/check-availability', checkDemoTestAvailability);
router.get('/:id/result', studentAuth, getStudentDemoTestResult);
router.get('/student/results', studentAuth, getStudentDemoResults);

module.exports = router;