// server/src/routes/doctorRoutes.js - COMPLETE VERSION WITH PROFILE PICTURE UPLOAD
const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const journalController = require('../controllers/journalController');
const billingController = require('../controllers/billingController');
const { protect, restrictTo } = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenantMiddleware');
const multer = require('multer');

// 🆕 NEW: Import Cloudinary functions for profile picture upload
const { uploadToCloudinary, deleteCloudinaryImage, extractPublicId } = require('../services/cloudinary');

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

// Configure multer for QR code uploads
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

// 🆕 NEW: Configure multer for profile picture uploads
const profilePictureUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
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

// 🆕 NEW: Doctor profile management routes (added before other doctor-only routes)
router.get('/profile', doctorController.getCurrentDoctorProfile);
router.put('/profile', doctorController.updateDoctorProfile);

// 🆕 NEW: Profile picture upload routes
router.post('/profile/upload-picture', profilePictureUpload.single('profilePicture'), async (req, res) => {
  try {
    console.log('=== DOCTOR PROFILE PICTURE UPLOAD ===');
    console.log('Doctor ID:', req.user?.id || req.user?._id);
    console.log('File received:', !!req.file);

    const doctorId = req.user?.id || req.user?._id;

    if (!doctorId) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    console.log('File details:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    // Get current doctor to check for existing profile picture
    let currentDoctor = null;

    // Try to get doctor from tenant connection first
    if (req.tenantConnection) {
      try {
        const User = req.tenantConnection.model('User');
        currentDoctor = await User.findById(doctorId).select('profilePicture firstName lastName');
      } catch (tenantError) {
        console.error('Tenant doctor lookup failed:', tenantError.message);
      }
    }

    // Fallback to default database
    if (!currentDoctor) {
      try {
        const User = require('../models/User');
        currentDoctor = await User.findById(doctorId).select('profilePicture firstName lastName');
      } catch (defaultError) {
        console.error('Default database doctor lookup failed:', defaultError.message);
      }
    }

    if (!currentDoctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    // Upload new image to Cloudinary
    console.log('📤 Uploading doctor profile picture to Cloudinary...');
    const uploadOptions = {
      folder: `${process.env.CLOUDINARY_FOLDER || 'neurolex'}/doctors/profile_pictures`,
      public_id: `doctor_${doctorId}_${Date.now()}`,
      overwrite: true,
      transformation: [
        { width: 400, height: 400, crop: 'fill', gravity: 'face' },
        { quality: 'auto:good' },
        { fetch_format: 'auto' }
      ]
    };

    const uploadResult = await uploadToCloudinary(req.file.buffer, uploadOptions);
    
    if (!uploadResult || !uploadResult.secure_url) {
      return res.status(500).json({
        success: false,
        message: 'Failed to upload image to cloud storage'
      });
    }

    console.log('✅ Image uploaded successfully:', uploadResult.secure_url);

    // Update doctor profile picture in database
    const updateData = {
      profilePicture: uploadResult.secure_url,
      updatedAt: new Date()
    };

    let updatedDoctor = null;

    // Try tenant connection first
    if (req.tenantConnection) {
      try {
        if (req.tenantConnection.db) {
          // Direct collection update
          const usersCollection = req.tenantConnection.db.collection('users');
          const mongoose = require('mongoose');
          
          const doctorObjectId = mongoose.Types.ObjectId.isValid(doctorId)
            ? new mongoose.Types.ObjectId(doctorId)
            : doctorId;

          const updateResult = await usersCollection.updateOne(
            { _id: doctorObjectId },
            { $set: updateData }
          );

          if (updateResult.modifiedCount > 0) {
            updatedDoctor = await usersCollection.findOne(
              { _id: doctorObjectId },
              { projection: { password: 0 } }
            );
            console.log('✅ Doctor profile picture updated via tenant connection');
          }
        }

        if (!updatedDoctor) {
          const User = req.tenantConnection.model('User');
          updatedDoctor = await User.findByIdAndUpdate(
            doctorId,
            { $set: updateData },
            { new: true, runValidators: true }
          ).select('-password').lean();
        }
      } catch (tenantError) {
        console.error('Tenant update failed:', tenantError.message);
      }
    }

    // Fallback to default database
    if (!updatedDoctor) {
      try {
        const User = require('../models/User');
        updatedDoctor = await User.findByIdAndUpdate(
          doctorId,
          { $set: updateData },
          { new: true, runValidators: true }
        ).select('-password').lean();
        
        if (updatedDoctor) {
          console.log('✅ Doctor profile picture updated via default database');
        }
      } catch (defaultError) {
        console.error('Default database update failed:', defaultError.message);
      }
    }

    if (!updatedDoctor) {
      // If database update failed, try to clean up uploaded image
      try {
        await deleteCloudinaryImage(uploadResult.public_id);
      } catch (cleanupError) {
        console.error('Failed to cleanup uploaded image:', cleanupError.message);
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to update profile picture in database'
      });
    }

    // Clean up old profile picture from Cloudinary (optional, run in background)
    if (currentDoctor.profilePicture && currentDoctor.profilePicture !== uploadResult.secure_url) {
      try {
        const oldPublicId = extractPublicId(currentDoctor.profilePicture);
        if (oldPublicId) {
          // Don't await this - run in background
          deleteCloudinaryImage(oldPublicId).catch(err => {
            console.error('Failed to delete old profile picture:', err.message);
          });
        }
      } catch (cleanupError) {
        console.error('Error extracting old image public ID:', cleanupError.message);
      }
    }

    console.log('✅ Doctor profile picture upload completed successfully');

    return res.status(200).json({
      success: true,
      message: 'Profile picture updated successfully',
      data: {
        profilePicture: uploadResult.secure_url,
        doctor: updatedDoctor
      }
    });

  } catch (error) {
    console.error('❌ Error in doctor profile picture upload:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload profile picture',
      error: error.message
    });
  }
});

// 🆕 NEW: Delete profile picture route
router.delete('/profile/delete-picture', async (req, res) => {
  try {
    console.log('=== DELETE DOCTOR PROFILE PICTURE ===');
    console.log('Doctor ID:', req.user?.id || req.user?._id);

    const doctorId = req.user?.id || req.user?._id;

    if (!doctorId) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    // Get current doctor to find existing profile picture
    let currentDoctor = null;

    // Try to get doctor from tenant connection first
    if (req.tenantConnection) {
      try {
        const User = req.tenantConnection.model('User');
        currentDoctor = await User.findById(doctorId).select('profilePicture firstName lastName');
      } catch (tenantError) {
        console.error('Tenant doctor lookup failed:', tenantError.message);
      }
    }

    // Fallback to default database
    if (!currentDoctor) {
      try {
        const User = require('../models/User');
        currentDoctor = await User.findById(doctorId).select('profilePicture firstName lastName');
      } catch (defaultError) {
        console.error('Default database doctor lookup failed:', defaultError.message);
      }
    }

    if (!currentDoctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    // Check if doctor has a profile picture to delete
    if (!currentDoctor.profilePicture) {
      return res.status(400).json({
        success: false,
        message: 'No profile picture to delete'
      });
    }

    console.log('🗑️ Deleting doctor profile picture:', currentDoctor.profilePicture);

    // Remove profile picture from database first
    const updateData = {
      profilePicture: null,
      updatedAt: new Date()
    };

    let updatedDoctor = null;

    // Try tenant connection first
    if (req.tenantConnection) {
      try {
        if (req.tenantConnection.db) {
          // Direct collection update
          const usersCollection = req.tenantConnection.db.collection('users');
          const mongoose = require('mongoose');
          
          const doctorObjectId = mongoose.Types.ObjectId.isValid(doctorId)
            ? new mongoose.Types.ObjectId(doctorId)
            : doctorId;

          const updateResult = await usersCollection.updateOne(
            { _id: doctorObjectId },
            { $set: updateData }
          );

          if (updateResult.modifiedCount > 0) {
            updatedDoctor = await usersCollection.findOne(
              { _id: doctorObjectId },
              { projection: { password: 0 } }
            );
            console.log('✅ Doctor profile picture removed via tenant connection');
          }
        }

        if (!updatedDoctor) {
          const User = req.tenantConnection.model('User');
          updatedDoctor = await User.findByIdAndUpdate(
            doctorId,
            { $set: updateData },
            { new: true, runValidators: true }
          ).select('-password').lean();
        }
      } catch (tenantError) {
        console.error('Tenant update failed:', tenantError.message);
      }
    }

    // Fallback to default database
    if (!updatedDoctor) {
      try {
        const User = require('../models/User');
        updatedDoctor = await User.findByIdAndUpdate(
          doctorId,
          { $set: updateData },
          { new: true, runValidators: true }
        ).select('-password').lean();
        
        if (updatedDoctor) {
          console.log('✅ Doctor profile picture removed via default database');
        }
      } catch (defaultError) {
        console.error('Default database update failed:', defaultError.message);
      }
    }

    if (!updatedDoctor) {
      return res.status(500).json({
        success: false,
        message: 'Failed to remove profile picture from database'
      });
    }

    // Delete image from Cloudinary (run in background, don't fail if this fails)
    try {
      const oldPublicId = extractPublicId(currentDoctor.profilePicture);
      if (oldPublicId) {
        // Run deletion in background - don't await
        deleteCloudinaryImage(oldPublicId).then(result => {
          console.log('✅ Old doctor profile picture deleted from Cloudinary:', result);
        }).catch(error => {
          console.error('❌ Failed to delete image from Cloudinary:', error.message);
          // Don't fail the request if Cloudinary deletion fails
        });
      }
    } catch (cleanupError) {
      console.error('Error extracting public ID for deletion:', cleanupError.message);
      // Don't fail the request if we can't extract the public ID
    }

    console.log('✅ Doctor profile picture deletion completed successfully');

    return res.status(200).json({
      success: true,
      message: 'Profile picture deleted successfully',
      data: {
        profilePicture: null,
        doctor: updatedDoctor
      }
    });

  } catch (error) {
    console.error('❌ Error in doctor profile picture deletion:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete profile picture',
      error: error.message
    });
  }
});

// Other doctor-only routes (EXISTING - unchanged)
router.get('/dashboard/stats', doctorController.getDashboardStats);
router.get('/patients', doctorController.getPatients);
router.delete('/patients/:patientId/end-care', doctorController.endPatientCare);
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

// ✅ FIXED: AI Analysis and Notes routes (corrected URL structure)
router.post('/journal-entries/:id/analyze', journalController.analyzeJournalEntry || doctorController.analyzeJournalEntry);
router.post('/journal-entries/:id/notes', journalController.addDoctorNoteToJournalEntry || doctorController.addNoteToJournalEntry);

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
// NEW APPOINTMENT MANAGEMENT ROUTES
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
// BILLING ROUTES
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

// 🆕 NEW: Add error handling middleware for multer errors (profile picture uploads)
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 5MB.'
      });
    }
  }
  
  if (error.message === 'Only image files are allowed!' || error.message === 'Only image files are allowed for QR codes') {
    return res.status(400).json({
      success: false,
      message: 'Invalid file type. Only image files are allowed.'
    });
  }
  
  next(error);
});

console.log('Complete doctor routes with billing functionality, appointment management, and profile picture upload loaded successfully');

module.exports = router;