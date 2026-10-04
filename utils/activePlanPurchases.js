const Payment = require('../models/Payment');
function unexpired(date, now) { return !date || new Date(date).getTime() > now.getTime(); }
function collectActivePlanIds(user, payments, now = new Date()) {
  const ids = new Set(payments.filter(payment => payment.status === 'completed' &&
    unexpired(payment.expiresAt === undefined ? user.planExpiryAt : payment.expiresAt, now)).map(payment => payment.plan));
  if (unexpired(user.planExpiryAt, now)) {
    const legacy = user.purchasedPlanId || (['pre', 'mains', 'combo'].includes(user.type) ? user.type : null);
    if (legacy) ids.add(legacy);
  }
  return [...ids];
}
async function activePlanIds(user) {
  const payments = await Payment.find({ user: user._id, status: 'completed' }).select('plan status expiresAt').lean();
  return collectActivePlanIds(user, payments);
}
async function assertPlanNotOwned(user, planId) {
  if ((await activePlanIds(user)).includes(String(planId).trim().toLowerCase())) {
    throw Object.assign(new Error('You already have this active plan. You can purchase it again after it expires.'), { status: 409, code: 'PLAN_ALREADY_ACTIVE' });
  }
}
module.exports = { collectActivePlanIds, activePlanIds, assertPlanNotOwned };
