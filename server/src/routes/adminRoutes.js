// server/src/routes/adminRoutes.js - UPDATED WITH DOCTOR MANAGEMENT ROUTES
const express = require('express');
const router = express.Router();
const multer = require('multer');
const adminController = require('../controllers/adminController');
const adminAuth = require('../middleware/adminAuth');
const tenantController = require('../controllers/tenantController');

// 🆕 NEW: Import tenant routes
const tenantRoutes = require('./tenantRoutes');

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

// Helper routes for journal filters
router.get('/patients/list', adminAuth, adminController.getAllPatientsForFilter);
router.get('/doctors/list', adminAuth, adminController.getAllDoctorsForFilter);

// Patient Management
router.get('/patients', adminAuth, adminController.getAllPatients);
router.get('/patients/:patientId', adminAuth, adminController.getPatientById);
router.put('/patients/:patientId', adminAuth, adminController.updatePatient);
router.delete('/patients/:patientId', adminAuth, adminController.deletePatient);
router.get('/tenants', adminAuth, tenantController.getAllTenants);
router.get('/patients/export/pdf', adminAuth, adminController.exportPatientsToPdf);

// Doctor Verification
router.get('/doctors/pending', adminAuth, adminController.getPendingDoctors);
router.get('/doctors/approved', adminAuth, adminController.getVerifiedDoctors);
router.get('/doctors/rejected', adminAuth, adminController.getRejectedDoctors);
router.get('/doctors/:id', adminAuth, adminController.getDoctorDetails);
router.post('/doctors/:id/verify', adminAuth, adminController.verifyDoctor);
router.get('/doctor-verification-stats', adminAuth, adminController.getDoctorVerificationStats);

// 🆕 NEW: ADMIN DOCTOR MANAGEMENT ROUTES (Added to fix 404 error)
console.log('Adding admin doctor management routes...');

// POST /admin/doctors - Add new doctor (admin function)
router.post('/doctors', adminAuth, adminController.addDoctor);

// PUT /admin/doctors/:id - Update doctor (admin function)  
router.put('/doctors/:id', adminAuth, adminController.updateDoctor);

// DELETE /admin/doctors/:id - Delete doctor (admin function)
router.delete('/doctors/:id', adminAuth, adminController.deleteDoctor);

// GET /admin/doctors - Get all doctors (for listing, optional)
router.get('/doctors', adminAuth, adminController.getAllDoctors);

console.log('Admin doctor management routes added successfully');

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

// 🚨 FIXED: HIRS routes with the correct endpoints that match frontend calls
// Main HIRS toggle route (this is what the frontend expects)
router.put('/tenant-settings/:tenantId/hirs/:hirsId/toggle', adminAuth, adminController.toggleHirsFeature);

// Alternative route for backward compatibility
router.patch('/tenant-settings/:tenantId/hirs/:hirsId', adminAuth, adminController.toggleHirsFeature);

// Additional HIRS management routes
router.get('/tenant-settings/:tenantId/hirs/stats', adminAuth, adminController.getHirsStats);
router.put('/tenant-settings/:tenantId/hirs/bulk', adminAuth, adminController.bulkUpdateHirs);

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
router.delete('/templates/:id', adminController.deleteTemplate);

// Feedback
router.get('/feedback', adminAuth, adminController.getAllFeedback);
router.put('/feedback/status/:id', adminAuth, adminController.updateFeedbackStatus);

// Data Export
router.get('/backup', adminAuth, adminController.generateBackup);

// 🆕 NEW: Mount tenant management routes
// This makes all tenant routes available under /admin/tenants/*
router.use('/tenants', tenantRoutes);

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

// ===== TEMPLATE MANAGEMENT ROUTES =====
console.log('Adding template management routes...');

// Templates
router.get('/templates', adminController.getTemplates);
router.get('/templates/stats', adminController.getTemplateStats);
router.get('/templates/:id', adminController.getTemplate);
router.post('/templates', adminController.createTemplate);
router.put('/templates/:id', adminController.updateTemplate);
router.delete('/templates/:id', adminController.deleteTemplate);
router.post('/templates/:id/assign', adminController.assignTemplate);

console.log('Template management routes added successfully');

// ===== JOURNAL MANAGEMENT ROUTES =====
console.log('Adding admin journal management routes...');

// Journal Entries Management
router.get('/journal-entries', adminAuth, adminController.getJournalEntries);
router.get('/journal-entries/stats', adminAuth, adminController.getJournalStats);
router.get('/journal-entries/export/pdf', adminAuth, adminController.exportJournalEntriesToPDF);
router.get('/journal-entries/:id', adminAuth, adminController.getJournalEntry);
router.delete('/journal-entries/:id', adminAuth, adminController.deleteJournalEntry);



console.log('Admin journal management routes added successfully');

console.log('✅ Admin routes with proper file upload configuration, tenant management, doctor management, and journal management loaded successfully');

module.exports = router;