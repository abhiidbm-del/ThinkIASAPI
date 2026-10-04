// models/Payment.js
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  plan: {
    type: String,
    required: true
  },
  accessType: { type: String, enum: ['pre', 'mains', 'combo'] },
  expiresAt: Date,
  appCheckout: {type:Boolean,default:false},
  idempotencyKey: String,
  programId: { type: mongoose.Schema.Types.ObjectId, ref: 'Program' },
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' },
  planName: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['razorpay', 'free_coupon'],
    required: true
  },
  transactionId: {
    type: String,
    unique: true,
    sparse: true
  },
  razorpayPaymentId: {
    type: String
  },
  razorpayOrderId: {
    type: String
  },
  razorpaySignature: {
    type: String
  },
  coupon: {
    code: String,
    discountType: String,
    discountValue: Number,
    discountAmount: Number,
    isFree: Boolean
  },
  paymentGatewayResponse: {
    type: Object
  }
}, {
  timestamps: true
});

// Generate transaction ID before saving
paymentSchema.index({user:1,idempotencyKey:1},{unique:true,partialFilterExpression:{idempotencyKey:{$type:'string'}}});
paymentSchema.pre('save', function(next) {
  if (!this.transactionId) {
    this.transactionId = `TXN${Date.now()}${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
  }
  next();
});

module.exports = mongoose.model('Payment', paymentSchema);
