// server/src/routes/appointmentRoutes.js - COMPLETE VERSION WITH GOOGLE MEET
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const appointmentController = require('../controllers/appointmentController');
const mongoose = require('mongoose');

// NEW: Google Meet Integration Routes
router.post('/:appointmentId/generate-meeting', protect, appointmentController.generateMeetingLink);
router.get('/:appointmentId/meeting', protect, appointmentController.getMeetingDetails);
router.put('/:appointmentId/meeting', protect, appointmentController.updateMeetingLink);
router.put('/:appointmentId/meeting/end', protect, appointmentController.endMeeting);

// Schedule a new appointment - Updated with payment initialization and Google Meet fields
router.post('/schedule', protect, async (req, res) => {
  try {
    console.log('\n===== SCHEDULING APPOINTMENT WITH PAYMENT INFO =====');
    const { doctorId, appointmentDate, duration, appointmentType, notes } = req.body;
    
    // Check if required fields are provided
    if (!doctorId || !appointmentDate) {
      return res.status(400).json({
        success: false,
        message: 'Doctor ID and appointment date are required'
      });
    }
    
    // Log current tenant information
    console.log('User ID:', req.user ? req.user.id : 'Not set');
    console.log('Tenant ID from request:', req.tenantId || 'Not set');
    
    // Check if tenant connection is FULLY available (with db object)
    const hasTenantConnection = !!(req.tenantConnection && req.tenantConnection.db);
    console.log('Has full tenant connection:', hasTenantConnection ? 'YES' : 'NO');
    
    if (hasTenantConnection) {
      console.log(`Using database: ${req.tenantConnection.db.databaseName}`);
      
      try {
        // 1. Check if doctor exists and get consultation fee
        const usersCollection = req.tenantConnection.db.collection('users');
        
        // Convert doctorId to ObjectId if needed
        let doctorObjectId;
        try {
          doctorObjectId = mongoose.Types.ObjectId.isValid(doctorId) 
            ? new mongoose.Types.ObjectId(doctorId) 
            : doctorId;
        } catch (idError) {
          console.error('Error converting doctorId to ObjectId:', idError);
          doctorObjectId = doctorId; // Use as is if conversion fails
        }
          
        // Find the doctor
        console.log('Looking up doctor with ID:', doctorId);
        const doctor = await usersCollection.findOne({ 
          _id: doctorObjectId
        });
        
        if (!doctor) {
          console.log('Doctor not found in database');
          return res.status(404).json({
            success: false,
            message: 'Doctor not found'
          });
        }
        
        if (doctor.role !== 'doctor') {
          console.log('Found user is not a doctor');
          return res.status(400).json({
            success: false,
            message: 'Selected user is not a doctor'
          });
        }
        
        console.log('Doctor found successfully');
        
        // 2. Get doctor's consultation fee
        const consultationFee = doctor.consultationFee || 0;
        console.log(`Doctor consultation fee: ₱${consultationFee}`);
        
        // 3. Create appointment using direct DB access with PENDING status and payment info
        const appointmentsCollection = req.tenantConnection.db.collection('appointments');
        
        // Prepare appointment data
        const now = new Date();
        
        // Convert patient ID to ObjectId if needed
        let patientObjectId;
        try {
          patientObjectId = mongoose.Types.ObjectId.isValid(req.user.id) 
            ? new mongoose.Types.ObjectId(req.user.id) 
            : req.user.id;
        } catch (idError) {
          console.error('Error converting patientId to ObjectId:', idError);
          patientObjectId = req.user.id; // Use as is if conversion fails
        }
        
        const appointmentData = {
          doctor: doctorObjectId,
          patient: patientObjectId,
          appointmentDate: new Date(appointmentDate),
          duration: duration || 30,
          appointmentType: appointmentType || 'Initial Consultation',
          notes: notes || '',
          status: 'Pending', // Set to Pending - payment required after doctor accepts
          // Payment information
          payment: {
            amount: consultationFee,
            status: 'pending',
            proofOfPayment: null,
            paymentDate: null,
            paymentMethod: null,
            verifiedBy: null,
            verifiedAt: null
          },
          // Google Meet fields (will be populated when doctor accepts)
          meetingLink: null,
          meetingGenerated: false,
          meetingGeneratedAt: null,
          meetingEndedAt: null,
          sessionNotes: '',
          createdAt: now,
          updatedAt: now,
          patientNotified: false
        };
        
        // Add tenantId if we have one
        if (req.tenantId) {
          appointmentData.tenantId = req.tenantId;
        }
        
        console.log('Creating appointment with PENDING status and payment info:', appointmentData);
        
        // Insert the appointment directly
        const result = await appointmentsCollection.insertOne(appointmentData);
        
        if (!result.insertedId) {
          throw new Error('Failed to insert appointment');
        }
        
        console.log('Appointment created successfully with ID:', result.insertedId);
        
        // 4. Update doctor and patient relationship
        console.log('Updating doctor-patient relationship');
        
        // Use $addToSet to prevent duplicates
        await usersCollection.updateOne(
          { _id: patientObjectId },
          { $addToSet: { doctors: doctorObjectId } }
        );
        
        // Update doctor - add patient to list if not already there
        await usersCollection.updateOne(
          { _id: doctorObjectId },
          { $addToSet: { patients: patientObjectId } }
        );
        
        console.log('Doctor-patient relationship updated');
        
        // 5. Emit socket event to notify doctor of new pending appointment
        if (req.io) {
          req.io.emit(`new_appointment_request_${doctorId}`, {
            appointmentId: result.insertedId,
            patientName: `${req.user.firstName || 'Patient'} ${req.user.lastName || ''}`,
            appointmentDate: appointmentData.appointmentDate,
            appointmentType: appointmentData.appointmentType,
            paymentAmount: consultationFee
          });
        }
        
        // 6. Return success with appointment data including payment info
        return res.status(201).json({
          success: true,
          message: 'Appointment request sent successfully. Video session will be available once doctor confirms.',
          data: {
            ...appointmentData,
            _id: result.insertedId
          },
          status: 'Pending',
          paymentRequired: true,
          paymentAmount: consultationFee,
          meetingReady: false
        });
      } catch (directDbError) {
        console.error('Error using direct DB access:', directDbError);
        throw directDbError; // Re-throw to be caught by outer catch
      }
    } else {
      // FALLBACK - Using find/save method since direct DB access is not available
      console.log('Full tenant connection not available, using Find/Save method');
      
      // Try to get models from tenant connection first (if partial connection exists)
      let User, Appointment;
      
      if (req.tenantConnection) {
        try {
          // Try to get models from tenant connection
          User = req.tenantConnection.model('User');
          Appointment = req.tenantConnection.model('Appointment');
          console.log('Using models from tenant connection');
        } catch (modelError) {
          console.error('Error getting models from tenant connection:', modelError);
          // Fall back to default models if tenant models unavailable
          User = require('../models/User');
          Appointment = require('../models/Appointment');
          console.log('Using default models');
        }
      } else {
        // No tenant connection at all
        User = require('../models/User');
        Appointment = require('../models/Appointment');
        console.log('Using default models (no tenant connection)');
      }
      
      try {
        // Look up doctor using lean to skip validation and get consultation fee
        console.log('Looking up doctor with lean query');
        const doctor = await User.findById(doctorId).lean();
        
        if (!doctor || doctor.role !== 'doctor') {
          return res.status(404).json({
            success: false,
            message: 'Doctor not found'
          });
        }
        
        console.log('Doctor found successfully (lean query)');
        
        const consultationFee = doctor.consultationFee || 0;
        console.log(`Doctor consultation fee: ₱${consultationFee}`);
        
        // Create appointment data with PENDING status and payment info
        const appointmentData = {
          doctor: doctorId,
          patient: req.user.id,
          appointmentDate,
          duration: duration || 30,
          appointmentType: appointmentType || 'Initial Consultation',
          notes,
          status: 'Pending', // Set to Pending - payment required after doctor accepts
          // Payment information
          payment: {
            amount: consultationFee,
            status: 'pending',
            proofOfPayment: null,
            paymentDate: null,
            paymentMethod: null,
            verifiedBy: null,
            verifiedAt: null
          },
          // Google Meet fields (will be populated when doctor accepts)
          meetingLink: null,
          meetingGenerated: false,
          meetingGeneratedAt: null,
          meetingEndedAt: null,
          sessionNotes: ''
        };
        
        // Add tenantId if we have one
        if (req.tenantId) {
          appointmentData.tenantId = req.tenantId;
        }
        
        console.log('Creating appointment with PENDING status and payment info:', appointmentData);
        
        // Create appointment document
        const appointment = new Appointment(appointmentData);
        
        // Force tenantId if needed
        if (req.tenantId && !appointment.tenantId) {
          appointment.tenantId = req.tenantId;
        }
        
        // Save with error handling
        await appointment.save();
        console.log('Appointment saved successfully');
        
        // Connect patient and doctor relationships
        await User.updateOne(
          { _id: req.user.id },
          { $addToSet: { doctors: doctorId } }
        );
        
        await User.updateOne(
          { _id: doctorId },
          { $addToSet: { patients: req.user.id } }
        );
        
        console.log('Updated patient-doctor relationship');
        
        // Emit socket event to notify doctor
        if (req.io) {
          req.io.emit(`new_appointment_request_${doctorId}`, {
            appointmentId: appointment._id,
            patientName: `${req.user.firstName || 'Patient'} ${req.user.lastName || ''}`,
            appointmentDate: appointment.appointmentDate,
            appointmentType: appointment.appointmentType,
            paymentAmount: consultationFee
          });
        }
        
        return res.status(201).json({
          success: true,
          message: 'Appointment request sent successfully. Video session will be available once doctor confirms.',
          data: appointment,
          status: 'Pending',
          paymentRequired: true,
          paymentAmount: consultationFee,
          meetingReady: false
        });
      } catch (mongooseError) {
        console.error('Error using Mongoose method:', mongooseError);
        throw mongooseError; // Re-throw to be caught by outer catch
      }
    }
  } catch (error) {
    console.error('Error in scheduling appointment:', error);
    return res.status(500).json({
      success: false,
      message: 'Error scheduling appointment',
      error: error.message
    });
  }
});

// Accept appointment (doctors only) - Updated to generate meeting link
router.put('/:appointmentId/accept', protect, appointmentController.acceptAppointment);

// Decline appointment (doctors only)
router.put('/:appointmentId/decline', protect, appointmentController.declineAppointment);

// Get pending appointments for doctor
router.get('/pending', protect, appointmentController.getPendingAppointments);

// Payment-related routes
router.get('/pending-payments', protect, appointmentController.getPendingPayments);
router.put('/:appointmentId/payment/upload-proof', protect, appointmentController.uploadPaymentProof);
router.put('/:appointmentId/payment/verify', protect, appointmentController.verifyPayment);

// Get appointments by status for current user
router.get('/status/:status', protect, async (req, res) => {
  try {
    const { status } = req.params;
    const validStatuses = ['Pending', 'Scheduled', 'Completed', 'Cancelled', 'Declined', 'No-show'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status provided'
      });
    }
    
    // Use tenant connection if available
    const Appointment = req.tenantConnection ? req.tenantConnection.model('Appointment') : require('../models/Appointment');
    const User = req.tenantConnection ? req.tenantConnection.model('User') : require('../models/User');
    
    // Get user to determine if they're a doctor or patient
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    let query = { status };
    
    // Set query based on user role
    if (user.role === 'doctor') {
      query.doctor = req.user.id;
    } else {
      query.patient = req.user.id;
    }
    
    const appointments = await Appointment.find(query)
      .populate('doctor', 'firstName lastName profilePicture specialty')
      .populate('patient', 'firstName lastName profilePicture')
      .sort({ appointmentDate: 1 });
    
    res.status(200).json({
      success: true,
      data: appointments
    });
    
  } catch (error) {
    console.error('Error getting appointments by status:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting appointments',
      error: error.message
    });
  }
});

// Get all appointments for the logged-in user (patient or doctor)
router.get('/', protect, async (req, res) => {
  try {
    // Use tenant connection if available, fall back to default models if not
    const User = req.tenantConnection ? req.tenantConnection.model('User') : require('../models/User');
    const Appointment = req.tenantConnection ? req.tenantConnection.model('Appointment') : require('../models/Appointment');
    
    console.log(`Using database: ${req.tenantDbName || 'default'} for fetching appointments`);
    
    let appointments;
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Different queries based on role
    if (user.role === 'doctor') {
      // Get all appointments where this user is the doctor
      appointments = await Appointment.find({ doctor: req.user.id })
        .populate('patient', 'firstName lastName email profilePicture')
        .sort({ appointmentDate: 1 });
    } else {
      // Get all appointments where this user is the patient
      appointments = await Appointment.find({ patient: req.user.id })
        .populate('doctor', 'firstName lastName title credentials specialty profilePicture')
        .sort({ appointmentDate: 1 });
    }
    
    return res.status(200).json({
      success: true,
      data: appointments
    });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching appointments',
      error: error.message
    });
  }
});

// Get appointment by ID - Updated to include meeting details
router.get('/:id', protect, appointmentController.getAppointmentById);

// Update appointment status (cancel, complete, etc.)
router.put('/:id/status', protect, async (req, res) => {
  try {
    const { status } = req.body;
    
    // Use tenant connection if available, fall back to default models if not
    const Appointment = req.tenantConnection ? req.tenantConnection.model('Appointment') : require('../models/Appointment');
    
    console.log(`Using database: ${req.tenantDbName || 'default'} for updating appointment status`);
    
    if (!status || !['Pending', 'Scheduled', 'Completed', 'Cancelled', 'Declined', 'No-show'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required'
      });
    }
    
    const appointment = await Appointment.findById(req.params.id);
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }
    
    // Check if the logged-in user is either the doctor or patient for this appointment
    if (
      appointment.doctor.toString() !== req.user.id &&
      appointment.patient.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this appointment'
      });
    }
    
    // Additional restriction: only doctors can mark as completed or no-show
    if (
      ['Completed', 'No-show'].includes(status) &&
      appointment.doctor.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: 'Only doctors can mark appointments as completed or no-show'
      });
    }
    
    appointment.status = status;
    
    // If marking as completed, also record meeting end time
    if (status === 'Completed' && !appointment.meetingEndedAt) {
      appointment.meetingEndedAt = new Date();
    }
    
    await appointment.save();
    
    return res.status(200).json({
      success: true,
      message: 'Appointment status updated successfully',
      data: appointment
    });
  } catch (error) {
    console.error('Error updating appointment status:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating appointment status',
      error: error.message
    });
  }
});

// Reschedule appointment
router.put('/:id/reschedule', protect, async (req, res) => {
  try {
    const { appointmentDate } = req.body;
    
    // Use tenant connection if available, fall back to default models if not
    const Appointment = req.tenantConnection ? req.tenantConnection.model('Appointment') : require('../models/Appointment');
    
    console.log(`Using database: ${req.tenantDbName || 'default'} for rescheduling appointment`);
    
    if (!appointmentDate) {
      return res.status(400).json({
        success: false,
        message: 'New appointment date is required'
      });
    }
    
    const appointment = await Appointment.findById(req.params.id);
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }
    
    // Check if the logged-in user is either the doctor or patient for this appointment
    if (
      appointment.doctor.toString() !== req.user.id &&
      appointment.patient.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to reschedule this appointment'
      });
    }
    
    // Only allow rescheduling of upcoming appointments
    if (appointment.status !== 'Scheduled') {
      return res.status(400).json({
        success: false,
        message: 'Only scheduled appointments can be rescheduled'
      });
    }
    
    appointment.appointmentDate = appointmentDate;
    await appointment.save();
    
    return res.status(200).json({
      success: true,
      message: 'Appointment rescheduled successfully',
      data: appointment
    });
  } catch (error) {
    console.error('Error rescheduling appointment:', error);
    return res.status(500).json({
      success: false,
      message: 'Error rescheduling appointment',
      error: error.message
    });
  }
});

// Get user appointments with meeting info
router.get('/users/:userId/appointments', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.query;
    
    // Use tenant connection if available, fall back to default models if not
    const Appointment = req.tenantConnection ? req.tenantConnection.model('Appointment') : require('../models/Appointment');
    
    console.log(`Using database: ${req.tenantDbName || 'default'} for fetching user appointments`);
    
    // Build query
    const query = { patient: userId };
    
    // Add status filter if provided
    if (status === 'upcoming') {
      query.appointmentDate = { $gte: new Date() };
      query.status = { $in: ['Scheduled'] };
    } else if (status) {
      query.status = status;
    }
    
    // Get appointments with meeting info
    const appointments = await Appointment.find(query)
      .populate('doctor', 'firstName lastName profilePicture specialization')
      .sort({ appointmentDate: 1 })
      .lean();
    
    // Add meeting readiness info
    const appointmentsWithMeetingInfo = appointments.map(appointment => ({
      ...appointment,
      meetingReady: appointment.status === 'Scheduled' && !!appointment.meetingLink,
      hasMeeting: !!appointment.meetingLink
    }));
    
    // Return appointments
    res.status(200).json(appointmentsWithMeetingInfo);
  } catch (error) {
    console.error(`Error getting user appointments: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get user appointments',
      error: error.message
    });
  }
});

module.exports = router;