// server/src/routes/doctorRoutes.js

const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const journalController = require('../controllers/journalController');
// ✅ FIXED: Import appointmentController for appointment routes
const appointmentController = require('../controllers/appointmentController');
const { protect, restrictTo } = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenantMiddleware');
const dbManager = require('../utils/dbManager');
const multer = require('multer');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

const doctorUploadFields = upload.fields([
  { name: 'licenseDocument', maxCount: 1 },
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'certifications', maxCount: 5 }
]);

router.get('/flutter/available', async (req, res, next) => {
  try {
    console.log('Flutter doctor selection endpoint called');
    const { tenantId } = req.query;
    
    if (tenantId) {
      const dbManager = require('../utils/dbManager');
      const connection = await dbManager.connectTenant(tenantId);
      
      if (connection) {
        const User = connection.model('User');
        const doctors = await User.find({ 
          role: 'doctor', 
          verificationStatus: 'approved' 
        })
        .select('firstName lastName specialty profilePicture consultationFee')
        .lean();
        
        return res.status(200).json({
          success: true,
          data: doctors
        });
      }
    }
    
    // Fallback to controller
    next();
  } catch (error) {
    console.error('Flutter doctor endpoint error:', error);
    next();
  }
}, doctorController.getAvailableDoctors);

// Public routes - no authentication required
router.post('/register', doctorUploadFields, doctorController.register);
router.get('/verification-status/:id', doctorController.getVerificationStatus);

// IMPORTANT: Add custom middleware for ONLY the /available route that handles tenant context
router.get('/available', async (req, res, next) => {
  try {
    // Get tenant ID from query params
    const { tenantId } = req.query;
    
    console.log('Doctor /available route called with query params:', req.query);
    console.log('TenantId from query:', tenantId || 'Not provided');
    
    // If no tenantId provided, just continue
    if (!tenantId) {
      console.log('No tenantId provided in query, continuing with default database');
      return next();
    }
    
    // If tenantId is provided, connect to tenant database directly
    console.log(`Connecting directly to tenant: ${tenantId}`);
    
    // IMPORTANT: Use the dbManager module to connect to the tenant database
    const dbManager = require('../utils/dbManager');
    const connection = await dbManager.connectTenant(tenantId);
    
    if (connection) {
      console.log(`Successfully connected to tenant database for tenant: ${tenantId}`);
      // Set tenant connection and ID on request
      req.tenantConnection = connection;
      req.tenantId = tenantId;
      
      // Get the tenant-specific User model
      const User = connection.model('User');
      console.log(`Using User model from tenant: ${tenantId}`);
      
      // Execute query directly here instead of in the controller
      const query = { 
        role: 'doctor', 
        verificationStatus: 'approved'
      };
      
      console.log('Using query:', JSON.stringify(query));
      
      // Get all doctors in this tenant database
      const allDoctors = await User.find({ role: 'doctor' }).lean();
      console.log(`Found ${allDoctors.length} total doctors in tenant database`);
      
      // Log each tenant doctor for debugging
      allDoctors.forEach((doc, i) => {
        console.log(`Tenant Doctor ${i+1}:`, {
          id: doc._id,
          name: `${doc.firstName} ${doc.lastName}`,
          email: doc.email || 'No email',
          verificationStatus: doc.verificationStatus || 'Not set',
          isVerified: !!doc.isVerified,
          isActive: !!doc.isActive
        });
      });
      
      // Get approved doctors
      const doctors = await User.find(query)
        .select('firstName lastName title credentials specialty specialization profilePicture description languages gender lgbtqAffirming availability')
        .sort({ createdAt: -1 })
        .lean();
      
      console.log(`Query returned ${doctors.length} approved doctors from tenant database`);
      
      // Return JSON response directly instead of passing to controller
      return res.status(200).json({
        success: true,
        data: doctors,
        source: 'tenant',
        tenantId: tenantId
      });
    } else {
      console.error(`Failed to connect to tenant database: ${tenantId}`);
    }
    
    // If we couldn't connect to the tenant database, continue to the controller
    // which will use the default database as fallback
    next();
  } catch (error) {
    console.error('Error in available middleware:', error);
    
    // Forward to the controller as fallback
    next();
  }
}, doctorController.getAvailableDoctors);

// =====================================================
// MIXED ACCESS ROUTES (Both patients and doctors can access)
// These need authentication but NOT role restriction
// =====================================================

// Apply base middleware for all routes below
router.use(protect);
router.use(tenantMiddleware);

// Patient-facing routes that need authentication but not doctor role
router.get('/profile/:id', doctorController.getDoctorProfile);
router.post('/connect', doctorController.connectWithDoctor);

// ✅ FIXED: Moved Flutter route HERE (before restrictTo middleware) so patients can access it
router.get('/profile-by-id/:id', doctorController.getDoctorProfileById);

// ✅ NEW: Payment methods route for mobile app (patients need access to see doctor's payment methods)
router.get('/:doctorId/payment-methods', doctorController.getDoctorPaymentMethods);

// 🔧 FIX: Move patient access routes HERE (before restrictTo middleware)
// These routes allow BOTH patients and doctors to access patient data
router.get('/patients/:id', doctorController.getPatient); // ✅ Patients can view their own details

// =====================================================
// DOCTOR-ONLY ROUTES
// These require doctor role
// =====================================================

// Apply doctor role restriction for routes below this point
router.use(restrictTo('doctor'));

// Doctor profile and dashboard routes
router.get('/profile', doctorController.getDoctorProfile);
router.get('/dashboard/stats', doctorController.getDashboardStats);

// Doctor-only patient management
router.get('/patients', doctorController.getPatients); // Only doctors can list all patients
router.post('/assign-template', doctorController.assignTemplate);

// Templates
router.get('/templates', doctorController.getTemplates);
router.get('/templates/:id', doctorController.getTemplate);
router.post('/templates', doctorController.createTemplate);
router.put('/templates/:id', doctorController.updateTemplate);
router.delete('/templates/:id', doctorController.deleteTemplate);
router.post('/templates/:id/assign', doctorController.assignTemplate);

// Journal entries routes
router.get('/journal-entries', journalController.getDoctorJournalEntries || doctorController.getJournalEntries);
router.get('/journal-entries/:id', journalController.getDoctorJournalEntry || doctorController.getJournalEntry);
router.post('/journal-entries/:id/analyze', journalController.analyzeJournalEntry || doctorController.analyzeJournalEntry);
router.post('/journal-entries/:id/notes', journalController.addDoctorNoteToJournalEntry || doctorController.addNoteToJournalEntry);

// ✅ SAFEST: Add appointment routes using ONLY existing methods
console.log('🏥 Adding appointment routes to doctor routes (using existing methods only)...');

// ✅ SAFE: Use existing getUserAppointments method for getting all appointments
router.get('/appointments', appointmentController.getUserAppointments);

// ✅ SAFE: Use existing getPendingAppointments method
router.get('/appointments/pending', appointmentController.getPendingAppointments);

// ✅ SAFE: Use existing getAppointmentById method
router.get('/appointments/:id', appointmentController.getAppointmentById);

// ✅ SAFE: Use existing acceptAppointment method (note: uses :appointmentId parameter)
router.put('/appointments/:appointmentId/accept', appointmentController.acceptAppointment);

// ✅ SAFE: Use existing declineAppointment method (note: uses :appointmentId parameter)
router.put('/appointments/:appointmentId/decline', appointmentController.declineAppointment);

// ✅ SAFE: Use existing updateAppointmentStatus method
router.put('/appointments/:id/status', appointmentController.updateAppointmentStatus);

// ✅ SAFE: Use existing rescheduleAppointment method
router.put('/appointments/:id/reschedule', appointmentController.rescheduleAppointment);

console.log('✅ Appointment routes added successfully using existing methods only');

module.exports = router;