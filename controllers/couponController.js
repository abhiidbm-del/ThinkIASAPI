const Coupon = require('../models/Coupon');
const { handleError } = require('../middleware/errorHandler');

// Validate and apply coupon
const validateCoupon = async (req, res) => {
  try {
    if (!req.body.code) return res.status(400).json({success:false,message:'Coupon code is required.'});
    const {coupon,discountAmount}=await require('../utils/planPricing').calculateServerPrice(req.body.planId,req.body.code,req.user._id);
    res.json({success:true,coupon:{code:coupon.code,discountType:coupon.discountType,discountValue:coupon.discountValue,description:coupon.description,isOneTimePerUser:coupon.isOneTimePerUser,discountAmount}});
  } catch(error) {res.status(error.status||400).json({success:false,message:error.message});}
};

// Admin: Create new coupon
const createCoupon = async (req, res) => {
  try {
    let couponData = req.body;
    
    // Generate random code if not provided (for quick generation)
    if (!couponData.code) {
      couponData.code = Coupon.generateRandomCode();
    }

    // Handle one-time per user coupons (free or custom percentage)
    if (couponData.isOneTimePerUser) {
      // Force perUserLimit to 1 for one-time coupons
      couponData.perUserLimit = 1;
      
      // If discountValue is 100, it's effectively a free coupon
      // No additional validation needed as it's already handled by the schema
    }

    const coupon = new Coupon({
      ...couponData,
      code: couponData.code.toUpperCase(),
      createdBy: req.user._id
    });

    await coupon.save();

    res.status(201).json({
      success: true,
      message: 'Coupon created successfully',
      coupon
    });
  } catch (error) {
    handleError(res, error, 'Failed to create coupon');
  }
};

// Admin: Update coupon
const updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Don't allow updating isOneTimePerUser after creation
    delete updates.isOneTimePerUser;

    const coupon = await Coupon.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    );

    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    res.json({
      success: true,
      message: 'Coupon updated successfully',
      coupon
    });
  } catch (error) {
    handleError(res, error, 'Failed to update coupon');
  }
};

// Admin: Get all coupons
const getAllCoupons = async (req, res) => {
  try {
    const { page = 1, limit = 10, isActive } = req.query;
    
    const filter = {};
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const coupons = await Coupon.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Coupon.countDocuments(filter);

    res.json({
      coupons,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch coupons');
  }
};

// Admin: Get single coupon
const getCouponById = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('usedBy.user', 'name email');

    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    res.json(coupon);
  } catch (error) {
    handleError(res, error, 'Failed to fetch coupon');
  }
};

// Admin: Delete coupon
const deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);

    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    res.json({
      success: true,
      message: 'Coupon deleted successfully'
    });
  } catch (error) {
    handleError(res, error, 'Failed to delete coupon');
  }
};

module.exports = {
  validateCoupon,
  createCoupon,
  updateCoupon,
  getAllCoupons,
  getCouponById,
  deleteCoupon
};