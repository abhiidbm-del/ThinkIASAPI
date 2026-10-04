const express = require('express');
const router = express.Router();
const { auth, adminAuth } = require('../middleware/auth');
const {
  validateCoupon,
  createCoupon,
  updateCoupon,
  getAllCoupons,
  getCouponById,
  deleteCoupon
} = require('../controllers/couponController');

// Public route for coupon validation
router.post('/validate', auth, validateCoupon);

// Admin routes
router.post('/create', auth, adminAuth, createCoupon);
router.put('/:id', auth, adminAuth, updateCoupon);
router.get('/admin/all', auth, adminAuth, getAllCoupons);
router.get('/:id', auth, adminAuth, getCouponById);
router.delete('/:id', auth, adminAuth, deleteCoupon);


module.exports = router;
