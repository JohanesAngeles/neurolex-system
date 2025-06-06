// server/src/routes/doctorRoutes.js - COMPLETE VERSION WITH BILLING ROUTES + END CARE
const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const journalController = require('../controllers/journalController');
const billingController = require('../controllers/billingController'); // ✅ ADDED - This was missing!
const { protect, restrictTo } = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenantMiddleware');
const multer = require('multer');

console.log('Loading complete doctor routes with billing functionality...');

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

// Configure multer for QR code uploads - ✅ ADDED
const qrUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for QR codes'), false);
    }
  }
});

// Test route
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Doctor routes working',
    timestamp: new Date()
  });
});

// Public routes - no authentication required
router.post('/register', doctorUploadFields, doctorController.register);
router.get('/verification-status/:id', doctorController.getVerificationStatus);

// Get available doctors - SIMPLIFIED VERSION
router.get('/available', async (req, res, next) => {
  try {
    console.log('Available doctors route called');
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
          data: doctors,
          source: 'tenant'
        });
      }
    }
    
    // Fallback to controller
    next();
  } catch (error) {
    console.error('Available doctors error:', error);
    next();
  }
}, doctorController.getAvailableDoctors);

// Apply base middleware for authenticated routes
router.use(protect);
router.use(tenantMiddleware);

// Mixed access routes (both patients and doctors can access)
router.get('/profile/:id', doctorController.getDoctorProfile);
router.post('/connect', doctorController.connectWithDoctor);
router.get('/profile-by-id/:id', doctorController.getDoctorProfileById);
router.get('/payment-methods/:doctorId', doctorController.getDoctorPaymentMethods);
router.get('/patients/:id', doctorController.getPatient);

// Apply doctor role restriction for routes below
router.use(restrictTo('doctor'));

// Doctor-only routes
router.get('/profile', doctorController.getCurrentDoctorProfile);
router.get('/dashboard/stats', doctorController.getDashboardStats);
router.get('/patients', doctorController.getPatients);
router.delete('/patients/:patientId/end-care', doctorController.endPatientCare); // ✅ NEW: End care route
router.post('/assign-template', doctorController.assignTemplate);

// Templates
router.get('/templates', doctorController.getTemplates);
router.get('/templates/:id', doctorController.getTemplate);
router.post('/templates', doctorController.createTemplate);
router.put('/templates/:id', doctorController.updateTemplate);
router.delete('/templates/:id', doctorController.deleteTemplate);
router.post('/templates/assign/:id', doctorController.assignTemplate);

// Journal entries routes
router.get('/journal-entries', journalController.getDoctorJournalEntries || doctorController.getJournalEntries);
router.get('/journal-entries/:id', journalController.getDoctorJournalEntry || doctorController.getJournalEntry);
router.post('/journal-entries/analyze/:id', journalController.analyzeJournalEntry || doctorController.analyzeJournalEntry);
router.post('/journal-entries/notes/:id', journalController.addDoctorNoteToJournalEntry || doctorController.addNoteToJournalEntry);

// Simplified appointment routes for doctors
router.get('/appointments', async (req, res) => {
  try {
    const Appointment = req.tenantConnection ? req.tenantConnection.model('Appointment') : require('../models/Appointment');
    
    const appointments = await Appointment.find({ doctor: req.user.id })
      .populate('patient', 'firstName lastName email profilePicture')
      .sort({ appointmentDate: 1 });
    
    res.status(200).json({
      success: true,
      data: appointments
    });
  } catch (error) {
    console.error('Error getting doctor appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting appointments',
      error: error.message
    });
  }
});

router.get('/appointments/pending', async (req, res) => {
  try {
    const Appointment = req.tenantConnection ? req.tenantConnection.model('Appointment') : require('../models/Appointment');
    
    const appointments = await Appointment.find({ 
      doctor: req.user.id, 
      status: 'Pending' 
    })
    .populate('patient', 'firstName lastName email profilePicture')
    .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      data: appointments
    });
  } catch (error) {
    console.error('Error getting pending appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting pending appointments',
      error: error.message
    });
  }
});

// ============================================================================
// BILLING ROUTES - THESE WERE COMPLETELY MISSING FROM YOUR FILE!
// ============================================================================
console.log('Adding billing routes...');

// Payment Methods Management
router.get('/billing/payment-methods', billingController.getPaymentMethods);
router.put('/billing/payment-methods', billingController.updatePaymentMethods);
router.post('/billing/upload-qr', qrUpload.single('qrCode'), billingController.uploadQRCode);

// Bank Accounts Management
router.post('/billing/bank-accounts', billingController.addBankAccount);
router.delete('/billing/bank-accounts/:accountId', billingController.removeBankAccount);

// Billing Records Management
router.get('/billing', billingController.getBillingRecords);
router.get('/billing/stats', billingController.getBillingStats);
router.get('/billing/report', billingController.generateBillingReport);
router.get('/billing/:billingId', billingController.getBillingRecord);
router.post('/billing', billingController.createBillingRecord);
router.put('/billing/:billingId/status', billingController.updateBillingStatus);
router.put('/billing/:billingId/mark-paid', billingController.markAsPaid);

console.log('Billing routes added successfully');

// ============================================================================
// END OF BILLING ROUTES
// ============================================================================

console.log('Complete doctor routes with billing functionality loaded successfully');

module.exports = router;