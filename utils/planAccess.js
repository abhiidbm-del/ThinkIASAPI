// Purchasing another plan must not remove content already purchased.
const mergePlanAccess = (current, purchased) => current === 'combo' || purchased === 'combo'
  || (current === 'pre' && purchased === 'mains') || (current === 'mains' && purchased === 'pre') ? 'combo' : purchased;

const canAccessPlan = (userType, required) => {
  if (!required) return true;
  if (required === 'paid') return ['pre', 'mains', 'combo'].includes(userType);
  if (userType === 'combo') return required === 'pre' || required === 'mains' || required === 'combo';
  return userType === required;
};

const requirePlan = (required) => (req, res, next) => {
  if (req.user?.role === 'admin') return next();
  if (canAccessPlan(req.user?.type, required)) return next();
  const message = required === 'mains'
    ? 'An active Mains plan is required.'
    : required === 'pre'
      ? 'An active Prelims plan is required.'
      : 'An active plan is required.';
  return res.status(403).json({
    success: false,
    message,
    messageHindi: required === 'mains' ? 'सक्रिय मेन्स प्लान आवश्यक है।' : required === 'pre' ? 'सक्रिय प्रारंभिक प्लान आवश्यक है।' : 'सक्रिय प्लान आवश्यक है।'
  });
};

module.exports = { mergePlanAccess, canAccessPlan, requirePlan };
