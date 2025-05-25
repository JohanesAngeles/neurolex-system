// server/src/middleware/adminAuth.js
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
      
      // 🔧 FIX: Use 'id' instead of '_id' to match your token payload
      const user = await User.findById(decoded.id);  // Changed from decoded._id to decoded.id
      
      if (!user) {
        console.log(`❌ User not found with ID: ${decoded.id}`);
        return res.status(401).json({ 
          success: false, 
          message: 'User not found',
          redirect: '/admin/login'
        });
      }
      
      console.log(`🔍 User found: ${user.email}, role: ${user.role}`);
      
      // Check if user is an admin
      if (user.role !== 'admin') {
        console.log(`❌ Admin access denied to user ${user._id} with role ${user.role}`);
        return res.status(403).json({ 
          success: false, 
          message: 'Admin access required',
          redirect: '/admin/login'
        });
      }
      
      // Set user on request object
      req.user = user;
      req.token = token;
      console.log(`✅ Admin access granted to user ${user._id} with role ${user.role}`);
      
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
      error: error.message,
      redirect: '/admin/login'
    });
  }
};

module.exports = adminAuth;