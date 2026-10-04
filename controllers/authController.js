const jwt = require('jsonwebtoken');
const { JWT } = require('../config/constants');
const User = require('../models/User');
const OTP = require('../models/OTP'); // Make sure this line exists
const { generateToken, getMenuItems } = require('../utils/helpers');
const { findLoginUser } = require('../utils/loginAccount');
const { handleError } = require('../middleware/errorHandler');
const messages = require('../utils/messages');
const emailService = require('../services/emailService'); // Make sure this line exists


const sendPasswordResetOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: messages.en.emailRequired 
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (!existingUser) {
      return res.status(404).json({ 
        success: false, 
        message: 'No account found with this email' 
      });
    }

    // Check if OTP already exists and is still valid
    const existingOTP = await OTP.findOne({ 
      email, 
      type: 'password_reset',
      verified: false,
      expiresAt: { $gt: new Date() }
    });

    let otp;
    let expiresAt;

    if (existingOTP) {
      // Use existing OTP
      otp = existingOTP.otp;
      expiresAt = existingOTP.expiresAt;
      console.log('Using existing password reset OTP for email:', email);
    } else {
      // Generate new OTP
      otp = emailService.generateOTP();
      expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      console.log('Generated new password reset OTP for email:', email);

      // Delete any previous password reset OTPs for this email
      await OTP.deleteMany({ email, type: 'password_reset' });

      // Create new OTP record
      const otpRecord = new OTP({
        email,
        otp,
        expiresAt,
        type: 'password_reset'
      });

      await otpRecord.save();
      console.log('Password reset OTP record saved for email:', email);
    }

    // Send OTP email
    console.log('Attempting to send password reset OTP email to:', email);
    const emailResult = await emailService.sendPasswordResetOTP(email, otp, existingUser.fullName);
    console.log('Password reset email sent successfully:', emailResult);

    res.json({
      success: true,
      message: 'Password reset OTP sent successfully',
      expiresAt
    });

  } catch (error) {
    console.error('Error in sendPasswordResetOTP:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Verify Password Reset OTP
 */
const verifyPasswordResetOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and OTP are required' 
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (!existingUser) {
      return res.status(404).json({ 
        success: false, 
        message: 'No account found with this email' 
      });
    }

    // Find OTP record
    const otpRecord = await OTP.findOne({ 
      email, 
      otp,
      type: 'password_reset',
      verified: false,
      expiresAt: { $gt: new Date() }
    });

    if (!otpRecord) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired OTP' 
      });
    }

    // Check attempts
    if (otpRecord.attempts >= 3) {
      return res.status(400).json({ 
        success: false, 
        message: 'Maximum OTP attempts exceeded' 
      });
    }

    // Increment attempts
    otpRecord.attempts += 1;

    // Verify OTP
    if (otpRecord.otp === otp) {
      otpRecord.verified = true;
      await otpRecord.save();

      // Generate a temporary reset token (optional, for enhanced security)
      const resetToken = generateToken(otpRecord._id, '1h');

      return res.json({
        success: true,
        message: 'OTP verified successfully',
        resetToken
      });
    } else {
      await otpRecord.save();
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid OTP',
        attempts: otpRecord.attempts,
        remainingAttempts: 3 - otpRecord.attempts
      });
    }

  } catch (error) {
    console.error('Error verifying password reset OTP:', error);
    res.status(500).json({ 
      success: false, 
      message: messages.en.serverError,
      error: error.message 
    });
  }
};

/**
 * Reset Password with OTP Verification
 */
const resetPassword = async (req, res) => {
  try {
    const { 
      email, 
      otp, 
      newPassword, 
      confirmPassword 
    } = req.body;

    // Validation
    if (!email || !otp || !newPassword || !confirmPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields are required' 
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Passwords do not match' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password must be at least 6 characters long' 
      });
    }

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'No account found with this email' 
      });
    }

    // Check if OTP is verified
    const verifiedOTP = await OTP.findOne({ 
      email, 
      otp,
      type: 'password_reset',
      verified: true,
      expiresAt: { $gt: new Date() }
    });

    if (!verifiedOTP) {
      return res.status(400).json({ 
        success: false, 
        message: 'OTP verification required or OTP has expired' 
      });
    }

    // Update user password
    user.password = newPassword;
    await user.save();

    // Delete OTP record after successful password reset
    await OTP.deleteOne({ _id: verifiedOTP._id });

    // Send password reset success email
    emailService.sendPasswordResetSuccessEmail(email, user.fullName).catch(console.error);

    res.json({
      success: true,
      message: 'Password reset successful. You can now login with your new password.'
    });

  } catch (error) {
    console.error('Error in resetPassword:', error);
    
    // Handle specific errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        success: false, 
        message: messages.join(', ') 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message 
    });
  }
};


const sendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: messages.en.emailRequired });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: messages.en.userExists });
    }

    // Check if OTP already exists and is still valid
    const existingOTP = await OTP.findOne({ 
      email, 
      verified: false,
      expiresAt: { $gt: new Date() }
    });

    if (existingOTP) {
      // Resend OTP
      await emailService.sendOTPEmail(email, existingOTP.otp);
      
      return res.json({
        success: true,
        message: 'OTP resent successfully',
        expiresAt: existingOTP.expiresAt
      });
    }

    // Generate new OTP
    const otp = emailService.generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete any previous OTPs for this email
    await OTP.deleteMany({ email });

    // Create new OTP record
    const otpRecord = new OTP({
      email,
      otp,
      expiresAt,
      type: 'registration'
    });

    await otpRecord.save();

    // Send OTP email
    await emailService.sendOTPEmail(email, otp);

    res.json({
      success: true,
      message: 'OTP sent successfully',
      expiresAt
    });

  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ 
      success: false, 
      message: messages.en.serverError,
      error: error.message 
    });
  }
};

/**
 * Verify OTP
 */
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and OTP are required' 
      });
    }

    // Find OTP record
    const otpRecord = await OTP.findOne({ 
      email, 
      otp,
      verified: false,
      expiresAt: { $gt: new Date() }
    });

    if (!otpRecord) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired OTP' 
      });
    }

    // Check attempts
    if (otpRecord.attempts >= 3) {
      return res.status(400).json({ 
        success: false, 
        message: 'Maximum OTP attempts exceeded' 
      });
    }

    // Increment attempts
    otpRecord.attempts += 1;

    // Verify OTP
    if (otpRecord.otp === otp) {
      otpRecord.verified = true;
      await otpRecord.save();

      return res.json({
        success: true,
        message: 'OTP verified successfully'
      });
    } else {
      await otpRecord.save();
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid OTP',
        attempts: otpRecord.attempts,
        remainingAttempts: 3 - otpRecord.attempts
      });
    }

  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ 
      success: false, 
      message: messages.en.serverError,
      error: error.message 
    });
  }
};

/**
 * Register with OTP verification
 */
const register = async (req, res) => {
  try {
    const { 
      fullName, 
      email, 
      phone, 
      password, 
      confirmPassword, 
      role = 'student',
      otp 
    } = req.body;

    // Validation
    if (password !== confirmPassword) {
      return res.status(400).json({ message: messages.en.passwordsNotMatch });
    }

    // Check if OTP is verified
    const verifiedOTP = await OTP.findOne({ 
      email, 
      verified: true,
      expiresAt: { $gt: new Date() }
    });

    if (!verifiedOTP || verifiedOTP.otp !== otp) {
      return res.status(400).json({ 
        message: 'OTP verification required. Please verify your email first.' 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: messages.en.userExists });
    }

    // Create user
    const userData = {
      fullName,
      email,
      phone,
      password,
      role,
      emailVerified: true
    };

    // Only add type field for students
    if (role === 'student') {
      userData.type = 'fresh';
    }

    const user = new User(userData);
    await user.save();

    // Generate token
    const token = generateToken(user._id);
    const menuItems = getMenuItems(user);

    // Delete OTP record after successful registration
    await OTP.deleteOne({ _id: verifiedOTP._id });

    // Send welcome email (async, don't wait for it)
    emailService.sendWelcomeEmail(email, fullName).catch(console.error);

    res.status(201).json({
      message: messages.en.registerSuccess,
      token,
      user: user.toJSON(),
      menuItems
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle specific errors
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: 'User with this email or phone already exists' 
      });
    }
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        message: messages.join(', ') 
      });
    }
    
    res.status(500).json({ 
      message: messages.en.serverError,
      error: error.message 
    });
  }
};


const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await findLoginUser(email);
    if (!user) {
      return res.status(400).json({ message: messages.en.invalidCredentials });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: messages.en.invalidCredentials });
    }

    if (user.isActive === false) return res.status(403).json(require('../utils/accountStatus').inactiveAccount);

    const token = generateToken(user._id);
    const menuItems = getMenuItems(user);

    res.json({
      message: messages.en.loginSuccess,
      token,
      user: user.toJSON(), // This will automatically remove type for admin
      menuItems
    });
  } catch (error) {
    handleError(res, error, messages.en.serverError);
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const menuItems = getMenuItems(req.user);
    res.json({
      user: req.user.toJSON(), // This will automatically remove type for admin
      menuItems
    });
  } catch (error) {
    handleError(res, error, messages.en.serverError);
  }
};

module.exports = {
  sendOTP,
  verifyOTP,
  register,
  login,
  getCurrentUser,
  sendPasswordResetOTP,
  verifyPasswordResetOTP,
  resetPassword
};
