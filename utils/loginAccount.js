const User = require('../models/User');

const loginQuery = (identifier) => {
  const raw = String(identifier || '').trim();
  const email = raw.toLowerCase();
  const digits = raw.replace(/\D/g, '');
  const or = [{ email }, { email: raw }];
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    for (const phone of [raw, digits, last10, `+91${last10}`, `91${last10}`]) or.push({ phone });
  }
  return { $or: or };
};

const findLoginUser = (identifier) => User.findOne(loginQuery(identifier));

module.exports = { loginQuery, findLoginUser };
