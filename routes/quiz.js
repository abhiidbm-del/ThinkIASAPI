const express = require('express');
const router = express.Router();
const { 
  getQuizzes, 
  getQuizById, 
  submitQuiz, 
  checkQuizAvailability,
  getQuizLeaderboard,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  toggleQuizActive,
  getQuizSubmissions
} = require('../controllers/quizController');
const { auth, studentAuth, adminAuth } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

// Apply rate limiting to all routes
// router.use(apiLimiter);

// Public routes (no auth required for users)
router.get('/admin', auth, adminAuth, getQuizzes);
router.get('/:id', getQuizById);
router.post('/:id/submit', submitQuiz); // No studentAuth - anyone can submit
router.get('/:id/availability', checkQuizAvailability);
router.get('/:id/leaderboard', getQuizLeaderboard);

// Admin routes (require auth middleware)
router.post('/create', auth, adminAuth, createQuiz);
router.put('/admin/:id', auth, adminAuth, updateQuiz);
router.delete('/delete/:id', auth, adminAuth, deleteQuiz);
router.patch('/admin/:id/toggle-active', auth, adminAuth, toggleQuizActive);
router.get('/admin/:id/submissions', auth, adminAuth, getQuizSubmissions);

// Backward compatibility for older clients
router.post('/', auth, adminAuth, createQuiz);
router.put('/:id', auth, adminAuth, updateQuiz);
router.delete('/:id', auth, adminAuth, deleteQuiz);
router.patch('/:id/toggle-active', auth, adminAuth, toggleQuizActive);
router.get('/:id/submissions', auth, adminAuth, getQuizSubmissions);

module.exports = router;