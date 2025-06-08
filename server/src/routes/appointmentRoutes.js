// server/src/routes/appointmentRoutes.js - UPDATED VERSION WITH MEETING LINKS

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const appointmentController = require('../controllers/appointmentController');
const mongoose = require('mongoose');

// ✅ ADD: Import the Jitsi Meet service
const JitsiMeetService = require('../services/jitsiMeetService');

console.log('Loading appointment routes with Jitsi Meet integration...');

// Basic test route
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Appointment routes working',
    timestamp: new Date()
  });
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

// Schedule a new appointment - SIMPLIFIED VERSION
router.post('/schedule', protect, async (req, res) => {
  try {
    console.log('Scheduling appointment...');
    const { doctorId, appointmentDate, duration, appointmentType, notes } = req.body;
    
    // Check if required fields are provided
    if (!doctorId || !appointmentDate) {
      return res.status(400).json({
        success: false,
        message: 'Doctor ID and appointment date are required'
      });
    }
    
    // Use tenant connection if available, fall back to default models if not
    const User = req.tenantConnection ? req.tenantConnection.model('User') : require('../models/User');
    const Appointment = req.tenantConnection ? req.tenantConnection.model('Appointment') : require('../models/Appointment');
    
    // Look up doctor
    const doctor = await User.findById(doctorId).lean();
    
    if (!doctor || doctor.role !== 'doctor') {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }
    
    const consultationFee = doctor.consultationFee || 0;
    
    // Create appointment data
    const appointmentData = {
      doctor: doctorId,
      patient: req.user.id,
      appointmentDate,
      duration: duration || 30,
      appointmentType: appointmentType || 'Initial Consultation',
      notes: notes || '',
      status: 'Pending',
      payment: {
        amount: consultationFee,
        status: 'pending'
      }
    };
    
    // Add tenantId if available
    if (req.tenantId) {
      appointmentData.tenantId = req.tenantId;
    }
    
    // Create appointment
    const appointment = new Appointment(appointmentData);
    await appointment.save();
    
    // Update relationships
    await User.updateOne(
      { _id: req.user.id },
      { $addToSet: { doctors: doctorId } }
    );
    
    await User.updateOne(
      { _id: doctorId },
      { $addToSet: { patients: req.user.id } }
    );
    
    return res.status(201).json({
      success: true,
      message: 'Appointment request sent successfully',
      data: appointment,
      paymentAmount: consultationFee
    });
    
  } catch (error) {
    console.error('Error scheduling appointment:', error);
    return res.status(500).json({
      success: false,
      message: 'Error scheduling appointment',
      error: error.message
    });
  }
});

// Get pending appointments for doctor
router.get('/pending', protect, async (req, res) => {
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

// ✅ FIXED: Accept appointment and generate Jitsi meeting link
router.put('/accept/:id', protect, async (req, res) => {
  try {
    const Appointment = req.tenantConnection ? req.tenantConnection.model('Appointment') : require('../models/Appointment');
    
    const appointment = await Appointment.findById(req.params.id)
      .populate('patient', 'firstName lastName email profilePicture')
      .populate('doctor', 'firstName lastName title credentials specialty profilePicture');
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }
    
    // Check if user is the doctor for this appointment
    if (appointment.doctor._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }
    
    // Update appointment status
    appointment.status = 'Scheduled';
    
    // ✅ CRITICAL FIX: Generate Jitsi meeting link
    try {
      console.log('🎥 Generating Jitsi meeting link for appointment:', appointment._id);
      
      const jitsiService = new JitsiMeetService();
      const meetingResult = jitsiService.createNoWaitMeetingRoom({
        _id: appointment._id,
        appointmentDate: appointment.appointmentDate,
        duration: appointment.duration,
        appointmentType: appointment.appointmentType,
        doctor: appointment.doctor,
        patient: appointment.patient
      });
      
      // Update appointment with meeting details
      appointment.meetingLink = meetingResult.meetingLink;
      appointment.meetingGenerated = true;
      appointment.meetingGeneratedAt = new Date();
      appointment.meetingType = 'jitsi';
      appointment.roomName = meetingResult.roomName;
      
      console.log('✅ Successfully generated meeting link:', meetingResult.meetingLink);
      
    } catch (meetingError) {
      console.error('⚠️ Failed to generate meeting link, using fallback method:', meetingError);
      
      // ✅ FALLBACK: Use the built-in generateMeetingLink method from schema
      const fallbackLink = appointment.generateMeetingLink('jitsi');
      console.log('✅ Fallback meeting link generated:', fallbackLink);
    }
    
    // Add doctor response information
    appointment.doctorResponse = {
      responseDate: new Date(),
      responseMessage: req.body.responseMessage || 'Appointment accepted. Video meeting room is ready.'
    };
    
    await appointment.save();
    
    console.log('✅ Appointment accepted with meeting link:', appointment.meetingLink);
    
    res.status(200).json({
      success: true,
      message: 'Appointment accepted and meeting link generated',
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

// Decline appointment (basic version)
router.put('/decline/:id', protect, async (req, res) => {
  try {
    const Appointment = req.tenantConnection ? req.tenantConnection.model('Appointment') : require('../models/Appointment');
    
    const appointment = await Appointment.findById(req.params.id);
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }
    
    // Check if user is the doctor for this appointment
    if (appointment.doctor.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }
    
    appointment.status = 'Declined';
    
    // Add doctor response information
    appointment.doctorResponse = {
      responseDate: new Date(),
      responseMessage: req.body.responseMessage || 'Appointment declined'
    };
    
    await appointment.save();
    
    res.status(200).json({
      success: true,
      message: 'Appointment declined',
      data: appointment
    });
  } catch (error) {
    console.error('Error declining appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Error declining appointment',
      error: error.message
    });
  }
});

// Get appointment by ID
router.get('/details/:id', protect, async (req, res) => {
  try {
    const Appointment = req.tenantConnection ? req.tenantConnection.model('Appointment') : require('../models/Appointment');
    
    const appointment = await Appointment.findById(req.params.id)
      .populate('doctor', 'firstName lastName title credentials specialty profilePicture')
      .populate('patient', 'firstName lastName email profilePicture');
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }
    
    // Check if user is either doctor or patient
    if (
      appointment.doctor._id.toString() !== req.user.id &&
      appointment.patient._id.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }
    
    // ✅ Auto-generate meeting link if appointment is scheduled but no link exists
    if (appointment.status === 'Scheduled' && !appointment.meetingLink) {
      try {
        console.log('🔄 Auto-generating missing meeting link for appointment:', appointment._id);
        
        const jitsiService = new JitsiMeetService();
        const meetingResult = jitsiService.createNoWaitMeetingRoom({
          _id: appointment._id,
          appointmentDate: appointment.appointmentDate,
          duration: appointment.duration,
          appointmentType: appointment.appointmentType,
          doctor: appointment.doctor,
          patient: appointment.patient
        });
        
        appointment.meetingLink = meetingResult.meetingLink;
        appointment.meetingGenerated = true;
        appointment.meetingGeneratedAt = new Date();
        appointment.meetingType = 'jitsi';
        appointment.roomName = meetingResult.roomName;
        
        await appointment.save();
        console.log('✅ Auto-generated meeting link:', meetingResult.meetingLink);
        
      } catch (meetingError) {
        console.error('⚠️ Failed to auto-generate meeting link:', meetingError);
        // Try fallback method
        try {
          const fallbackLink = appointment.generateMeetingLink('jitsi');
          await appointment.save();
          console.log('✅ Fallback meeting link generated:', fallbackLink);
        } catch (fallbackError) {
          console.error('❌ Fallback method also failed:', fallbackError);
        }
      }
    }
    
    res.status(200).json({
      success: true,
      data: appointment
    });
  } catch (error) {
    console.error('Error getting appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting appointment',
      error: error.message
    });
  }
});

// ✅ NEW: Get meeting link for specific appointment
router.get('/meeting/:id', protect, async (req, res) => {
  try {
    const Appointment = req.tenantConnection ? req.tenantConnection.model('Appointment') : require('../models/Appointment');
    
    const appointment = await Appointment.findById(req.params.id)
      .populate('doctor', 'firstName lastName title')
      .populate('patient', 'firstName lastName');
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }
    
    // Check if user is either doctor or patient
    if (
      appointment.doctor._id.toString() !== req.user.id &&
      appointment.patient._id.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }
    
    // Check if appointment is scheduled
    if (appointment.status !== 'Scheduled') {
      return res.status(400).json({
        success: false,
        message: 'Appointment is not scheduled yet'
      });
    }
    
    // Generate meeting link if it doesn't exist
    if (!appointment.meetingLink) {
      try {
        const jitsiService = new JitsiMeetService();
        const meetingResult = jitsiService.createNoWaitMeetingRoom({
          _id: appointment._id,
          appointmentDate: appointment.appointmentDate,
          duration: appointment.duration,
          appointmentType: appointment.appointmentType,
          doctor: appointment.doctor,
          patient: appointment.patient
        });
        
        appointment.meetingLink = meetingResult.meetingLink;
        appointment.meetingGenerated = true;
        appointment.meetingGeneratedAt = new Date();
        appointment.meetingType = 'jitsi';
        appointment.roomName = meetingResult.roomName;
        
        await appointment.save();
      } catch (error) {
        console.error('Error generating meeting link:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to generate meeting link'
        });
      }
    }
    
    res.status(200).json({
      success: true,
      data: {
        meetingLink: appointment.meetingLink,
        roomName: appointment.roomName,
        meetingType: appointment.meetingType,
        appointmentDate: appointment.appointmentDate,
        platform: 'Jitsi Meet'
      }
    });
    
  } catch (error) {
    console.error('Error getting meeting link:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting meeting link',
      error: error.message
    });
  }
});

console.log('Appointment routes with Jitsi Meet integration loaded successfully');

module.exports = router;