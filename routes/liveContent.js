const express = require('express');
const router = express.Router();
const {
  createLiveContent,
  getAllLiveContent,
  toggleLiveContentStatus,
  deleteLiveContent,
  getActiveLiveContent
} = require('../controllers/liveContentController');
const { auth } = require('../middleware/auth');

// Public route - Get active live content
router.get('/public', getActiveLiveContent);

// Admin routes (require auth)
router.use(auth);
router.post('/', createLiveContent);
router.get('/', getAllLiveContent);
router.patch('/:id/toggle-status', toggleLiveContentStatus);
router.delete('/:id', deleteLiveContent);

module.exports = router;