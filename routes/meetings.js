const express = require('express');
const router = express.Router();
const {
  createMeeting,
  getAdminMeetings,
  getStudentMeetings, // Add this
  updateMeeting,
  deleteMeeting
} = require('../controllers/meetingController');
const { auth, adminAuth } = require('../middleware/auth');

// Admin routes
router.post('/', auth, adminAuth, createMeeting);
router.get('/admin', auth, adminAuth, getAdminMeetings);
router.put('/:id', auth, adminAuth, updateMeeting);
router.delete('/:id', auth, adminAuth, deleteMeeting);
router.get('/student', auth, getStudentMeetings); // Students need auth but not admin auth

module.exports = router;