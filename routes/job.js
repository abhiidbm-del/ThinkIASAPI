const express = require('express');
const router = express.Router();
const {
  createJob,
  getActiveJobs,
  getJobById,
  updateJob,
  toggleVideoRequirement,
  toggleJobStatus,
  deleteJob,
  getAllJobsAdmin
} = require('../controllers/jobController');
const { auth: protect, adminAuth: admin } = require('../middleware/auth');

// Public routes
router.get('/', getActiveJobs);
router.get('/:id', getJobById);

// Admin routes (using your auth middleware)
router.post('/', protect, admin, createJob);
router.get('/admin/all', protect, admin, getAllJobsAdmin);
router.put('/:id', protect, admin, updateJob);
router.patch('/:id/require-video', protect, admin, toggleVideoRequirement);
router.patch('/:id/toggle', protect, admin, toggleJobStatus);
router.delete('/:id', protect, admin, deleteJob);

module.exports = router;
