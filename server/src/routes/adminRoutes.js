// server/src/routes/adminRoutes.js - WORKING VERSION (NO PROBLEMATIC IMPORTS)
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const adminAuth = require('../middleware/adminAuth');

console.log('Loading simplified admin routes...');

// Test route
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Admin routes working',
    timestamp: new Date()
  });
});

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
router.post('/doctors/verify/:id', adminAuth, adminController.verifyDoctor);
router.get('/doctor-verification-stats', adminAuth, adminController.getDoctorVerificationStats);

// User Management
router.get('/users', adminAuth, adminController.getAllUsers);
router.put('/users/status/:id', adminAuth, adminController.updateUserStatus);
router.delete('/users/:id', adminAuth, adminController.deleteUser);

// Professional Verification
router.get('/professionals', adminAuth, adminController.getAllProfessionals);
router.put('/professionals/verify/:id', adminAuth, adminController.verifyProfessional);

// Content Moderation
router.get('/content/flagged', adminAuth, adminController.getFlaggedContent);
router.put('/content/status/:id', adminAuth, adminController.updateContentStatus);

// Reports
router.get('/reports/system', adminAuth, adminController.getSystemReport);
router.get('/reports/users', adminAuth, adminController.getUsersReport);

// System Settings
router.get('/settings', adminAuth, adminController.getSystemSettings);
router.put('/settings', adminAuth, adminController.updateSystemSettings);

// Template Management
router.get('/templates', adminAuth, adminController.getAllTemplates);
router.put('/templates/:id', adminAuth, adminController.updateTemplate);
router.delete('/templates/:id', adminAuth, adminController.deleteTemplate);

// Feedback
router.get('/feedback', adminAuth, adminController.getAllFeedback);
router.put('/feedback/status/:id', adminAuth, adminController.updateFeedbackStatus);

// Data Export
router.get('/backup', adminAuth, adminController.generateBackup);

console.log('Simplified admin routes loaded successfully');

module.exports = router;

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
router.post('/doctors/verify/:id', adminAuth, adminController.verifyDoctor);
router.get('/doctor-verification-stats', adminAuth, adminController.getDoctorVerificationStats);

// User Management
router.get('/users', adminAuth, adminController.getAllUsers);
router.put('/users/status/:id', adminAuth, adminController.updateUserStatus);
router.delete('/users/:id', adminAuth, adminController.deleteUser);

// Professional Verification
router.get('/professionals', adminAuth, adminController.getAllProfessionals);
router.put('/professionals/verify/:id', adminAuth, adminController.verifyProfessional);

// Content Moderation
router.get('/content/flagged', adminAuth, adminController.getFlaggedContent);
router.put('/content/status/:id', adminAuth, adminController.updateContentStatus);

// Reports
router.get('/reports/system', adminAuth, adminController.getSystemReport);
router.get('/reports/users', adminAuth, adminController.getUsersReport);

// System Settings
router.get('/settings', adminAuth, adminController.getSystemSettings);
router.put('/settings', adminAuth, adminController.updateSystemSettings);

// Template Management
router.get('/templates', adminAuth, adminController.getAllTemplates);
router.put('/templates/:id', adminAuth, adminController.updateTemplate);
router.delete('/templates/:id', adminAuth, adminController.deleteTemplate);

// Feedback
router.get('/feedback', adminAuth, adminController.getAllFeedback);
router.put('/feedback/status/:id', adminAuth, adminController.updateFeedbackStatus);

// Data Export
router.get('/backup', adminAuth, adminController.generateBackup);

console.log('Admin routes with login functionality loaded successfully');

module.exports = router;