const jwt = require('jsonwebtoken');
const { JWT } = require('../config/constants');
const { handleError } = require('./errorHandler');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    const decoded = jwt.verify(token, JWT.SECRET);
    if (decoded.appSessionId) {
      const session = await require('../models/AppAuthSession').findOne({
        _id: decoded.appSessionId, user: decoded.userId, expiresAt: { $gt: new Date() }
      });
      if (!session) return res.status(401).json({success:false,message:'Session expired or logged out. Please log in again.'});
      req.appSession = session;
    }
    
    // Support both userId and id formats
    const userId = decoded.userId || decoded.id;
    
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'Token is not valid' });
    }

    if (decoded.appSessionId && (decoded.appAuthVersion || 0) !== (user.appAuthVersion || 0)) {
      return res.status(401).json({success:false,message:'Password changed. Please log in again.'});
    }

    if (user.isActive === false) return res.status(403).json(require('../utils/accountStatus').inactiveAccount);
    req.user = user;
    next();
  } catch (error) {
    if (['JsonWebTokenError','TokenExpiredError','NotBeforeError'].includes(error.name)) {
      return res.status(401).json({success:false,message:'Invalid or expired token. Please log in again.'});
    }
    handleError(res, error, 'Authentication failed');
  }
};

const adminAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'User not authenticated' });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admin only.' });
  }
  next();
};

const studentAuth = (req, res, next) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ message: 'Access denied. Students only.' });
  }
  next();
};

// Add aliases for career API compatibility without breaking existing code
const protect = auth;
const admin = adminAuth;

module.exports = { 
  auth, 
  adminAuth, 
  studentAuth,
  protect,  // Alias for career API
  admin     // Alias for career API
};
