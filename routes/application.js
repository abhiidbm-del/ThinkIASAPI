const express = require('express');
const router = express.Router();
const {
  submitApplication,
  getApplicationsByJob,
  getAllApplications,
  getApplicationById,
  updateApplicationStatus,
  downloadResume,
  watchDemoVideo
} = require('../controllers/applicationController');
const { upload } = require('../middleware/upload');
const { auth: protect, adminAuth: admin } = require('../middleware/auth');

// Public routes
router.post('/jobs/:jobId/apply', upload.single('resume'), submitApplication);

// Admin routes
router.get('/admin/applications', protect, admin, getAllApplications);
router.get('/admin/applications/:applicationId', protect, admin, getApplicationById);
router.get('/admin/jobs/:jobId/applications', protect, admin, getApplicationsByJob);
router.patch('/admin/applications/:applicationId/status', protect, admin, updateApplicationStatus);
router.get('/admin/applications/:applicationId/resume', protect, admin, downloadResume);
router.get('/admin/applications/:applicationId/video', protect, admin, watchDemoVideo);

module.exports = router;
