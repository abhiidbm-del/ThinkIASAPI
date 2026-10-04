const mongoose = require('mongoose');

const OTPSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  otp: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['registration', 'password_reset'],
    default: 'registration'
  },
  attempts: {
    type: Number,
    default: 0,
    max: 3
  },
  verified: {
    type: Boolean,
    default: false
  },
  expiresAt: {
    type: Date,
    required: true
  },
  userData: {
    fullName: String,
    phone: String,
    password: String,
    role: String
  }
}, {
  timestamps: true
});

// Index for automatic deletion of expired OTPs
OTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for better query performance
OTPSchema.index({ email: 1, type: 1, verified: 1, expiresAt: 1 });

module.exports = mongoose.model('OTP', OTPSchema);