const jwt = require('jsonwebtoken');

/**
 * Middleware to verify JWT token from Authorization header
 * Attaches decoded user to req.user
 */
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No token provided',
      statusCode: 401
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired token',
      statusCode: 403
    });
  }
};

/**
 * Middleware to check if user has required role
 * @param {string} requiredRole - Role to check (e.g., 'admin', 'supervisor')
 */
const requireRole = (requiredRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
        statusCode: 401
      });
    }

    if (req.user.role !== requiredRole && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: `This action requires ${requiredRole} role`,
        statusCode: 403
      });
    }

    next();
  };
};

/**
 * Middleware to check if user is owner or admin
 */
const isOwnerOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized',
      statusCode: 401
    });
  }

  if (req.user.role !== 'admin' && req.user.id !== req.params.userId) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to access this resource',
      statusCode: 403
    });
  }

  next();
};

module.exports = {
  verifyToken,
  requireRole,
  isOwnerOrAdmin
};
