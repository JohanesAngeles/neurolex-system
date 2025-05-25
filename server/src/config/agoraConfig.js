// server/src/config/agoraConfig.js
const { RtcTokenBuilder, RtcRole, RtmTokenBuilder } = require('agora-access-token');
const dotenv = require('dotenv');

dotenv.config();

// Load Agora credentials from environment variables
const APP_ID = '56a045eb804d43d8a11c6d4894e9b115';
const APP_CERTIFICATE = 'b7cd6d47b5704765af192c7e1e225bf0';
 
// Token expiration time in seconds (default: 24 hours)
const EXPIRATION_TIME_IN_SECONDS = 24 * 60 * 60;

/**
 * Generate an RTC token for video/voice calls
 * @param {string} channelName - Name of the channel
 * @param {number|string} uid - User ID (numeric)
 * @param {number} role - User role (publisher or subscriber)
 * @returns {object} Token and app ID
 */
const generateRtcToken = (channelName, uid, role = RtcRole.PUBLISHER) => {
  try {
    // Validate input
    if (!channelName) {
      throw new Error('Channel name is required');
    }
    
    // Clean channel name (alphanumeric only)
    const cleanChannelName = channelName.toString().replace(/[^a-zA-Z0-9]/g, '');
    
    // Convert string UID to number if needed
    const numericUid = typeof uid === 'string' ? parseInt(uid, 10) : uid;
    
    // Set token expiration time
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const expirationTimestamp = currentTimestamp + EXPIRATION_TIME_IN_SECONDS;
    
    // Build the token
    const token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERTIFICATE,
      cleanChannelName,
      numericUid,
      role,
      expirationTimestamp
    );
    
    console.log(`Generated RTC token for channel '${cleanChannelName}', uid: ${numericUid}, expiration: ${new Date(expirationTimestamp * 1000).toISOString()}`);
    
    return {
      token,
      appId: APP_ID,
      channelName: cleanChannelName,
      uid: numericUid,
      role,
      expiresAt: expirationTimestamp
    };
  } catch (error) {
    console.error('Failed to generate RTC token:', error);
    throw error;
  }
};

/**
 * Generate an RTM token for messaging
 * @param {string} uid - User ID (string)
 * @returns {object} Token and app ID
 */
const generateRtmToken = (uid) => {
  try {
    // Validate input
    if (!uid) {
      throw new Error('User ID is required');
    }
    
    // Set token expiration time
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const expirationTimestamp = currentTimestamp + EXPIRATION_TIME_IN_SECONDS;
    
    // Build the token
    const token = RtmTokenBuilder.buildToken(
      APP_ID,
      APP_CERTIFICATE,
      uid,
      expirationTimestamp
    );
    
    console.log(`Generated RTM token for uid: ${uid}, expiration: ${new Date(expirationTimestamp * 1000).toISOString()}`);
    
    return {
      token,
      appId: APP_ID,
      uid,
      expiresAt: expirationTimestamp
    };
  } catch (error) {
    console.error('Failed to generate RTM token:', error);
    throw error;
  }
};

module.exports = {
  APP_ID,
  generateRtcToken,
  generateRtmToken,
  RtcRole
};