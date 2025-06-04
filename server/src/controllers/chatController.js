// server/src/controllers/chatController.js - STREAM CHAT INTEGRATION WITH DEBUG

const jwt = require('jsonwebtoken');

// Stream Chat Configuration
const STREAM_CHAT_API_KEY = process.env.STREAM_CHAT_API_KEY || '9v6xtvf6dhtv';
const STREAM_CHAT_SECRET = process.env.STREAM_CHAT_SECRET;

/**
 * Generate Stream Chat token for authenticated users
 * @route POST /api/chat/token
 * @access Private - Requires authentication
 */
exports.generateChatToken = async (req, res) => {
  try {
    const { userId, action } = req.body;
    
    console.log('🎯 Generating Stream Chat token for user:', userId);
    console.log('🔧 Action:', action);
    
    // Get user ID from request (either from body or from authenticated user)
    const targetUserId = userId || (req.user && (req.user.id || req.user._id));
    
    if (!targetUserId) {
      console.log('❌ No user ID provided');
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }
    
    // Verify the requesting user has permission to generate token for this user
    const requestingUserId = req.user && (req.user.id || req.user._id);
    
    // Users can only generate tokens for themselves (security measure)
    if (requestingUserId && targetUserId !== requestingUserId.toString()) {
      console.log('❌ User trying to generate token for different user');
      console.log('Requesting user:', requestingUserId);
      console.log('Target user:', targetUserId);
      
      return res.status(403).json({
        success: false,
        message: 'You can only generate tokens for your own account'
      });
    }
    
    // Generate Stream Chat token
    const streamToken = generateStreamChatToken(targetUserId);
    
    if (!streamToken) {
      console.log('❌ Failed to generate Stream Chat token');
      return res.status(500).json({
        success: false,
        message: 'Failed to generate chat token'
      });
    }
    
    console.log('✅ Stream Chat token generated successfully for user:', targetUserId);
    
    return res.status(200).json({
      success: true,
      message: 'Chat token generated successfully',
      data: {
        token: streamToken,
        userId: targetUserId,
        apiKey: STREAM_CHAT_API_KEY,
        expiresIn: '24h'
      }
    });
    
  } catch (error) {
    console.error('❌ Error generating chat token:', error);
    return res.status(500).json({
      success: false,
      message: 'Error generating chat token',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Generate Stream Chat token using HMAC-SHA256
 * @param {string} userId - User ID for whom to generate the token
 * @returns {string|null} - Generated token or null if failed
 */
function generateStreamChatToken(userId) {
  try {
    if (!STREAM_CHAT_SECRET) {
      console.error('❌ STREAM_CHAT_SECRET not configured');
      return null;
    }
    
    if (!userId) {
      console.error('❌ User ID is required for token generation');
      return null;
    }
    
    // Create the payload
    const now = Math.floor(Date.now() / 1000);
    const exp = now + (24 * 60 * 60); // 24 hours expiration
    
    const payload = {
      user_id: userId.toString(),
      iat: now,
      exp: exp
    };
    
    console.log('🔧 Creating token with payload:', {
      user_id: payload.user_id,
      iat: payload.iat,
      exp: payload.exp,
      expiresAt: new Date(exp * 1000).toISOString()
    });
    
    // Create JWT token using the Stream Chat secret
    const token = jwt.sign(payload, STREAM_CHAT_SECRET, {
      algorithm: 'HS256',
      header: {
        alg: 'HS256',
        typ: 'JWT'
      }
    });
    
    console.log('✅ Token generated successfully');
    return token;
    
  } catch (error) {
    console.error('❌ Error generating Stream Chat token:', error);
    return null;
  }
}

/**
 * Get user's associated doctors for chat (from appointments)
 * @route GET /api/chat/doctors
 * @access Private - Requires authentication
 */
exports.getAssociatedDoctors = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    
    console.log('🔍 Getting associated doctors for user:', userId);
    console.log('🔍 DEBUG: Tenant info:', {
      tenantId: req.tenantId || 'None',
      tenantDbName: req.tenantDbName || 'None',
      hasConnection: !!req.tenantConnection
    });
    
    // Use tenant connection if available
    const PatientDoctorAssociation = req.tenantConnection ? 
      req.tenantConnection.model('PatientDoctorAssociation') : 
      require('../models/PatientDoctorAssociation');
    
    const User = req.tenantConnection ? 
      req.tenantConnection.model('User') : 
      require('../models/User');
    
    const Appointment = req.tenantConnection ?
      req.tenantConnection.model('Appointment') :
      require('../models/Appointment');
    
    console.log('🔍 DEBUG: Using models from:', req.tenantConnection ? 'tenant connection' : 'global require');
    
    // 🔍 DEBUG: Check all appointments for this user (any status)
    const allAppointments = await Appointment.find({ patient: userId }).lean();
    console.log('🔍 DEBUG: Total appointments for user:', allAppointments.length);
    if (allAppointments.length > 0) {
      console.log('🔍 DEBUG: Sample appointments:', allAppointments.slice(0, 3).map(apt => ({
        id: apt._id,
        doctor: apt.doctor,
        status: apt.status,
        date: apt.appointmentDate
      })));
    }
    
    // Get doctors from appointments
    const appointments = await Appointment.find({
      patient: userId,
      status: { $in: ['Scheduled', 'Completed'] }
    }).populate('doctor', 'firstName lastName title credentials specialty specialization profilePicture description languages consultationFee').lean();
    
    // 🔍 DEBUG: Log what we found
    console.log('🔍 DEBUG: Found appointments with Scheduled/Completed status:', appointments.length);
    console.log('🔍 DEBUG: User ID being searched:', userId);
    console.log('🔍 DEBUG: First few appointments:', appointments.slice(0, 3).map(apt => ({
      id: apt._id,
      doctorId: apt.doctor?._id,
      doctorName: apt.doctor ? `${apt.doctor.firstName} ${apt.doctor.lastName}` : 'No doctor populated',
      status: apt.status
    })));
    
    // Extract unique doctors from appointments
    const doctorsFromAppointments = [];
    const doctorIds = new Set();
    
    appointments.forEach(appointment => {
      if (appointment.doctor && !doctorIds.has(appointment.doctor._id.toString())) {
        doctorIds.add(appointment.doctor._id.toString());
        doctorsFromAppointments.push(appointment.doctor);
      }
    });
    
    console.log('🔍 DEBUG: Unique doctors extracted from appointments:', doctorsFromAppointments.length);
    
    // 🔍 DEBUG: Check all associations for this user
    const allAssociations = await PatientDoctorAssociation.find({ patient: userId }).lean();
    console.log('🔍 DEBUG: Total associations for user:', allAssociations.length);
    if (allAssociations.length > 0) {
      console.log('🔍 DEBUG: Sample associations:', allAssociations.slice(0, 3).map(assoc => ({
        id: assoc._id,
        doctor: assoc.doctor,
        status: assoc.status
      })));
    }
    
    // Also get doctors from manual associations
    const associations = await PatientDoctorAssociation.find({
      patient: userId,
      status: 'active'
    }).populate('doctor', 'firstName lastName title credentials specialty specialization profilePicture description languages consultationFee').lean();
    
    // 🔍 DEBUG: Log associations
    console.log('🔍 DEBUG: Found active associations:', associations.length);
    console.log('🔍 DEBUG: First few associations:', associations.slice(0, 3).map(assoc => ({
      id: assoc._id,
      doctorId: assoc.doctor?._id,
      doctorName: assoc.doctor ? `${assoc.doctor.firstName} ${assoc.doctor.lastName}` : 'No doctor populated',
      status: assoc.status
    })));
    
    // Add doctors from associations that aren't already included
    associations.forEach(association => {
      if (association.doctor && !doctorIds.has(association.doctor._id.toString())) {
        doctorIds.add(association.doctor._id.toString());
        doctorsFromAppointments.push(association.doctor);
      }
    });
    
    console.log('🔍 DEBUG: Final unique doctor count:', doctorsFromAppointments.length);
    if (doctorsFromAppointments.length > 0) {
      console.log('🔍 DEBUG: Final doctor list:', doctorsFromAppointments.map(doc => ({
        id: doc._id,
        name: `${doc.firstName} ${doc.lastName}`,
        specialty: doc.specialty || doc.specialization
      })));
    }
    
    console.log(`✅ Found ${doctorsFromAppointments.length} associated doctors for user ${userId}`);
    
    return res.status(200).json({
      success: true,
      data: doctorsFromAppointments,
      count: doctorsFromAppointments.length,
      source: 'appointments_and_associations',
      debug: {
        userId: userId,
        totalAppointments: allAppointments.length,
        filteredAppointments: appointments.length,
        totalAssociations: allAssociations.length,
        activeAssociations: associations.length,
        uniqueDoctors: doctorsFromAppointments.length,
        tenantInfo: {
          tenantId: req.tenantId || 'None',
          tenantDbName: req.tenantDbName || 'None'
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting associated doctors:', error);
    console.error('❌ Error stack:', error.stack);
    return res.status(500).json({
      success: false,
      message: 'Error getting associated doctors',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Get user's appointments for messaging context
 * @route GET /api/chat/appointments  
 * @access Private - Requires authentication
 */
exports.getUserAppointmentsForMessaging = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    
    console.log('🔍 Getting user appointments for messaging context:', userId);
    console.log('🔍 DEBUG: Tenant info for appointments:', {
      tenantId: req.tenantId || 'None',
      tenantDbName: req.tenantDbName || 'None',
      hasConnection: !!req.tenantConnection
    });
    
    // Use tenant connection if available
    const Appointment = req.tenantConnection ?
      req.tenantConnection.model('Appointment') :
      require('../models/Appointment');
    
    console.log('🔍 DEBUG: Using Appointment model from:', req.tenantConnection ? 'tenant connection' : 'global require');
    
    // 🔍 DEBUG: Check all appointments for this user first
    const allUserAppointments = await Appointment.find({ patient: userId }).lean();
    console.log('🔍 DEBUG: Total appointments for user in messaging context:', allUserAppointments.length);
    
    // Get user's appointments with doctors
    const appointments = await Appointment.find({
      patient: userId,
      status: { $in: ['Scheduled', 'Completed'] }
    })
    .populate('doctor', 'firstName lastName title specialty profilePicture')
    .sort({ appointmentDate: -1 })
    .limit(20)
    .lean();
    
    console.log('🔍 DEBUG: Filtered appointments for messaging:', appointments.length);
    console.log('🔍 DEBUG: Sample messaging appointments:', appointments.slice(0, 3).map(apt => ({
      id: apt._id,
      doctorId: apt.doctor?._id,
      doctorName: apt.doctor ? `${apt.doctor.firstName} ${apt.doctor.lastName}` : 'No doctor',
      status: apt.status,
      date: apt.appointmentDate
    })));
    
    console.log(`✅ Found ${appointments.length} appointments for messaging context`);
    
    return res.status(200).json({
      success: true,
      data: appointments,
      count: appointments.length,
      debug: {
        userId: userId,
        totalUserAppointments: allUserAppointments.length,
        filteredForMessaging: appointments.length,
        tenantInfo: {
          tenantId: req.tenantId || 'None',
          tenantDbName: req.tenantDbName || 'None'
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting appointments for messaging:', error);
    console.error('❌ Error stack:', error.stack);
    return res.status(500).json({
      success: false,
      message: 'Error getting appointments for messaging',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};