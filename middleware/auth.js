// middleware/auth.js
const jwt = require('jsonwebtoken');
const db = require('../config/database');

// Authenticate token middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET environment variable is not set');
      return res.status(500).json({ 
        success: false, 
        message: 'Server configuration error' 
      });
    }
    const decoded = jwt.verify(token, jwtSecret);
    
    const userResult = await db.query(
      'SELECT * FROM "User" WHERE user_id = $1', 
      [decoded.userId]
    );
    
    if (userResult.rowCount === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    // Check if user is active
    if (!userResult.rows[0].is_active) {
      return res.status(403).json({
        success: false,
        message: 'Account is inactive. Please contact admin.'
      });
    }
    
    req.user = userResult.rows[0];
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token' 
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expired' 
      });
    }
    console.error('Authentication error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
};

// Optional authentication middleware
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      req.user = null;
      return next();
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET environment variable is not set');
      req.user = null;
      return next();
    }
    const decoded = jwt.verify(token, jwtSecret);
    
    const userResult = await db.query(
      'SELECT * FROM "User" WHERE user_id = $1', 
      [decoded.userId]
    );
    
    if (userResult.rowCount === 0) {
      req.user = null;
    } else {
      req.user = userResult.rows[0];
    }
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

// Role-based access control middleware
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }
    
    // ECS Employees have the same permissions as admins
    if (req.user.user_type === 'ecs_employee') {
      req.user.user_type = 'admin'; // Temporarily elevate for role checking
    }
    
    if (!roles.includes(req.user.user_type)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Insufficient permissions.' 
      });
    }
    
    next();
  };
};

// Verify account status middleware
const verifyAccountStatus = (req, res, next) => {
  if (!req.user.is_verified) {
    return res.status(403).json({
      success: false,
      message: 'Account email not verified. Please verify your email to proceed.'
    });
  }
  
  next();
};

// Check if user owns a resource
const checkResourceOwnership = (resourceGetter) => {
  return async (req, res, next) => {
    try {
      const resourceOwnerId = await resourceGetter(req);
      
      if (resourceOwnerId !== req.user.user_id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You do not own this resource.'
        });
      }
      
      next();
    } catch (error) {
      console.error('Resource ownership check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireRole,
  verifyAccountStatus,
  checkResourceOwnership
};