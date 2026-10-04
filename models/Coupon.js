const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true
  },
  discountValue: {
    type: Number,
    required: true,
    min: 0,
  },
  // For special one-time use coupons (free or custom percentage)
  isOneTimePerUser: {
    type: Boolean,
    default: false
  },
  // Applicable plans (empty array means all plans)
  applicablePlans: [{
    type: String,
    trim: true
  }],
  // Usage limits
  maxUses: {
    type: Number,
    default: null // null = unlimited
  },
  usedCount: {
    type: Number,
    default: 0
  },
  perUserLimit: {
    type: Number,
    default: 1 // How many times a single user can use this coupon
  },
  // Validity period
  validFrom: {
    type: Date,
    default: Date.now
  },
  validUntil: {
    type: Date,
    required: true
  },
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  // Minimum purchase amount (in rupees)
  minPurchaseAmount: {
    type: Number,
    default: 0
  },
  // Maximum discount amount (for percentage coupons)
  maxDiscountAmount: {
    type: Number,
    default: null
  },
  // Created by admin
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Users who have used this coupon
  usedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    usedAt: {
      type: Date,
      default: Date.now
    },
    orderId: String,
    paymentId: String
  }]
}, {
  timestamps: true
});

// Index for faster lookups
couponSchema.index({ code: 1 });
couponSchema.index({ isActive: 1, validFrom: 1, validUntil: 1 });

// Method to generate random 12-digit alphanumeric coupon code
couponSchema.statics.generateRandomCode = function() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 12; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

module.exports = mongoose.model('Coupon', couponSchema);
