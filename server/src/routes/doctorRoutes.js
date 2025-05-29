// server/src/routes/doctorRoutes.js - 
const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const journalController = require('../controllers/journalController');
const billingController = require('../controllers/billingController');
const { protect, restrictTo } = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenantMiddleware');
const multer = require('multer');


console.log('Loading complete fixed doctor routes...');


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


const qrUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
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


// ===== PUBLIC ROUTES - No authentication required =====
router.post('/register', doctorUploadFields, doctorController.register);
router.post('/login', doctorController.login);
router.get('/verification-status/:id', doctorController.getVerificationStatus);


// ===== AUTHENTICATED ROUTES - But accessible by both patients and doctors =====
// Apply authentication but NO role restriction yet
router.use(protect);
router.use(tenantMiddleware);


// CRITICAL FIX: These endpoints need to be accessible by PATIENTS
// Get available doctors - patients need this to browse doctors
router.get('/available', doctorController.getAvailableDoctors);


// Get doctor list - patients need this to see all doctors
router.get('/list', doctorController.getDoctorList);


// Connect with doctor - patients need this to connect
router.post('/connect', doctorController.connectWithDoctor);


// Get doctor profiles - patients need this to view doctor info
router.get('/profile/:id', doctorController.getDoctorProfile);
router.get('/profile-by-id/:id', doctorController.getDoctorProfileById);


// Get connected doctors for current user - patients need this
router.get('/connected', doctorController.getConnectedDoctors);


// Get current doctor for user - patients need this
router.get('/current', doctorController.getCurrentDoctorForUser);


// Get doctor payment methods - patients need this for payments
router.get('/payment-methods/:doctorId', doctorController.getDoctorPaymentMethods);


// Get specific patient - Allow both doctors and patients (with proper access control in controller)
router.get('/patients/:id', doctorController.getPatient);


// Schedule appointment - patients need this
router.post('/schedule', doctorController.scheduleAppointment);


// ===== DOCTOR-ONLY ROUTES - Apply doctor role restriction =====
// Everything below this line requires doctor role
router.use(restrictTo('doctor'));


console.log('Applying doctor role restriction to routes below...');


// Doctor's own profile and dashboard
router.get('/profile', doctorController.getCurrentDoctorProfile);
router.get('/dashboard/stats', doctorController.getDashboardStats);


// Patient management for doctors
router.get('/patients', doctorController.getPatients);
router.post('/assign-template', doctorController.assignTemplate);


// Templates - doctor only
router.get('/templates', doctorController.getTemplates);
router.get('/templates/:id', doctorController.getTemplate);
router.post('/templates', doctorController.createTemplate);
router.put('/templates/:id', doctorController.updateTemplate);
router.delete('/templates/:id', doctorController.deleteTemplate);
router.post('/templates/assign/:id', doctorController.assignTemplate);


// Journal entries routes - doctor only
router.get('/journal-entries', journalController.getDoctorJournalEntries || doctorController.getJournalEntries);
router.get('/journal-entries/:id', journalController.getDoctorJournalEntry || doctorController.getJournalEntry);
router.post('/journal-entries/analyze/:id', journalController.analyzeJournalEntry || doctorController.analyzeJournalEntry);
router.post('/journal-entries/notes/:id', journalController.addDoctorNoteToJournalEntry || doctorController.addNoteToJournalEntry);


// Appointments for doctors
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


// ===== BILLING ROUTES - Doctor only =====
console.log('Adding billing routes for doctors...');


router.get('/billing/payment-methods', billingController.getPaymentMethods);
router.put('/billing/payment-methods', billingController.updatePaymentMethods);
router.post('/billing/upload-qr', qrUpload.single('qrCode'), billingController.uploadQRCode);


router.post('/billing/bank-accounts', billingController.addBankAccount);
router.delete('/billing/bank-accounts/:accountId', billingController.removeBankAccount);


router.get('/billing', billingController.getBillingRecords);
router.get('/billing/stats', billingController.getBillingStats);
router.get('/billing/report', billingController.generateBillingReport);
router.get('/billing/:billingId', billingController.getBillingRecord);
router.post('/billing', billingController.createBillingRecord);
router.put('/billing/:billingId/status', billingController.updateBillingStatus);
router.put('/billing/:billingId/mark-paid', billingController.markAsPaid);


console.log('Complete fixed doctor routes loaded successfully');


module.exports = router;
