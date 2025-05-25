// server/src/routes/billingRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenantMiddleware');
const billingController = require('../controllers/billingController');
const multer = require('multer');
const path = require('path');

// Configure multer for QR code uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req, res, cb) => {
    console.log('File filter - mimetype:', res.mimetype);
    if (res.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// CRITICAL: Apply tenant middleware to ALL billing routes
router.use(tenantMiddleware);

// Debug middleware for tenant context
router.use((req, res, next) => {
  console.log('\n===== BILLING ROUTES TENANT DEBUG =====');
  console.log(`🔗 Route: ${req.method} ${req.originalUrl}`);
  console.log(`👤 User ID: ${req.user ? req.user.id : 'Not authenticated'}`);
  console.log(`🏢 Tenant ID: ${req.tenantId || 'Not set'}`);
  console.log(`🗄️  Tenant DB: ${req.tenantDbName || 'Not connected'}`);
  console.log(`🔌 Connection: ${req.tenantConnection ? 'Active' : 'None'}`);
  console.log('=======================================\n');
  next();
});

// ===== PAYMENT METHODS ROUTES (MUST BE BEFORE OTHER ROUTES) =====
router.get('/payment-methods', protect, billingController.getPaymentMethods);
router.put('/payment-methods', protect, billingController.updatePaymentMethods);

// QR Code upload route with proper tenant file isolation
router.post('/upload-qr', protect, (req, res, next) => {
  console.log('\n===== QR CODE UPLOAD REQUEST =====');
  console.log('URL:', req.originalUrl);
  console.log('Method:', req.method);
  console.log('Tenant ID:', req.tenantId);
  console.log('User ID:', req.user?.id);
  console.log('Content-Type:', req.get('content-type'));
  next();
}, upload.single('qrCode'), (req, res, next) => {
  console.log('After multer - File:', req.file ? 'Present' : 'Missing');
  console.log('After multer - Body:', req.body);
  if (req.file) {
    console.log('File details:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });
  }
  next();
}, billingController.uploadQRCode);

// Bank accounts routes
router.post('/bank-accounts', protect, billingController.addBankAccount);
router.delete('/bank-accounts/:accountId', protect, billingController.removeBankAccount);

// ===== BILLING RECORDS ROUTES =====
router.get('/stats', protect, billingController.getBillingStats);
router.get('/report', protect, billingController.generateBillingReport);
router.get('/:billingId', protect, billingController.getBillingRecord);
router.get('/', protect, billingController.getBillingRecords);
router.post('/', protect, billingController.createBillingRecord);
router.put('/:billingId/status', protect, billingController.updateBillingStatus);
router.put('/:billingId/mark-paid', protect, billingController.markAsPaid);

// Error handling middleware for multer
router.use((error, req, res, next) => {
  console.error('Multer/Billing error:', error);
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 2MB.'
      });
    }
  } else if (error.message === 'Only image files are allowed') {
    return res.status(400).json({
      success: false,
      message: 'Only image files are allowed'
    });
  }
  
  res.status(500).json({
    success: false,
    message: 'Error processing billing request',
    error: error.message
  });
});

module.exports = router;