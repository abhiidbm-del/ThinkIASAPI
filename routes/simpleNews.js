const express = require('express');
const router = express.Router();
const {
  createNews,
  getAllNews,
  toggleNewsStatus,
  deleteNews,
  getActiveNews
} = require('../controllers/simpleNewsController');
const { auth } = require('../middleware/auth');

// Public route - Get active news
router.get('/public', getActiveNews);

// Admin routes (require auth)
router.use(auth);
router.post('/', createNews);
router.get('/', getAllNews);
router.patch('/:id/toggle-status', toggleNewsStatus);
router.delete('/:id', deleteNews);

module.exports = router;