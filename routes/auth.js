const express = require('express');
const router = express.Router();
const { 
  sendOTP, 
  verifyOTP, 
  sendPasswordResetOTP,
  verifyPasswordResetOTP,
  resetPassword,
  register, 
  login, 
  getCurrentUser 
} = require('../controllers/authController');
const { auth } = require('../middleware/auth');
const { 
  sendOTPValidation, 
  verifyOTPValidation,
  sendPasswordResetOTPValidation,
  verifyPasswordResetOTPValidation,
  resetPasswordValidation,
  registerValidation, 
  loginValidation, 
  handleValidationErrors 
} = require('../middleware/validation');
const { authLimiter } = require('../middleware/rateLimiter');

// OTP routes for registration
router.post('/send-otp', authLimiter, sendOTPValidation, handleValidationErrors, sendOTP);
router.post('/verify-otp', authLimiter, verifyOTPValidation, handleValidationErrors, verifyOTP);

// Password reset routes
router.post('/forgot-password', authLimiter, sendPasswordResetOTPValidation, handleValidationErrors, sendPasswordResetOTP);
router.post('/verify-reset-otp', authLimiter, verifyPasswordResetOTPValidation, handleValidationErrors, verifyPasswordResetOTP);
router.post('/reset-password', authLimiter, resetPasswordValidation, handleValidationErrors, resetPassword);

// Registration with OTP
router.post('/register', authLimiter, registerValidation, handleValidationErrors, register);

// Existing routes
router.post('/login', authLimiter, loginValidation, handleValidationErrors, login);
router.get('/me', auth, getCurrentUser);

module.exports = router;