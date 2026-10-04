const express = require('express');
const router = express.Router();
const {
  sendMessage,
  getChatMessages,
  updateMessage,
  deleteMessage,
} = require('../controllers/chatController');
const { auth, studentAuth, adminAuth } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

router.use(auth, apiLimiter);

// Student and admin routes
router.post('/', sendMessage);
router.get('/:resultId', getChatMessages);
router.put('/:messageId', updateMessage);
router.delete('/:messageId', deleteMessage);

module.exports = router;