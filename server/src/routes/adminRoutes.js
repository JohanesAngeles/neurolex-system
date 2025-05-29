// server/src/routes/adminRoutes.js - FIXED VERSION
const express = require('express');
const router = express.Router();
const multer = require('multer');
const adminController = require('../controllers/adminController');
const adminAuth = require('../middleware/adminAuth');

console.log('Loading admin routes with proper file upload configuration...');

// ✅ FIXED: Configure multer middleware at route level
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // Only 1 file at a time
  },
  fileFilter: (req, file, cb) => {
    console.log('🔍 File filter check:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });
    
    // Allow image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Test route
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Admin routes working with file upload',
    timestamp: new Date(),
    uploadEndpoint: '/api/admin/upload-logo'
  });
});

// ADMIN AUTHENTICATION ROUTES
router.post('/login', adminController.adminLogin);
router.post('/logout', adminAuth, adminController.adminLogout);
router.get('/profile', adminAuth, adminController.getAdminProfile);

// Dashboard
router.get('/dashboard', adminAuth, adminController.getDashboardData);

// Patient Management
router.get('/patients', adminAuth, adminController.getAllPatients);
router.delete('/patients/:patientId', adminAuth, adminController.deletePatient);
router.get('/tenants', adminAuth, adminController.getTenants);
router.get('/patients/export/pdf', adminAuth, adminController.exportPatientsToPdf);

// Doctor Verification
router.get('/doctors/pending', adminAuth, adminController.getPendingDoctors);
router.get('/doctors/approved', adminAuth, adminController.getVerifiedDoctors);
router.get('/doctors/rejected', adminAuth, adminController.getRejectedDoctors);
router.get('/doctors/:id', adminAuth, adminController.getDoctorDetails);
router.post('/doctors/:id/verify', adminAuth, adminController.verifyDoctor);
router.get('/doctor-verification-stats', adminAuth, adminController.getDoctorVerificationStats);

// User Management
router.get('/users', adminAuth, adminController.getAllUsers);
router.put('/users/status/:id', adminAuth, adminController.updateUserStatus);
router.delete('/users/:id', adminAuth, adminController.deleteUser);

// Professional Verification (Legacy)
router.get('/professionals', adminAuth, adminController.getAllProfessionals);
router.put('/professionals/verify/:id', adminAuth, adminController.verifyProfessional);

// Content Moderation
router.get('/content/flagged', adminAuth, adminController.getFlaggedContent);
router.put('/content/status/:id', adminAuth, adminController.updateContentStatus);

// Reports
router.get('/reports/system', adminAuth, adminController.getSystemReport);
router.get('/reports/users', adminAuth, adminController.getUsersReport);

// System Settings (Legacy)
router.get('/settings', adminAuth, adminController.getSystemSettings);
router.put('/settings', adminAuth, adminController.updateSystemSettings);

// ✅ TENANT SETTINGS ROUTES
router.get('/tenant-settings/:tenantId', adminAuth, adminController.getTenantSettings);
router.put('/tenant-settings/:tenantId', adminAuth, adminController.updateTenantSettings);
router.patch('/tenant-settings/:tenantId', adminAuth, adminController.updateIndividualTenantSetting);

// ✅ FIXED: File upload route with proper middleware chain
router.post('/upload-logo', 
  adminAuth,                    // Authentication first
  upload.single('logo'),        // Then multer middleware
  adminController.uploadTenantLogo  // Finally the controller
);

// Keep old route for backward compatibility
router.post('/upload-tenant-asset', 
  adminAuth, 
  upload.single('file'), 
  adminController.uploadTenantAsset
);

// Template Management
router.get('/templates', adminAuth, adminController.getAllTemplates);
router.put('/templates/:id', adminAuth, adminController.updateTemplate);
router.delete('/templates/:id', adminAuth, adminController.deleteTemplate);

// Feedback
router.get('/feedback', adminAuth, adminController.getAllFeedback);
router.put('/feedback/status/:id', adminAuth, adminController.updateFeedbackStatus);

// Data Export
router.get('/backup', adminAuth, adminController.generateBackup);

// ✅ Error handling middleware for multer errors
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    console.error('❌ Multer error:', error);
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 10MB.',
        error: 'FILE_TOO_LARGE'
      });
    }
    
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Only 1 file allowed.',
        error: 'TOO_MANY_FILES'
      });
    }
    
    return res.status(400).json({
      success: false,
      message: 'File upload error: ' + error.message,
      error: error.code
    });
  }
  
  if (error.message === 'Only image files are allowed') {
    return res.status(400).json({
      success: false,
      message: 'Only image files (PNG, JPG, JPEG, GIF, WEBP) are allowed.',
      error: 'INVALID_FILE_TYPE'
    });
  }
  
  console.error('❌ Route error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
  });
});

console.log('✅ Admin routes with proper file upload configuration loaded successfully');

module.exports = router;