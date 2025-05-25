// server/src/middleware/auth.js

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getMasterConnection } = require('../config/dbMaster');
const dbManager = require('../utils/dbManager');

// Middleware to protect routes
const protect = async (req, res, next) => {
  try {
    console.log('Auth middleware called for path:', req.path);

    let token;
    
    // Get token from header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
      console.log('Token received in auth middleware:', token ? `${token.substring(0, 10)}...` : 'No token');
    }
    
    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }
    
    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Set user and tenant ID from token 
      req.user = {
        id: decoded.id,
        role: decoded.role,
        tenantId: decoded.tenantId
      };
      
      // We'll let the tenant middleware handle the connection
      
      next();
    } catch (error) {
      console.error('Authentication error:', error);
      
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token. Please log in again'
        });
      }
      
      // We still keep this check for backward compatibility with any existing tokens
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Your session has expired. Please log in again'
        });
      }
      
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }
  } catch (error) {
    next(error);
  }
};

// Restrict access by role
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({
        success: false,
        message: 'User role not defined'
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action'
      });
    }
    
    next();
  };
};

// Middleware to restrict access to tenant management
const adminTenantAccess = async (req, res, next) => {
  try {
    // First, apply the protect middleware
    protect(req, res, async () => {
      // Check if user is an admin
      if (req.user && req.user.role === 'admin') {
        try {
          // Connect to the master database for tenant operations
          const masterConn = getMasterConnection();
          
          // Make the master connection available to controllers
          req.masterConnection = masterConn;
          
          next();
        } catch (error) {
          console.error('Error in admin tenant access middleware:', error);
          return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
          });
        }
      } else {
        return res.status(403).json({
          success: false,
          message: 'Admin privileges required for tenant management'
        });
      }
    });
  } catch (error) {
    console.error('Error in admin tenant access middleware:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// For backward compatibility
const auth = protect;

// Export both named functions and default (for backward compatibility)
module.exports = auth;
module.exports.protect = protect;
module.exports.restrictTo = restrictTo;
module.exports.adminTenantAccess = adminTenantAccess;