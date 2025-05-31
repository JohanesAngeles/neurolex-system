// server/src/routes/tenantRoutes.js - ENHANCED WITH NEW ENDPOINTS
const express = require('express');
const router = express.Router();
const tenantController = require('../controllers/tenantController');
const { protect, adminTenantAccess } = require('../middleware/auth');

// PUBLIC ROUTES - These must be defined BEFORE any middleware
// These routes should be accessible without authentication
router.get('/public', tenantController.getPublicTenants); // <-- This is critical for the login page
router.get('/active/list', tenantController.listActiveTenants);
router.get('/:id/public', tenantController.getPublicTenantById);
router.get('/subdomain/:subdomain', tenantController.getTenantBySubdomain);

// Add this line to clearly mark the separation between public and protected routes
console.log('Tenant routes: Public routes registered');

// PROTECTED ROUTES - Add auth middleware for all routes below this point
router.use(protect);
console.log('Tenant routes: Auth middleware applied for protected routes');

// ===== ADMIN TENANT MANAGEMENT ROUTES =====

// Main CRUD operations
router.get('/', adminTenantAccess, tenantController.getAllTenants);              // Enhanced with pagination/filtering
router.post('/', adminTenantAccess, tenantController.createTenant);              // Enhanced with auto-ID generation
router.get('/:id', adminTenantAccess, tenantController.getTenantById);           // Enhanced with statistics
router.put('/:id', adminTenantAccess, tenantController.updateTenant);            // Enhanced with location support
router.delete('/:id', adminTenantAccess, tenantController.deleteTenant);         // 🆕 NEW: Delete tenant

// Status management
router.patch('/:id/status', adminTenantAccess, tenantController.updateTenantStatus);

// Statistics and reporting
router.get('/:id/stats', adminTenantAccess, tenantController.getTenantStats);    // 🆕 NEW: Get tenant statistics

// Database management routes
router.get('/:id/database', adminTenantAccess, tenantController.getTenantDatabaseStatus);
router.post('/:id/database', adminTenantAccess, tenantController.createTenantDatabase);

// ===== 🆕 NEW: ADMIN-SPECIFIC ROUTES FOR ENHANCED FUNCTIONALITY =====
// These routes should be mounted under /admin/tenants in your main app

// Export functionality
router.get('/export/pdf', adminTenantAccess, tenantController.exportTenantsToPdf); // 🆕 NEW: PDF export

// Bulk operations (for future enhancement)
router.patch('/bulk/status', adminTenantAccess, async (req, res) => {
  // 🆕 NEW: Bulk status update placeholder
  try {
    const { tenantIds, active } = req.body;
    
    if (!Array.isArray(tenantIds) || typeof active !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Invalid request data'
      });
    }
    
    // This would need to be implemented in the controller
    res.status(501).json({
      success: false,
      message: 'Bulk operations not yet implemented'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error performing bulk operation',
      error: error.message
    });
  }
});

// Search and filtering helpers
router.get('/search/locations', adminTenantAccess, async (req, res) => {
  // 🆕 NEW: Get unique locations for filter dropdown
  try {
    const { getMasterConnection } = require('../config/dbMaster');
    const masterConn = getMasterConnection();
    const Tenant = masterConn.model('Tenant');
    
    const locations = await Tenant.distinct('location', { active: true });
    
    res.json({
      success: true,
      data: locations.filter(location => location && location.trim() !== '')
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching locations',
      error: error.message
    });
  }
});

// Validation helpers
router.post('/validate/name', adminTenantAccess, async (req, res) => {
  // 🆕 NEW: Check if tenant name is available
  try {
    const { name, excludeId } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Name is required'
      });
    }
    
    const { getMasterConnection } = require('../config/dbMaster');
    const masterConn = getMasterConnection();
    const Tenant = masterConn.model('Tenant');
    
    const query = { name: name };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    
    const existingTenant = await Tenant.findOne(query);
    
    res.json({
      success: true,
      available: !existingTenant,
      message: existingTenant ? 'Name already exists' : 'Name is available'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error validating name',
      error: error.message
    });
  }
});

router.post('/validate/email', adminTenantAccess, async (req, res) => {
  // 🆕 NEW: Check if admin email is available
  try {
    const { email, excludeId } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Invalid email format'
      });
    }
    
    const { getMasterConnection } = require('../config/dbMaster');
    const masterConn = getMasterConnection();
    const Tenant = masterConn.model('Tenant');
    
    const query = { adminEmail: email.toLowerCase() };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    
    const existingTenant = await Tenant.findOne(query);
    
    res.json({
      success: true,
      valid: true,
      available: !existingTenant,
      message: existingTenant ? 'Email already exists' : 'Email is available'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error validating email',
      error: error.message
    });
  }
});

// Health check and system info
router.get('/system/health', adminTenantAccess, async (req, res) => {
  // 🆕 NEW: System health check for tenant management
  try {
    const { getMasterConnection } = require('../config/dbMaster');
    const masterConn = getMasterConnection();
    const Tenant = masterConn.model('Tenant');
    
    // Get basic stats
    const stats = await Tenant.getStatsSummary();
    
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: masterConn.readyState === 1,
        name: masterConn.name
      },
      statistics: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      message: 'System health check failed',
      error: error.message
    });
  }
});

// ===== ERROR HANDLING MIDDLEWARE =====
router.use((error, req, res, next) => {
  console.error('Tenant Routes Error:', error);
  
  // Handle specific error types
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: Object.values(error.errors).map(err => err.message)
    });
  }
  
  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }
  
  if (error.code === 11000) {
    return res.status(400).json({
      success: false,
      message: 'Duplicate entry detected'
    });
  }
  
  // Default error response
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
  });
});

module.exports = router;