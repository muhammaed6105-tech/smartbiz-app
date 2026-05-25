const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if ((!authHeader || !authHeader.startsWith('Bearer ')) && !req.query.token) {
      return res.status(401).json({ message: 'No token provided. Access denied.' });
    }

    const token = req.query.token || authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('-password');

    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'User not found or account deactivated.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token. Access denied.' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Required role: ${roles.join(' or ')}`
      });
    }
    next();
  };
};

module.exports = { authenticate, authorize };
