// server/src/controllers/appointmentController.js - COMPLETE FULL VERSION
const { ObjectId } = require('mongoose').Types;
const mongoose = require('mongoose');

// ✅ ADD: Import Jitsi service for video conferencing
const JitsiMeetService = require('../services/jitsiMeetService');

/**
 * ✅ FIXED: Accept appointment with Jitsi Meet room creation
 * This replaces your duplicate acceptAppointment functions
 */
exports.acceptAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { responseMessage } = req.body;
    
    console.log(`🎉 Doctor ${req.user.id} accepting appointment with Jitsi: ${appointmentId}`);
    
    // Use tenant connection if available
    const Appointment = req.tenantConnection ? req.tenantConnection.model('Appointment') : require('../models/Appointment');
    
    // Find the appointment
    const appointment = await Appointment.findById(appointmentId)
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
    
    let meetingResult = null;
    
    try {
      // ✅ TRY MULTIPLE METHODS to create Jitsi room
      console.log('🎥 Creating Jitsi Meet room with fallback methods...');
      
      const jitsiService = new JitsiMeetService();
      
      // Method 1: Try no-wait room creation
      try {
        meetingResult = jitsiService.createNoWaitMeetingRoom({
          _id: appointment._id,
          appointmentDate: appointment.appointmentDate,
          duration: appointment.duration,
          appointmentType: appointment.appointmentType,
          doctor: appointment.doctor,
          patient: appointment.patient
        });
        console.log('✅ Method 1 (no-wait) successful:', meetingResult.meetingLink);
      } catch (error) {
        console.log('⚠️  Method 1 (no-wait) failed, trying method 2...');
        
        // Method 2: Try anonymous room creation
        try {
          meetingResult = jitsiService.createAnonymousMeetingRoom({
            _id: appointment._id,
            appointmentDate: appointment.appointmentDate,
            duration: appointment.duration,
            appointmentType: appointment.appointmentType,
            doctor: appointment.doctor,
            patient: appointment.patient
          });
          console.log('✅ Method 2 (anonymous) successful:', meetingResult.meetingLink);
        } catch (error2) {
          console.log('⚠️  Method 2 (anonymous) failed, trying method 3...');
          
          // Method 3: Try simple room creation
          meetingResult = jitsiService.createSimpleMeetingRoom({
            _id: appointment._id,
            appointmentDate: appointment.appointmentDate,
            duration: appointment.duration,
            appointmentType: appointment.appointmentType,
            doctor: appointment.doctor,
            patient: appointment.patient
          });
          console.log('✅ Method 3 (simple) successful:', meetingResult.meetingLink);
        }
      }
      
      // Update appointment status to Scheduled
      appointment.status = 'Scheduled';
      appointment.doctorResponse = {
        responseDate: new Date(),
        responseMessage: responseMessage || 'Appointment confirmed. Video meeting room is ready.'
      };
      appointment.patientNotified = false;
      
      // ✅ Store REAL Jitsi meeting data
      appointment.meetingLink = meetingResult.meetingLink;
      appointment.meetingGenerated = true;
      appointment.meetingGeneratedAt = new Date();
      appointment.meetingType = 'jitsi';
      appointment.roomName = meetingResult.roomName;
      
      await appointment.save();
      
      console.log('✅ Jitsi Meet room created successfully:', meetingResult.meetingLink);
      console.log('✅ Room features:', {
        noAuthRequired: meetingResult.noAuthRequired || false,
        anonymous: meetingResult.anonymous || false,
        simple: meetingResult.simple || false
      });
      
      // Emit socket event for real-time notification
      if (req.io) {
        req.io.emit(`appointment_accepted_${appointment.patient._id}`, {
          appointmentId: appointment._id,
          doctorName: `Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}`,
          appointmentDate: appointment.appointmentDate,
          message: appointment.doctorResponse.responseMessage,
          meetingLink: appointment.meetingLink,
          meetingType: 'jitsi',
          platform: 'Jitsi Meet'
        });
      }
      
      console.log(`✅ Appointment ${appointmentId} accepted successfully with Jitsi Meet room`);
      
      res.status(200).json({
        success: true,
        message: 'Appointment accepted successfully with video meeting room (no authentication required)',
        data: {
          ...appointment.toObject(),
          meetingReady: true,
          meetingType: 'jitsi',
          platform: 'Jitsi Meet',
          authenticationRequired: false
        }
      });
      
    } catch (meetingError) {
      console.error('❌ All Jitsi Meet room creation methods failed:', meetingError);
      
      // FALLBACK: Accept appointment without video room
      appointment.status = 'Scheduled';
      appointment.doctorResponse = {
        responseDate: new Date(),
        responseMessage: responseMessage || 'Appointment confirmed. Video setup in progress.'
      };
      appointment.patientNotified = false;
      
      await appointment.save();
      
      res.status(200).json({
        success: true,
        message: 'Appointment accepted but video room setup failed. Please contact support.',
        data: {
          ...appointment.toObject(),
          meetingReady: false,
          meetingError: meetingError.message
        },
        warning: 'Video room creation failed'
      });
    }
    
  } catch (error) {
    console.error('❌ Error accepting appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Error accepting appointment',
      error: error.message
    });
  }
};

/**
 * ✅ FIXED: Generate meeting link using Jitsi Meet (not fake Google Meet)
 */
exports.generateMeetingLink = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    
    console.log(`🎥 Generating Jitsi meeting link for appointment ${appointmentId}`);
    
    // Use tenant connection if available
    const Appointment = req.tenantConnection ? req.tenantConnection.model('Appointment') : require('../models/Appointment');
    
    // Find the appointment
    const appointment = await Appointment.findById(appointmentId)
      .populate('doctor', 'firstName lastName')
      .populate('patient', 'firstName lastName');
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }
    
    // Check if user is authorized (either doctor or patient)
    if (
      appointment.doctor._id.toString() !== req.user.id &&
      appointment.patient._id.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to generate meeting link for this appointment'
      });
    }
    
    // Only generate for scheduled appointments
    if (appointment.status !== 'Scheduled') {
      return res.status(400).json({
        success: false,
        message: 'Meeting links can only be generated for scheduled appointments'
      });
    }
    
    // If meeting already exists, return it
    if (appointment.meetingLink && appointment.meetingGenerated) {
      return res.status(200).json({
        success: true,
        message: 'Meeting link already exists',
        data: {
          meetingLink: appointment.meetingLink,
          appointmentId: appointment._id,
          appointmentDate: appointment.appointmentDate,
          meetingType: appointment.meetingType || 'jitsi',
          platform: 'Jitsi Meet',
          existing: true
        }
      });
    }
    
    try {
      // Create new Jitsi Meet room
      const jitsiService = new JitsiMeetService();
      const meetingResult = jitsiService.createNoWaitMeetingRoom({
        _id: appointment._id,
        appointmentDate: appointment.appointmentDate,
        duration: appointment.duration,
        appointmentType: appointment.appointmentType,
        doctor: appointment.doctor,
        patient: appointment.patient
      });
      
      // Update appointment with meeting data
      appointment.meetingLink = meetingResult.meetingLink;
      appointment.meetingGenerated = true;
      appointment.meetingGeneratedAt = new Date();
      appointment.meetingType = 'jitsi';
      appointment.roomName = meetingResult.roomName;
      
      await appointment.save();
      
      console.log(`✅ Generated Jitsi Meet link: ${meetingResult.meetingLink}`);
      
      res.status(200).json({
        success: true,
        message: 'Jitsi Meet room created successfully',
        data: {
          meetingLink: appointment.meetingLink,
          appointmentId: appointment._id,
          appointmentDate: appointment.appointmentDate,
          meetingType: 'jitsi',
          platform: 'Jitsi Meet',
          roomName: appointment.roomName
        }
      });
      
    } catch (meetingError) {
      console.error('❌ Error creating Jitsi Meet room:', meetingError);
      
      res.status(500).json({
        success: false,
        message: 'Failed to create Jitsi Meet room',
        error: meetingError.message
      });
    }
    
  } catch (error) {
    console.error('❌ Error generating meeting link:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating meeting link',
      error: error.message
    });
  }
};

/**
 * Get meeting details for appointment - PRESERVED FUNCTIONALITY
 */
exports.getMeetingDetails = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    
    // Use tenant connection if available
    const Appointment = req.tenantConnection ? req.tenantConnection.model('Appointment') : require('../models/Appointment');
    
    const appointment = await Appointment.findById(appointmentId)
      .populate('doctor', 'firstName lastName')
      .populate('patient', 'firstName lastName');
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }
    
    // Check authorization
    if (
      appointment.doctor._id.toString() !== req.user.id &&
      appointment.patient._id.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to meeting details'
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        meetingLink: appointment.meetingLink,
        meetingGenerated: appointment.meetingGenerated || false,
        meetingGeneratedAt: appointment.meetingGeneratedAt,
        appointmentDate: appointment.appointmentDate,
        status: appointment.status,
        meetingType: appointment.meetingType || 'jitsi',
        platform: 'Jitsi Meet',
        roomName: appointment.roomName
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting meeting details:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting meeting details',
      error: error.message
    });
  }
};

/**
 * Update meeting link (doctor only) - PRESERVED FUNCTIONALITY
 */
exports.updateMeetingLink = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { meetingLink } = req.body;
    
    if (!meetingLink) {
      return res.status(400).json({
        success: false,
        message: 'Meeting link is required'
      });
    }
    
    // Use tenant connection if available
    const Appointment = req.tenantConnection ? req.tenantConnection.model('Appointment') : require('../models/Appointment');
    
    const appointment = await Appointment.findById(appointmentId);
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }
    
    // Only doctors can update meeting links
    if (appointment.doctor.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the assigned doctor can update the meeting link'
      });
    }
    
    appointment.meetingLink = meetingLink;
    appointment.meetingGenerated = true;
    appointment.meetingGeneratedAt = new Date();
    
    await appointment.save();
    
    res.status(200).json({
      success: true,
      message: 'Meeting link updated successfully',
      data: {
        meetingLink: appointment.meetingLink,
        appointmentId: appointment._id
      }
    });
    
  } catch (error) {
    console.error('Error updating meeting link:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating meeting link',
      error: error.message
    });
  }
};

/**
 * End meeting session - PRESERVED FUNCTIONALITY
 */
exports.endMeeting = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    
    // Use tenant connection if available
    const Appointment = req.tenantConnection ? req.tenantConnection.model('Appointment') : require('../models/Appointment');
    
    const appointment = await Appointment.findById(appointmentId);
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }
    
    // Check authorization
    if (
      appointment.doctor.toString() !== req.user.id &&
      appointment.patient.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to end this meeting'
      });
    }
    
    // Update appointment status if meeting is ended by doctor
    if (appointment.doctor.toString() === req.user.id) {
      appointment.status = 'Completed';
      appointment.meetingEndedAt = new Date();
      appointment.sessionNotes = req.body.sessionNotes || '';
      
      await appointment.save();
    }
    
    res.status(200).json({
      success: true,
      message: 'Meeting ended successfully',
      data: {
        appointmentId: appointment._id,
        status: appointment.status,
        meetingEndedAt: appointment.meetingEndedAt
      }
    });
    
  } catch (error) {
    console.error('Error ending meeting:', error);
    res.status(500).json({
      success: false,
      message: 'Error ending meeting',
      error: error.message
    });
  }
};

/**
 * ✅ FIXED: Get appointment by ID - now uses Jitsi instead of fake Google Meet
 */
exports.getAppointmentById = async (req, res) => {
  try {
    // Use tenant connection if available
    const Appointment = req.tenantConnection ? req.tenantConnection.model('Appointment') : require('../models/Appointment');
    
    console.log(`Using database: ${req.tenantDbName || 'default'} for fetching appointment by ID`);
    
    const appointment = await Appointment.findById(req.params.id)
      .populate('doctor', 'firstName lastName title credentials specialty profilePicture')
      .populate('patient', 'firstName lastName email profilePicture');
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }
    
    // Check if the logged-in user is either the doctor or patient for this appointment
    if (
      appointment.doctor._id.toString() !== req.user.id &&
      appointment.patient._id.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to this appointment'
      });
    }
    
    // ✅ FIXED: Generate Jitsi meeting link if appointment is scheduled but no link exists
    if (appointment.status === 'Scheduled' && !appointment.meetingLink) {
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
        console.log(`Auto-generated Jitsi meeting link for appointment ${appointment._id}`);
      } catch (error) {
        console.error('Error auto-generating Jitsi meeting link:', error);
      }
    }
    
    return res.status(200).json({
      success: true,
      data: appointment
    });
  } catch (error) {
    console.error('Error fetching appointment:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching appointment',
      error: error.message
    });
  }
};

/**
 * Get upcoming appointments - PRESERVED FUNCTIONALITY
 */
exports.getUpcomingAppointments = async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Validate user ID
    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid user ID format' 
      });
    }
    
    // Use tenant connection if available
    const Appointment = req.tenantConnection ? req.tenantConnection.model('Appointment') : require('../models/Appointment');
    const User = req.tenantConnection ? req.tenantConnection.model('User') : require('../models/User');
    
    console.log(`Using database: ${req.tenantDbName || 'default'} for fetching upcoming appointments`);
    
    // Build query - get upcoming appointments
    const query = {
      patient: userId,
      appointmentDate: { $gte: new Date() },
      status: { $in: ['Scheduled'] }
    };
    
    // Find appointments and populate doctor information
    const appointments = await Appointment.find(query)
      .populate('doctor', 'firstName lastName profilePicture specialization')
      .sort({ appointmentDate: 1 })
      .lean();
    
    // If no appointments found
    if (!appointments || appointments.length === 0) {
      return res.status(200).json([]);
    }
    
    // Process and transform appointment data for better client display
    const processedAppointments = await Promise.all(appointments.map(async (appointment) => {
      // Add doctor name if doctor is populated
      let doctorName = 'Unknown Doctor';
      let specialization = '';
      
      if (appointment.doctor) {
        // Doctor is populated as an object
        if (appointment.doctor.firstName && appointment.doctor.lastName) {
          doctorName = `Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}`;
          specialization = appointment.doctor.specialization || '';
        }
      } else if (appointment.doctor && typeof appointment.doctor === 'string') {
        // Doctor is just an ID - fetch doctor details
        try {
          const doctor = await User.findById(appointment.doctor).select('firstName lastName specialization').lean();
          if (doctor) {
            doctorName = `Dr. ${doctor.firstName} ${doctor.lastName}`;
            specialization = doctor.specialization || '';
          }
        } catch (err) {
          console.error(`Error fetching doctor details: ${err.message}`);
        }
      }
      
      // Return processed appointment with meeting info
      return {
        ...appointment,
        doctorName,
        specialization,
        formattedDate: new Date(appointment.appointmentDate).toLocaleString(),
        hasMeeting: !!appointment.meetingLink,
        meetingReady: appointment.status === 'Scheduled' && !!appointment.meetingLink
      };
    }));
    
    res.status(200).json(processedAppointments);
  } catch (error) {
    console.error(`Error getting upcoming appointments: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get upcoming appointments',
      error: error.message
    });
  }
};

/**
 * Get user appointments - PRESERVED FUNCTIONALITY
 */
exports.getUserAppointments = async (req, res) => {
  try {
    // Use tenant connection if available
    const User = req.tenantConnection ? req.tenantConnection.model('User') : require('../models/User');
    const Appointment = req.tenantConnection ? req.tenantConnection.model('Appointment') : require('../models/Appointment');
    
    console.log(`Using database: ${req.tenantDbName || 'default'} for fetching user appointments`);
    
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
    console.error('Error fetching user appointments:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching user appointments',
      error: error.message
    });
  }
};

/**
 * Update appointment status - PRESERVED FUNCTIONALITY
 */
exports.updateAppointmentStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    // Use tenant connection if available
    const Appointment = req.tenantConnection ? req.tenantConnection.model('Appointment') : require('../models/Appointment');
    
    console.log(`Using database: ${req.tenantDbName || 'default'} for updating appointment status`);
    
    if (!status || !['Scheduled', 'Completed', 'Cancelled', 'No-show'].includes(status)) {
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
};

/**
 * Reschedule appointment - PRESERVED FUNCTIONALITY
 */
exports.rescheduleAppointment = async (req, res) => {
  try {
    const { appointmentDate } = req.body;
    
    // Use tenant connection if available
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
};

/**
 * Decline appointment - PRESERVED FUNCTIONALITY
 */
exports.declineAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { responseMessage } = req.body;
    
    console.log(`Doctor ${req.user.id} declining appointment ${appointmentId}`);
    
    // Use tenant connection if available
    const Appointment = req.tenantConnection ? req.tenantConnection.model('Appointment') : require('../models/Appointment');
    
    // Find the appointment
    const appointment = await Appointment.findById(appointmentId)
      .populate('patient', 'firstName lastName email')
      .populate('doctor', 'firstName lastName');
    
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
    
    // Emit socket event for real-time notification
    if (req.io) {
      req.io.emit(`appointment_declined_${appointment.patient._id}`, {
        appointmentId: appointment._id,
        doctorName: `Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}`,
        appointmentDate: appointment.appointmentDate,
        message: appointment.doctorResponse.responseMessage
      });
    }
    
    console.log(`Appointment ${appointmentId} declined successfully`);
    
    res.status(200).json({
      success: true,
      message: 'Appointment declined successfully',
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
};

/**
 * Get pending appointments for doctor - PRESERVED FUNCTIONALITY
 */
exports.getPendingAppointments = async (req, res) => {
  try {
    console.log(`Getting pending appointments for doctor ${req.user.id}`);
    
    // Use tenant connection if available
    const Appointment = req.tenantConnection ? req.tenantConnection.model('Appointment') : require('../models/Appointment');
    
    // Find all pending appointments for this doctor
    const pendingAppointments = await Appointment.find({
      doctor: req.user.id,
      status: 'Pending'
    })
    .populate('patient', 'firstName lastName email profilePicture')
    .sort({ createdAt: -1 });
    
    console.log(`Found ${pendingAppointments.length} pending appointments`);
    
    res.status(200).json({
      success: true,
      data: pendingAppointments
    });
    
  } catch (error) {
    console.error('Error getting pending appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting pending appointments',
      error: error.message
    });
  }
};

/**
 * Get pending payments - PRESERVED FUNCTIONALITY
 */
exports.getPendingPayments = async (req, res) => {
  try {
    console.log(`Getting pending payments for user ${req.user.id}`);
    
    // Use tenant connection if available
    const Appointment = req.tenantConnection ? req.tenantConnection.model('Appointment') : require('../models/Appointment');
    
    // Find all appointments with pending payments for this user
    const pendingPayments = await Appointment.find({
      patient: req.user.id,
      'payment.status': 'pending',
      status: { $in: ['Scheduled', 'Completed'] }
    })
    .populate('doctor', 'firstName lastName profilePicture specialty specialization consultationFee')
    .sort({ appointmentDate: 1 });
    
    console.log(`Found ${pendingPayments.length} pending payments`);
    
    res.status(200).json({
      success: true,
      data: pendingPayments
    });
    
  } catch (error) {
    console.error('Error getting pending payments:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting pending payments',
      error: error.message
    });
  }
};

/**
 * Upload payment proof - PRESERVED FUNCTIONALITY
 */
exports.uploadPaymentProof = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { paymentMethod, proofOfPaymentUrl } = req.body;
    
    console.log(`Uploading payment proof for appointment ${appointmentId}`);
    
    // Use tenant connection if available
    const Appointment = req.tenantConnection ? req.tenantConnection.model('Appointment') : require('../models/Appointment');
    
    // Find the appointment
    const appointment = await Appointment.findById(appointmentId)
      .populate('doctor', 'firstName lastName')
      .populate('patient', 'firstName lastName');
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }
    
    // Check if the logged-in user is the patient for this appointment
    if (appointment.patient._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to upload payment for this appointment'
      });
    }
    
    // Check if appointment is in correct status for payment
    if (!['Scheduled', 'Completed'].includes(appointment.status)) {
      return res.status(400).json({
        success: false,
        message: 'Payment can only be uploaded for scheduled or completed appointments'
      });
    }
    
    // Update payment information
    appointment.payment.proofOfPayment = proofOfPaymentUrl;
    appointment.payment.paymentMethod = paymentMethod;
    appointment.payment.paymentDate = new Date();
    
    await appointment.save();
    
    // Emit socket event to notify relevant parties
    if (req.io) {
      req.io.emit(`payment_proof_uploaded_${appointment.doctor._id}`, {
        appointmentId: appointment._id,
        patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
        appointmentDate: appointment.appointmentDate,
        paymentAmount: appointment.payment.amount
      });
    }
    
    console.log(`Payment proof uploaded successfully for appointment ${appointmentId}`);
    
    res.status(200).json({
      success: true,
      message: 'Payment proof uploaded successfully',
      data: appointment
    });
    
  } catch (error) {
    console.error('Error uploading payment proof:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading payment proof',
      error: error.message
    });
  }
};

/**
 * Verify payment - PRESERVED FUNCTIONALITY
 */
exports.verifyPayment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { approved } = req.body;
    
    console.log(`Verifying payment for appointment ${appointmentId}`);
    
    // Use tenant connection if available
    const Appointment = req.tenantConnection ? req.tenantConnection.model('Appointment') : require('../models/Appointment');
    const User = req.tenantConnection ? req.tenantConnection.model('User') : require('../models/User');
    
    // Check if user has permission to verify payments
    const user = await User.findById(req.user.id);
    if (!user || !['doctor', 'admin'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only doctors and admins can verify payments'
      });
    }
    
    // Find the appointment
    const appointment = await Appointment.findById(appointmentId)
      .populate('doctor', 'firstName lastName')
      .populate('patient', 'firstName lastName');
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }
    
    // If user is a doctor, they can only verify their own appointments
    if (user.role === 'doctor' && appointment.doctor._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only verify payments for your own appointments'
      });
    }
    
    // Update payment status
    appointment.payment.status = approved ? 'paid' : 'failed';
    appointment.payment.verifiedBy = req.user.id;
    appointment.payment.verifiedAt = new Date();
    
    await appointment.save();
    
    // Emit socket event to notify patient
    if (req.io) {
      req.io.emit(`payment_${approved ? 'approved' : 'rejected'}_${appointment.patient._id}`, {
        appointmentId: appointment._id,
        doctorName: `Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}`,
        appointmentDate: appointment.appointmentDate,
        paymentAmount: appointment.payment.amount
      });
    }
    
    console.log(`Payment ${approved ? 'approved' : 'rejected'} for appointment ${appointmentId}`);
    
    res.status(200).json({
      success: true,
      message: `Payment ${approved ? 'approved' : 'rejected'} successfully`,
      data: appointment
    });
    
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying payment',
      error: error.message
    });
  }
};