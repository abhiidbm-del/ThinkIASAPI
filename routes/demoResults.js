const express = require('express');
const router = express.Router();
const { 
  getStudentDemoResults, 
  getStudentDemoTestResult, 
  getDemoResultById, 
  getStudentDemoResultsByAdmin, 
  getStudentDemoTestResultByAdmin 
} = require('../controllers/demoResultController');
const { auth, studentAuth, adminAuth } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

router.use(auth, apiLimiter);

// Student routes
router.get('/student', studentAuth, getStudentDemoResults);
router.get('/student/test/:testId', studentAuth, getStudentDemoTestResult);
router.get('/:id', getDemoResultById);

// Admin routes
router.get('/student/admin/:studentId', adminAuth, getStudentDemoResultsByAdmin);
router.get('/admin/test/:testId/student/:studentId', adminAuth, getStudentDemoTestResultByAdmin);

module.exports = router;