const express = require('express');
const router = express.Router();
const {
  createAnnouncement,
  getAllAnnouncements,
  getActiveAnnouncements,
  getAnnouncementById,
  updateAnnouncement,
  deleteAnnouncement,
  toggleAnnouncementStatus
} = require('../controllers/announcementController');

const { auth, adminAuth } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

// Public routes (no auth required)
router.get('/public/active', getActiveAnnouncements);
router.get('/public/:id', getAnnouncementById);

// Admin routes (protected)
router.use(auth, adminAuth, apiLimiter);

router.post('/', createAnnouncement);
router.get('/', getAllAnnouncements);
router.get('/:id', getAnnouncementById);
router.put('/:id', updateAnnouncement);
router.delete('/:id', deleteAnnouncement);
router.patch('/:id/toggle-status', toggleAnnouncementStatus);

module.exports = router;