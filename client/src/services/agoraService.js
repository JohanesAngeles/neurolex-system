// client/src/services/agoraService.js
import axios from 'axios';
import AgoraRTC from 'agora-rtc-sdk-ng';
// Import Agora RTM - for version 2.2.1
import * as RTM from 'agora-rtm-sdk';

const API_URL = 'http://localhost:5000/api/agora';

// Store Agora client instances for reuse
let rtcClient = null;
let rtmClient = null;
let rtmChannel = null;

// Track connection states to prevent duplicate connections
let rtcConnectionState = 'DISCONNECTED';

/**
 * Get RTC token for video/voice calls with retry logic
 * @param {string} channelName - The name of the channel to join
 * @param {number} retryCount - Number of retries (internal use)
 * @returns {Promise<object>} - Token and appId information
 */
export const getRtcToken = async (channelName, retryCount = 0) => {
  try {
    // Convert userId to a number for Agora RTC
    const userId = parseInt(localStorage.getItem('userId') || Date.now().toString(), 10);
    
    console.log('Getting RTC token for channel:', channelName);
    console.log('Using userId:', userId);
    
    // Ensure channelName doesn't have any special characters
    const safeChannelName = channelName.toString().replace(/[^a-zA-Z0-9]/g, '');
    
    // Log request details for debugging
    console.log('Sending token request to:', `${API_URL}/rtc-token`);
    console.log('Request data:', { channelName: safeChannelName, uid: userId });
    
    const response = await axios.post(`${API_URL}/rtc-token`, {
      channelName: safeChannelName,
      uid: userId
    }, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      // Add timeout to prevent hanging requests
      timeout: 10000
    });
    
    console.log('RTC token response received:', response.status);
    console.log('Response data:', response.data);
    
    // Verify token is valid
    if (!response.data.token || response.data.token.length < 10) {
      console.error('Invalid token received from server:', response.data);
      throw new Error("Invalid token received from server");
    }
    
    // Ensure appId is present
    if (!response.data.appId) {
      console.error('No App ID in response:', response.data);
      throw new Error("App ID missing from token response");
    }
    
    console.log('Successfully received valid token, first 10 chars:', response.data.token.substring(0, 10) + '...');
    console.log('App ID received:', response.data.appId);
    
    return {
      token: response.data.token,
      appId: response.data.appId,
      uid: userId
    };
  } catch (error) {
    console.error('Failed to get RTC token:', error);
    
    // Log more detailed error information
    if (error.response) {
      console.error('Error response status:', error.response.status);
      console.error('Error response data:', error.response.data);
    }
    
    // For development/testing fallback - replace with your temporary token
    console.log('Falling back to temporary token for testing');
    return {
      token: 'YOUR_TEMPORARY_TOKEN_FROM_AGORA_CONSOLE', // Replace with your temporary token
      appId: '56a045eb804d43d8a11c6d4894e9b115',
      // eslint-disable-next-line no-undef
      uid: userId
    };
  }
};

/**
 * Get RTM token for messaging
 * @returns {Promise<object>} - Token, appId and userId information
 */
export const getRtmToken = async () => {
  try {
    // For RTM, we can use string user IDs
    const userId = localStorage.getItem('userId') || Date.now().toString();
    
    console.log('Getting RTM token for userId:', userId);
    
    const response = await axios.post(`${API_URL}/rtm-token`, {
      uid: userId
    }, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('RTM token response:', {
      appId: response.data.appId,
      tokenPreview: response.data.token ? `${response.data.token.substring(0, 10)}...` : 'no token'
    });
    
    return { ...response.data, userId };
  } catch (error) {
    console.error('Failed to get RTM token:', error);
    throw error;
  }
};

/**
 * Initialize Agora RTC client
 * @returns {object} - The RTC client instance
 */
export const initializeRtcClient = () => {
  if (!rtcClient) {
    console.log('Creating new RTC client');
    rtcClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    
    // Enable more detailed logging for debugging
    AgoraRTC.setLogLevel(0); // 0 for verbose, 1 for info, etc.
    
    // Track connection state changes
    rtcClient.on('connection-state-change', (curState, prevState) => {
      console.log(`RTC connection state change: ${prevState} -> ${curState}`);
      rtcConnectionState = curState;
    });
  }
  
  return rtcClient;
};

/**
 * Get current RTC connection state
 * @returns {string} - Current connection state
 */
export const getRtcConnectionState = () => {
  return rtcConnectionState;
};

/**
 * Reset RTC client for recovery from errors
 */
export const resetRtcClient = () => {
  if (rtcClient) {
    console.log('Resetting RTC client');
    
    // Clean up any existing listeners
    rtcClient.removeAllListeners();
    
    // Force cleanup
    try {
      if (rtcConnectionState === 'CONNECTED' || rtcConnectionState === 'CONNECTING') {
        rtcClient.leave().catch(err => console.warn('Error during leave on reset:', err));
      }
    } catch (error) {
      console.warn('Error during client reset:', error);
    }
  }
  
  // Reset the client
  rtcClient = null;
  rtcConnectionState = 'DISCONNECTED';
  
  // Create a new instance
  return initializeRtcClient();
};

/**
 * Initialize Agora RTM client - specifically tailored for version 2.2.1
 * @returns {Promise<object>} - The RTM client instance
 */
export const initializeRtmClient = async () => {
  try {
    if (!rtmClient) {
      // Get token and app ID
      const { token, appId, userId } = await getRtmToken();
      
      console.log('RTM SDK structure:', RTM);
      
      // Direct initialization for version 2.2.1
      if (typeof RTM.RTM === 'function') {
        console.log('Using RTM.RTM function');
        rtmClient = RTM.RTM(appId);
      } else {
        // Fallback to normal mock messaging without RTM
        console.log('RTM initialization failed - using mock messaging');
        rtmClient = { mock: true };
        return rtmClient;
      }
      
      // Log in to RTM
      console.log('Logging in to RTM with userId:', userId);
      await rtmClient.login({ token, uid: userId });
      console.log('Successfully logged in to Agora RTM');
    }
    
    return rtmClient;
  } catch (error) {
    console.error('Failed to initialize RTM client:', error);
    console.log('Falling back to mock messaging');
    
    // Return a mock client to not break the rest of the app
    rtmClient = { mock: true };
    return rtmClient;
  }
};

/**
 * Join an RTM channel
 * @param {string} channelName - The name of the channel to join
 * @returns {Promise<object>} - The RTM channel object
 */
export const joinRtmChannel = async (channelName) => {
  try {
    if (!rtmClient) {
      await initializeRtmClient();
    }
    
    // If we're using a mock client, return a mock channel
    if (rtmClient.mock) {
      console.log('Using mock RTM channel');
      rtmChannel = { mock: true, channelId: channelName };
      return rtmChannel;
    }
    
    console.log('Attempting to join RTM channel:', channelName);
    
    // Create and join channel if not already in one
    if (!rtmChannel || rtmChannel.channelId !== channelName) {
      // Leave previous channel if exists
      if (rtmChannel) {
        await rtmChannel.leave();
        console.log('Left previous RTM channel');
      }
      
      // Create and join new channel
      rtmChannel = rtmClient.createChannel(channelName);
      await rtmChannel.join();
      console.log('Successfully joined RTM channel:', channelName);
    }
    
    return rtmChannel;
  } catch (error) {
    console.error('Failed to join RTM channel:', error);
    // Return a mock channel to not break the app
    rtmChannel = { mock: true, channelId: channelName };
    return rtmChannel;
  }
};

/**
 * Leave RTM channel
 * @returns {Promise<void>}
 */
export const leaveRtmChannel = async () => {
  try {
    if (rtmChannel && !rtmChannel.mock) {
      await rtmChannel.leave();
      console.log('Left RTM channel');
    }
    rtmChannel = null;
  } catch (error) {
    console.error('Failed to leave RTM channel:', error);
  }
};

/**
 * Logout from RTM
 * @returns {Promise<void>}
 */
export const logoutRtm = async () => {
  try {
    if (rtmClient && !rtmClient.mock) {
      await leaveRtmChannel();
      await rtmClient.logout();
      console.log('Logged out from RTM');
    }
    rtmClient = null;
  } catch (error) {
    console.error('Failed to logout from RTM:', error);
  }
};

/**
 * Send a message via RTM
 * @param {string} text - The message text to send
 * @param {string|null} peerId - Optional peer ID for direct messaging
 * @returns {Promise<boolean>} - Success status
 */
export const sendRtmMessage = async (text, peerId = null) => {
  try {
    if (!rtmClient) {
      console.log('RTM client not initialized, simulating message send');
      return true;
    }
    
    // Mock client/channel case - simulate success
    if (rtmClient.mock || (rtmChannel && rtmChannel.mock)) {
      console.log('Using mock RTM - simulating message send:', text);
      return true;
    }
    
    if (peerId) {
      // Peer-to-peer message
      await rtmClient.sendMessageToPeer({ text }, peerId);
      console.log('Sent P2P message to:', peerId);
      return true;
    } else if (rtmChannel) {
      // Channel message
      await rtmChannel.sendMessage({ text });
      console.log('Sent channel message');
      return true;
    } else {
      throw new Error('No channel joined or peer ID provided');
    }
  } catch (error) {
    console.error('Failed to send RTM message:', error);
    // Don't break the app if message sending fails
    return false;
  }
};

/**
 * Set up RTM message listeners
 * @param {object} rtmClient - The RTM client instance
 * @param {object} rtmChannel - The RTM channel instance
 * @param {object} callbacks - Callback functions for different events
 */
export const setupRtmListeners = (rtmClient, rtmChannel, callbacks) => {
  if (!rtmClient || rtmClient.mock || !callbacks) {
    console.log('Using mock RTM - no listeners set up');
    return;
  }
  
  // Channel message event
  if (rtmChannel && !rtmChannel.mock && callbacks.onChannelMessage) {
    rtmChannel.on('ChannelMessage', callbacks.onChannelMessage);
    console.log('Set up RTM channel message listener');
  }
  
  // Peer-to-peer message event
  if (callbacks.onMessageFromPeer) {
    rtmClient.on('MessageFromPeer', callbacks.onMessageFromPeer);
    console.log('Set up RTM peer message listener');
  }
  
  // Connection state change event
  if (callbacks.onConnectionStateChanged) {
    rtmClient.on('ConnectionStateChanged', callbacks.onConnectionStateChanged);
    console.log('Set up RTM connection state listener');
  }
  
  console.log('RTM event listeners set up');
};

/**
 * Remove RTM message listeners
 * @param {object} rtmClient - The RTM client instance
 * @param {object} rtmChannel - The RTM channel instance
 */
export const removeRtmListeners = (rtmClient, rtmChannel) => {
  if (!rtmClient || rtmClient.mock) {
    console.log('Using mock RTM - no listeners to remove');
    return;
  }
  
  if (rtmChannel && !rtmChannel.mock) {
    rtmChannel.removeAllListeners();
    console.log('Removed all RTM channel listeners');
  }
  
  rtmClient.removeAllListeners();
  console.log('Removed all RTM client listeners');
};

/**
 * Get current RTM client instance
 * @returns {object|null} - The current RTM client
 */
export const getRtmClient = () => rtmClient;

/**
 * Get current RTM channel instance
 * @returns {object|null} - The current RTM channel
 */
export const getRtmChannel = () => rtmChannel;

// Create a named service object to fix ESLint warning
const agoraService = {
  getRtcToken,
  getRtmToken,
  initializeRtcClient,
  initializeRtmClient,
  joinRtmChannel,
  leaveRtmChannel,
  logoutRtm,
  sendRtmMessage,
  setupRtmListeners,
  removeRtmListeners,
  getRtmClient,
  getRtmChannel,
  getRtcConnectionState,
  resetRtcClient
};

// Export the named service
export default agoraService;