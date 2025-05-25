// server/src/controllers/agoraController.js
const { APP_ID, generateRtcToken, generateRtmToken, RtcRole } = require('../config/agoraConfig');

/**
 * Generate RTC token for video calls
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
exports.generateRtcToken = (req, res) => {
  try {
    console.log('RTC token request received:', {
      body: req.body,
      user: req.user ? { id: req.user.id } : 'No user'
    });

    // Check request body
    const { channelName, uid } = req.body;
    
    if (!channelName) {
      console.error('Missing channelName in request');
      return res.status(400).json({ 
        success: false, 
        error: 'Channel name is required' 
      });
    }
    
    // Parse user ID
    let userId;
    try {
      userId = uid ? parseInt(uid, 10) : 0;
      if (isNaN(userId)) {
        console.warn(`Invalid uid provided: ${uid}, using 0 instead`);
        userId = 0;
      }
    } catch (err) {
      console.warn(`Error parsing uid: ${err.message}, using 0 instead`);
      userId = 0;
    }
    
    console.log(`Generating RTC token for channel: ${channelName}, user ID: ${userId}`);
    
    // Generate token with proper error handling
    const tokenData = generateRtcToken(
      channelName,
      userId,
      RtcRole.PUBLISHER
    );
    
    // Log successful token generation
    console.log(`RTC token generated successfully: token length=${tokenData.token.length}, appId=${APP_ID}`);
    
    // Return token data - make sure structure matches what client expects
    return res.status(200).json({
      token: tokenData.token,
      appId: APP_ID,
      uid: userId,
      channelName: tokenData.channelName,
      expiresAt: tokenData.expiresAt
    });
  } catch (error) {
    console.error('Error generating RTC token:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to generate token' 
    });
  }
};

/**
 * Generate RTM token for messaging
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
exports.generateRtmToken = (req, res) => {
  try {
    console.log('RTM token request received');

    // Extract user ID from request body or use authenticated user ID
    const { uid } = req.body;
    
    if (!uid) {
      console.error('Missing uid in request');
      return res.status(400).json({ 
        error: 'User ID is required' 
      });
    }
    
    // Use string UID for RTM
    const userId = uid.toString();
    console.log(`Generating RTM token for user ID: ${userId}`);
    
    // Generate RTM token
    const tokenData = generateRtmToken(userId);
    
    // Log successful token generation
    console.log(`RTM token generated successfully: token length=${tokenData.token.length}, appId=${APP_ID}`);
    
    // Return token data - make sure structure matches what client expects
    return res.status(200).json({ 
      token: tokenData.token,
      appId: APP_ID,
      uid: userId,
      expiresAt: tokenData.expiresAt
    });
  } catch (error) {
    console.error('Error generating RTM token:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to generate RTM token' 
    });
  }
};