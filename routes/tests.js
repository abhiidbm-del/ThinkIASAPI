const express = require('express');
const router = express.Router();
const { getTests, getTestById, submitTest, checkTestAvailability } = require('../controllers/testController');
const { auth, studentAuth } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

router.use(auth, apiLimiter);

router.get('/', getTests);
router.get('/:id', getTestById);
router.post('/:id/submit', studentAuth, submitTest);
router.get('/:id/availability', checkTestAvailability);

module.exports = router;