// server/src/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const adminAuth = require('../middleware/adminAuth');

// IMPORTANT CHANGE: Use only adminAuth middleware, not both auth and adminAuth

// GET /api/admin/dashboard - Get admin dashboard data
router.get('/dashboard', adminAuth, adminController.getDashboardData);

// ===== PATIENT MANAGEMENT ROUTES (NEW) =====
router.get('/patients', adminAuth, adminController.getAllPatients);
router.delete('/patients/:patientId', adminAuth, adminController.deletePatient);
router.get('/tenants', adminAuth, adminController.getTenants);
router.get('/patients/export/pdf', adminAuth, adminController.exportPatientsToPdf);

// ===== DOCTOR VERIFICATION ROUTES =====
// Get lists of doctors based on verification status
router.get('/doctors/pending', adminAuth, adminController.getPendingDoctors);
router.get('/doctors/approved', adminAuth, adminController.getVerifiedDoctors);
router.get('/doctors/rejected', adminAuth, adminController.getRejectedDoctors);
router.get('/doctors/:id', adminAuth, adminController.getDoctorDetails);
router.post('/doctors/:id/verify', adminAuth, adminController.verifyDoctor);
router.get('/doctor-verification-stats', adminAuth, adminController.getDoctorVerificationStats);

// User management routes
router.get('/users', adminAuth, adminController.getAllUsers);
router.put('/users/:id/status', adminAuth, adminController.updateUserStatus);
router.delete('/users/:id', adminAuth, adminController.deleteUser);

// Professional verification routes
router.get('/professionals', adminAuth, adminController.getAllProfessionals);
router.put('/professionals/:id/verify', adminAuth, adminController.verifyProfessional);

// Content moderation routes
router.get('/content/flagged', adminAuth, adminController.getFlaggedContent);
router.put('/content/:id/status', adminAuth, adminController.updateContentStatus);

// Report generation routes
router.get('/reports/system', adminAuth, adminController.getSystemReport);
router.get('/reports/users', adminAuth, adminController.getUsersReport);

// System settings routes
router.get('/settings', adminAuth, adminController.getSystemSettings);
router.put('/settings', adminAuth, adminController.updateSystemSettings);

// Template management routes
router.get('/templates', adminAuth, adminController.getAllTemplates);
router.put('/templates/:id', adminAuth, adminController.updateTemplate);
router.delete('/templates/:id', adminAuth, adminController.deleteTemplate);

// Feedback tracking routes
router.get('/feedback', adminAuth, adminController.getAllFeedback);
router.put('/feedback/:id/status', adminAuth, adminController.updateFeedbackStatus);

// Data export routes
router.get('/backup', adminAuth, adminController.generateBackup);

module.exports = router;