// server/src/routes/tenantRoutes.js
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

// Admin routes for tenant management
router.get('/', adminTenantAccess, tenantController.getAllTenants);
router.post('/', adminTenantAccess, tenantController.createTenant);
router.get('/:id', adminTenantAccess, tenantController.getTenantById);
router.put('/:id', adminTenantAccess, tenantController.updateTenant);
router.patch('/:id/status', adminTenantAccess, tenantController.updateTenantStatus);

// Database management routes
router.get('/:id/database', adminTenantAccess, tenantController.getTenantDatabaseStatus);
router.post('/:id/database', adminTenantAccess, tenantController.createTenantDatabase);

module.exports = router;