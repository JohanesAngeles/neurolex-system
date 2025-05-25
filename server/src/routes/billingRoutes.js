// server/src/routes/billingRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenantMiddleware');

// Import controllers with error handling
let billingController;
try {
  billingController = require('../controllers/billingController');
} catch (error) {
  console.error('Error importing billing controller:', error);
  // Provide fallback controllers
  billingController = {
    getPaymentMethods: (req, res) => {
      res.status(500).json({ success: false, message: 'Controller not implemented yet' });
    },
    updatePaymentMethods: (req, res) => {
      res.status(500).json({ success: false, message: 'Controller not implemented yet' });
    },
    getBillingRecords: (req, res) => {
      res.status(500).json({ success: false, message: 'Controller not implemented yet' });
    },
    createBillingRecord: (req, res) => {
      res.status(500).json({ success: false, message: 'Controller not implemented yet' });
    },
    getBillingStats: (req, res) => {
      res.status(500).json({ success: false, message: 'Controller not implemented yet' });
    }
  };
}

// Apply tenant middleware to ALL billing routes
router.use(tenantMiddleware);

// Debug middleware for tenant context
router.use((req, res, next) => {
  console.log('\n===== BILLING ROUTES TENANT DEBUG =====');
  console.log(`🔗 Route: ${req.method} ${req.originalUrl}`);
  console.log(`👤 User ID: ${req.user ? req.user.id : 'Not authenticated'}`);
  console.log(`🏢 Tenant ID: ${req.tenantId || 'Not set'}`);
  console.log('=======================================\n');
  next();
});

// Simplified routes to avoid path-to-regexp errors
// Payment methods routes
router.get('/payment-methods', protect, billingController.getPaymentMethods);
router.put('/payment-methods', protect, billingController.updatePaymentMethods);

// Billing records routes
router.get('/stats', protect, billingController.getBillingStats);
router.get('/', protect, billingController.getBillingRecords);
router.post('/', protect, billingController.createBillingRecord);

// Specific billing record routes
router.get('/record/:billingId', protect, billingController.getBillingRecord || ((req, res) => {
  res.status(500).json({ success: false, message: 'Controller not implemented yet' });
}));

router.put('/record/:billingId/status', protect, billingController.updateBillingStatus || ((req, res) => {
  res.status(500).json({ success: false, message: 'Controller not implemented yet' });
}));

// Error handling middleware
router.use((error, req, res, next) => {
  console.error('Billing routes error:', error);
  res.status(500).json({
    success: false,
    message: 'Error processing billing request',
    error: error.message
  });
});

module.exports = router;