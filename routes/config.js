const express = require('express');
const router = express.Router();
const { getRazorpayConfig } = require('../controllers/configController');
const { auth } = require('../middleware/auth');

// Get Razorpay configuration (protected route)
router.get('/razorpay-config', auth, getRazorpayConfig);

module.exports = router;