const express = require('express');
const router = express.Router();
const {
  createMentorshipProgram,
  getAllMentorshipProgramsAdmin,
  getActiveMentorshipPrograms,
  getMentorshipProgramById,
  updateMentorshipProgram,
  deleteMentorshipProgram,
  toggleProgramStatus
} = require('../controllers/mentorshipController');
const { auth, adminAuth } = require('../middleware/auth');

// Public routes
router.get('/', getActiveMentorshipPrograms);
router.get('/admin/all', auth, adminAuth, getAllMentorshipProgramsAdmin);
router.post('/', auth, adminAuth, createMentorshipProgram);
router.put('/:id', auth, adminAuth, updateMentorshipProgram);
router.delete('/:id', auth, adminAuth, deleteMentorshipProgram);
router.patch('/:id/toggle-status', auth, adminAuth, toggleProgramStatus);
router.get('/:id', getMentorshipProgramById);

module.exports = router;
