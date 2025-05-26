// server/src/middleware/adminAuth.js - FIXED VERSION
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const adminAuth = async (req, res, next) => {
  try {
    // Get token from authorization header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      console.log('❌ No token provided in admin auth');
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required',
        redirect: '/admin/login'
      });
    }
    
    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('🔍 Token decoded:', { id: decoded.id, role: decoded.role });
      
      // FIXED: Handle default admin vs database admin
      let user;
      
      if (decoded.id === 'admin_default') {
        // This is the default admin from environment variables
        console.log('🔧 Using default admin from environment variables');
        user = {
          _id: 'admin_default',
          id: 'admin_default',
          email: decoded.email,
          role: 'admin',
          firstName: 'System',
          lastName: 'Administrator',
          name: decoded.name || 'System Administrator'
        };
      } else {
        // This is a database admin user
        console.log('🔍 Looking up database admin user');
        user = await User.findById(decoded.id);
        
        if (!user) {
          console.log(`❌ User not found with ID: ${decoded.id}`);
          return res.status(401).json({ 
            success: false, 
            message: 'User not found',
            redirect: '/admin/login'
          });
        }
        
        // Check if database user is an admin
        if (user.role !== 'admin') {
          console.log(`❌ Admin access denied to user ${user._id} with role ${user.role}`);
          return res.status(403).json({ 
            success: false, 
            message: 'Admin access required',
            redirect: '/admin/login'
          });
        }
      }
      
      console.log(`🔍 Admin user: ${user.email}, role: ${user.role}`);
      
      // Set user on request object
      req.user = user;
      req.token = token;
      console.log(`✅ Admin access granted to user ${user.id || user._id}`);
      
      next();
    } catch (error) {
      // Handle specific JWT errors
      if (error.name === 'JsonWebTokenError') {
        console.log('❌ Invalid JWT token:', error.message);
        return res.status(401).json({ 
          success: false, 
          message: 'Invalid token',
          redirect: '/admin/login'
        });
      }
      
      if (error.name === 'TokenExpiredError') {
        console.log('❌ JWT token expired:', error.message);
        return res.status(401).json({ 
          success: false, 
          message: 'Token expired',
          redirect: '/admin/login'
        });
      }
      
      throw error; // Re-throw for general error handling
    }
  } catch (error) {
    console.error('❌ Admin auth middleware error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Authentication failed',
      redirect: '/admin/login'
    });
  }
};

module.exports = adminAuth;