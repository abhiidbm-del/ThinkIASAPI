const Plan = require('../models/Plan');
const Coupon = require('../models/Coupon');
const { PLANS } = require('../config/plans');

const getPlan = async (planId) => {
  if (!planId) return null;
  const dynamicPlan = await Plan.findOne({ id: String(planId).toLowerCase(), isActive: true }).lean();
  if (dynamicPlan) return dynamicPlan;
  return await Plan.exists({}) ? null : (PLANS[String(planId).toUpperCase()] || null);
};

const calculateServerPrice = async (planId, couponCode, userId) => {
  const plan = await getPlan(planId);
  if (!plan) throw Object.assign(new Error('Invalid plan'), { status: 400 });
  let coupon = null;
  let discountAmount = 0;
  if (couponCode) {
    coupon = await Coupon.findOne({ code: String(couponCode).trim().toUpperCase(), isActive: true });
    const now = new Date();
    if (!coupon || coupon.validFrom > now || coupon.validUntil < now) throw Object.assign(new Error('Invalid or expired coupon'), { status: 400 });
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) throw Object.assign(new Error('Coupon usage limit reached'), { status: 400 });
    if (coupon.applicablePlans.length && !coupon.applicablePlans.includes(plan.id)) throw Object.assign(new Error('Coupon is not valid for this plan'), { status: 400 });
    if (plan.totalAmount < coupon.minPurchaseAmount) throw Object.assign(new Error('Minimum purchase amount not met'), { status: 400 });
    const used = coupon.usedBy.filter(entry => entry.user?.toString() === userId.toString()).length;
    if (used >= coupon.perUserLimit) throw Object.assign(new Error('Coupon usage limit reached for this account'), { status: 400 });
    discountAmount = coupon.discountType === 'percentage'
      ? plan.totalAmount * coupon.discountValue / 100
      : coupon.discountValue;
    if (coupon.maxDiscountAmount !== null) discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
    discountAmount = Math.min(plan.totalAmount, Math.round(discountAmount));
  }
  return { plan, coupon, discountAmount, amount: plan.totalAmount - discountAmount };
};

module.exports = { getPlan, calculateServerPrice };
