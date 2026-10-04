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
const { auth, optionalAuth, studentAuth, adminAuth } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

router.get('/available', optionalAuth, apiLimiter, getAvailableDemoTests);
router.get('/admin', auth, adminAuth, apiLimiter, getDemoTests);
router.get('/student/results', auth, studentAuth, apiLimiter, getStudentDemoResults);
router.get('/:id/check-availability', optionalAuth, apiLimiter, checkDemoTestAvailability);
router.get('/:id/result', auth, studentAuth, apiLimiter, getStudentDemoTestResult);
router.get('/:id', optionalAuth, apiLimiter, getDemoTestById);

router.use(auth, apiLimiter);

router.post('/create', adminAuth, createDemoTest);
router.put('/:id', adminAuth, updateDemoTest);
router.delete('/delete/:id', adminAuth, deleteDemoTest);
router.patch('/:id/toggle-status', adminAuth, toggleDemoTestStatus);

router.post('/:id/submit', studentAuth, submitDemoTest);

module.exports = router;