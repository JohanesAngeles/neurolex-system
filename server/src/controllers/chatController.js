// server/src/controllers/chatController.js - STREAM CHAT INTEGRATION

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
    
    // Get doctors from appointments
    const appointments = await Appointment.find({
      patient: userId,
      status: { $in: ['Scheduled', 'Completed'] }
    }).populate('doctor', 'firstName lastName title credentials specialty specialization profilePicture description languages consultationFee').lean();
    
    // Extract unique doctors from appointments
    const doctorsFromAppointments = [];
    const doctorIds = new Set();
    
    appointments.forEach(appointment => {
      if (appointment.doctor && !doctorIds.has(appointment.doctor._id.toString())) {
        doctorIds.add(appointment.doctor._id.toString());
        doctorsFromAppointments.push(appointment.doctor);
      }
    });
    
    // Also get doctors from manual associations
    const associations = await PatientDoctorAssociation.find({
      patient: userId,
      status: 'active'
    }).populate('doctor', 'firstName lastName title credentials specialty specialization profilePicture description languages consultationFee').lean();
    
    // Add doctors from associations that aren't already included
    associations.forEach(association => {
      if (association.doctor && !doctorIds.has(association.doctor._id.toString())) {
        doctorIds.add(association.doctor._id.toString());
        doctorsFromAppointments.push(association.doctor);
      }
    });
    
    console.log(`✅ Found ${doctorsFromAppointments.length} associated doctors for user ${userId}`);
    
    return res.status(200).json({
      success: true,
      data: doctorsFromAppointments,
      count: doctorsFromAppointments.length,
      source: 'appointments_and_associations'
    });
    
  } catch (error) {
    console.error('❌ Error getting associated doctors:', error);
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
    
    // Use tenant connection if available
    const Appointment = req.tenantConnection ?
      req.tenantConnection.model('Appointment') :
      require('../models/Appointment');
    
    // Get user's appointments with doctors
    const appointments = await Appointment.find({
      patient: userId,
      status: { $in: ['Scheduled', 'Completed'] }
    })
    .populate('doctor', 'firstName lastName title specialty profilePicture')
    .sort({ appointmentDate: -1 })
    .limit(20)
    .lean();
    
    console.log(`✅ Found ${appointments.length} appointments for messaging context`);
    
    return res.status(200).json({
      success: true,
      data: appointments,
      count: appointments.length
    });
    
  } catch (error) {
    console.error('❌ Error getting appointments for messaging:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting appointments for messaging',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};