// controllers/paymentController.js
const Payment = require('../models/Payment');
const User = require('../models/User');
const Coupon = require('../models/Coupon');
const { handleError } = require('../middleware/errorHandler');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { validateEnrollment, applyPaymentAccess } = require('../utils/paymentEnrollment');
const { assertPlanNotOwned } = require('../utils/activePlanPurchases');

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const { calculateServerPrice } = require('../utils/planPricing');

/**
 * Create Razorpay order
 */
const createRazorpayOrder = async (req, res) => {
  try {
    const { planId, couponCode } = req.body;
    const pricing = await calculateServerPrice(planId, couponCode, req.user._id);
    await assertPlanNotOwned(req.user, pricing.plan.id);
    const enrollment = await validateEnrollment(req.body);
    if (pricing.amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Use the free-plan activation endpoint for a zero-value order'
      });
    }

    console.log('=== CREATING RAZORPAY ORDER ===');
    const amountInPaise = Math.round(pricing.amount * 100);

    // Create order in Razorpay
    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `receipt_${pricing.plan.id}_${Date.now()}`.slice(0, 40),
      notes: { planId: pricing.plan.id, userId: req.user._id.toString() },
      payment_capture: 1
    };

    const order = await razorpay.orders.create(options);
    
    console.log('✅ Order created in Razorpay:', order.id);

    // Store order in your database with pending status
    const payment = new Payment({
      user: req.user._id,
      plan: pricing.plan.id,
      accessType: pricing.plan.accessType || pricing.plan.id,
      ...enrollment,
      planName: pricing.plan.name,
      amount: pricing.amount,
      status: 'pending',
      paymentMethod: 'razorpay',
      razorpayOrderId: order.id,
      coupon: pricing.coupon ? {
        code: pricing.coupon.code,
        discountType: pricing.coupon.discountType,
        discountValue: pricing.coupon.discountValue,
        discountAmount: pricing.discountAmount
      } : null,
      paymentGatewayResponse: {
        order: order,
        timestamp: new Date().toISOString()
      }
    });

    await payment.save();
    console.log('✅ Payment record created in database:', payment._id);

    res.json({
      success: true,
      id: order.id,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt
    });

  } catch (error) {
    console.error('❌ Order creation failed:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.error?.description || error.message || 'Failed to create order'
    });
  }
};

/**
 * Verify Razorpay payment
 */
const verifyRazorpayPayment = async (req, res) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      planId
    } = req.body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Incomplete payment verification data' });
    }
    if (!process.env.RAZORPAY_KEY_SECRET) {
      return res.status(503).json({ success: false, message: 'Payment gateway is not configured' });
    }

    console.log('=== VERIFYING PAYMENT ===');
    console.log('Payment ID:', razorpay_payment_id);
    console.log('Order ID:', razorpay_order_id);

    // Generate signature for verification
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    // Verify signature
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const receivedBuffer = Buffer.from(String(razorpay_signature), 'utf8');
    if (expectedBuffer.length !== receivedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid signature'
      });
    }

    // Find the payment record
    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id, user: req.user._id });
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found'
      });
    }
    if (payment.status === 'completed') {
      // A previous verification may have saved the payment before plan activation failed.
      const user = await User.findById(req.user._id);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      applyPaymentAccess(user, payment);
      user.planActivatedAt = user.planActivatedAt || new Date();
      user.planExpiryAt = null;
      await user.save();
      return res.json({ success: true, message: 'Payment already verified', payment, user: {
        id: user._id, fullName: user.fullName, email: user.email, type: user.type
      } });
    }
    if (planId && planId !== payment.plan) return res.status(400).json({ success: false, message: 'Plan does not match the order' });

    // Update payment record
    payment.status = 'completed';
    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    payment.paymentGatewayResponse = {
      ...payment.paymentGatewayResponse,
      verification: {
        success: true,
        timestamp: new Date().toISOString()
      }
    };
    await payment.save();

    // Update coupon usage if applied
    if (payment.coupon?.code) {
      const coupon = await Coupon.findOne({ code: payment.coupon.code });
      if (coupon) {
        coupon.usedCount = (coupon.usedCount || 0) + 1;
        coupon.usedBy.push({
          user: req.user._id,
          usedAt: new Date(),
          orderId: payment._id.toString(),
          paymentId: razorpay_payment_id
        });
        await coupon.save();
      }
    }

    // Update user's plan
    const user = await User.findById(req.user._id);
    applyPaymentAccess(user, payment);
    user.planActivatedAt = new Date();
    user.planExpiryAt = null;
    await user.save();

    res.json({
      success: true,
      message: 'Payment verified successfully!',
      payment: {
        id: payment._id,
        transactionId: payment.transactionId,
        plan: payment.plan,
        planName: payment.planName,
        amount: payment.amount,
        status: payment.status
      },
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        type: user.type
      }
    });

  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Activate free plan
 */
const activateFreePlan = async (req, res) => {
  try {
    const { planId, couponCode } = req.body;
    const userId = req.user._id;

    console.log('=== ACTIVATING FREE PLAN ===');
    console.log('User:', userId);
    console.log('Plan:', planId);
    console.log('Coupon:', couponCode);

    // Validate required fields
    if (!planId) {
      return res.status(400).json({
        success: false,
        message: 'Plan ID is required'
      });
    }

    const pricing = await calculateServerPrice(planId, couponCode, userId);
    await assertPlanNotOwned(req.user, pricing.plan.id);
    const { coupon, plan } = pricing;
    const enrollment = await validateEnrollment(req.body);
    if (pricing.amount !== 0) {
      return res.status(400).json({
        success: false,
        message: 'This coupon is not a free coupon'
      });
    }

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Create payment record
    const payment = new Payment({
      user: userId,
      plan: planId,
      accessType: plan.accessType || plan.id,
      ...enrollment,
      planName: plan.name,
      amount: 0,
      status: 'completed',
      paymentMethod: 'free_coupon',
      coupon: coupon ? {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        isFree: true,
        discountAmount: plan.totalAmount
      } : null,
      paymentGatewayResponse: {
        success: true,
        status: 'free_activation',
        timestamp: new Date().toISOString()
      }
    });

    await payment.save();
    console.log('✅ Payment record created:', payment._id);

    // Update coupon usage
    if (coupon) {
    coupon.usedCount = (coupon.usedCount || 0) + 1;
    if (!coupon.usedBy) coupon.usedBy = [];
    coupon.usedBy.push({
      user: userId,
      usedAt: new Date(),
      orderId: payment._id.toString()
    });
    await coupon.save();
    }

    // Update user's plan
    applyPaymentAccess(user, payment);
    user.planActivatedAt = new Date();
    user.planExpiryAt = null;
    await user.save();

    res.json({
      success: true,
      message: 'Free plan activated successfully!',
      payment: {
        id: payment._id,
        transactionId: payment.transactionId,
        plan: payment.plan,
        planName: payment.planName,
        status: payment.status,
        isFree: true
      }
    });

  } catch (error) {
    console.error('Free plan activation error:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Process payment (for backward compatibility)
 */
const processPayment = async (req, res) => {
  try {
    const { 
      razorpay_payment_id, 
      razorpay_order_id, 
      razorpay_signature,
      planId,
      amount,
      couponCode,
      discountAmount 
    } = req.body;
    
    // Reuse verification logic
    req.body.razorpay_payment_id = razorpay_payment_id;
    req.body.razorpay_order_id = razorpay_order_id;
    req.body.razorpay_signature = razorpay_signature;
    
    return await verifyRazorpayPayment(req, res);
  } catch (error) {
    handleError(res, error, 'Payment processing failed');
  }
};

/**
 * Get payment history for user
 */
const getPaymentHistory = async (req, res) => {
  try {
    const payments = await Payment.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .select('plan planName amount status coupon createdAt razorpayPaymentId');

    res.json({
      success: true,
      payments,
      total: payments.length
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch payment history');
  }
};

/**
 * Get all payments (admin only)
 */
const getAllPayments = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const filter = {};
    if (status) filter.status = status;

    const payments = await Payment.find(filter)
      .populate('user', 'name email phone type')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Payment.countDocuments(filter);

    res.json({
      success: true,
      payments,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch payments');
  }
};

/**
 * Get single payment details
 */
const getPaymentDetails = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('user', 'name email phone type');

    if (!payment) {
      return res.status(404).json({ 
        success: false,
        message: 'Payment not found' 
      });
    }

    // Check authorization
    if (req.user.role !== 'admin' && payment.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied' 
      });
    }

    res.json({
      success: true,
      payment
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch payment details');
  }
};

module.exports = {
  processPayment,
  activateFreePlan,
  createRazorpayOrder,
  verifyRazorpayPayment,
  getPaymentHistory,
  getAllPayments,
  getPaymentDetails
};
