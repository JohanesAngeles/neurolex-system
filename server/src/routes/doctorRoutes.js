// server/src/routes/doctorRoutes.js - COMPLETE VERSION WITH BILLING ROUTES + APPOINTMENT MANAGEMENT + END CARE
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

// ============================================================================
// APPOINTMENT ROUTES - EXISTING + NEW MANAGEMENT ROUTES
// ============================================================================
console.log('Loading appointment routes...');

// Simplified appointment routes for doctors (EXISTING)
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
// NEW APPOINTMENT MANAGEMENT ROUTES - THESE WERE MISSING!
// ============================================================================
console.log('Adding appointment management routes...');

// Accept appointment
router.put('/accept/:id', async (req, res) => {
  try {
    const { responseMessage } = req.body;
    console.log(`🎉 Doctor ${req.user.id} accepting appointment: ${req.params.id}`);
    
    const Appointment = req.tenantConnection ? req.tenantConnection.model('Appointment') : require('../models/Appointment');
    
    const appointment = await Appointment.findById(req.params.id)
      .populate('patient', 'firstName lastName email')
      .populate('doctor', 'firstName lastName email');
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }
    
    // Check if the logged-in doctor owns this appointment
    if (appointment.doctor._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to modify this appointment'
      });
    }
    
    // Check if appointment is in pending status
    if (appointment.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot accept appointment with status: ${appointment.status}`
      });
    }
    
    // Update appointment status to Scheduled
    appointment.status = 'Scheduled';
    appointment.doctorResponse = {
      responseDate: new Date(),
      responseMessage: responseMessage || 'Appointment confirmed'
    };
    appointment.patientNotified = false;
    
    await appointment.save();
    
    console.log(`✅ Appointment ${req.params.id} accepted successfully`);
    
    res.status(200).json({
      success: true,
      message: 'Appointment accepted successfully',
      data: appointment
    });
    
  } catch (error) {
    console.error('❌ Error accepting appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Error accepting appointment',
      error: error.message
    });
  }
});

// Decline appointment
router.put('/decline/:id', async (req, res) => {
  try {
    const { responseMessage } = req.body;
    console.log(`❌ Doctor ${req.user.id} declining appointment: ${req.params.id}`);
    
    const Appointment = req.tenantConnection ? req.tenantConnection.model('Appointment') : require('../models/Appointment');
    
    const appointment = await Appointment.findById(req.params.id)
      .populate('patient', 'firstName lastName email')
      .populate('doctor', 'firstName lastName email');
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }
    
    // Check if the logged-in doctor owns this appointment
    if (appointment.doctor._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to modify this appointment'
      });
    }
    
    // Check if appointment is in pending status
    if (appointment.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot decline appointment with status: ${appointment.status}`
      });
    }
    
    // Update appointment status to Declined
    appointment.status = 'Declined';
    appointment.doctorResponse = {
      responseDate: new Date(),
      responseMessage: responseMessage || 'Appointment declined'
    };
    appointment.patientNotified = false;
    
    await appointment.save();
    
    console.log(`✅ Appointment ${req.params.id} declined successfully`);
    
    res.status(200).json({
      success: true,
      message: 'Appointment declined successfully',
      data: appointment
    });
    
  } catch (error) {
    console.error('❌ Error declining appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Error declining appointment',
      error: error.message
    });
  }
});

// Reschedule appointment
router.put('/appointments/:id/reschedule', async (req, res) => {
  try {
    const { appointmentDate } = req.body;
    console.log(`📅 Doctor ${req.user.id} rescheduling appointment: ${req.params.id}`);
    
    if (!appointmentDate) {
      return res.status(400).json({
        success: false,
        message: 'New appointment date is required'
      });
    }
    
    const Appointment = req.tenantConnection ? req.tenantConnection.model('Appointment') : require('../models/Appointment');
    
    const appointment = await Appointment.findById(req.params.id);
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }
    
    // Check if the logged-in doctor owns this appointment
    if (appointment.doctor.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to reschedule this appointment'
      });
    }
    
    // Only allow rescheduling of scheduled appointments
    if (appointment.status !== 'Scheduled') {
      return res.status(400).json({
        success: false,
        message: 'Only scheduled appointments can be rescheduled'
      });
    }
    
    appointment.appointmentDate = appointmentDate;
    await appointment.save();
    
    console.log(`✅ Appointment ${req.params.id} rescheduled successfully`);
    
    res.status(200).json({
      success: true,
      message: 'Appointment rescheduled successfully',
      data: appointment
    });
    
  } catch (error) {
    console.error('❌ Error rescheduling appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Error rescheduling appointment',
      error: error.message
    });
  }
});

// Update appointment status
router.put('/appointments/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    console.log(`🔄 Doctor ${req.user.id} updating appointment ${req.params.id} status to: ${status}`);
    
    if (!status || !['Scheduled', 'Completed', 'Cancelled', 'No-show'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required (Scheduled, Completed, Cancelled, No-show)'
      });
    }
    
    const Appointment = req.tenantConnection ? req.tenantConnection.model('Appointment') : require('../models/Appointment');
    
    const appointment = await Appointment.findById(req.params.id);
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }
    
    // Check if the logged-in doctor owns this appointment
    if (appointment.doctor.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this appointment'
      });
    }
    
    appointment.status = status;
    
    // If marking as completed, also record meeting end time
    if (status === 'Completed' && !appointment.meetingEndedAt) {
      appointment.meetingEndedAt = new Date();
    }
    
    await appointment.save();
    
    console.log(`✅ Appointment ${req.params.id} status updated to ${status}`);
    
    res.status(200).json({
      success: true,
      message: 'Appointment status updated successfully',
      data: appointment
    });
    
  } catch (error) {
    console.error('❌ Error updating appointment status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating appointment status',
      error: error.message
    });
  }
});

console.log('Appointment management routes added successfully');

// ============================================================================
// END OF APPOINTMENT MANAGEMENT ROUTES
// ============================================================================

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

console.log('Complete doctor routes with billing functionality and appointment management loaded successfully');

module.exports = router;