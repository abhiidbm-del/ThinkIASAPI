const express = require('express');
const router = express.Router();
const { getStudentResults, getStudentTestResult, getResultById, getStudentResultsByAdmin, getStudentTestResultByAdmin } = require('../controllers/resultController');
const { auth, studentAuth, adminAuth } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

router.use(auth, apiLimiter);

router.get('/student', studentAuth, getStudentResults);
router.get('/student/test/:testId', studentAuth, getStudentTestResult);
router.get('/:id', getResultById);

router.get('/student/admin/:studentId', adminAuth, getStudentResultsByAdmin); // New route
router.get('/admin/test/:testId/student/:studentId', adminAuth, getStudentTestResultByAdmin); // New route for specific test result

module.exports = router;