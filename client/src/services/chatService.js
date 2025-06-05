// client/src/services/chatService.js
import axios from 'axios';
import { StreamChat } from 'stream-chat';

// Stream Chat configuration
const STREAM_CHAT_API_KEY = process.env.REACT_APP_STREAM_CHAT_API_KEY || '9v6xtvf6dhtv';
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance for chat API calls
const chatApi = axios.create({
  baseURL: `${API_URL}/chat`,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token and tenant header to requests
chatApi.interceptors.request.use(
  (config) => {
    // Add authentication token
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Add tenant header
    const tenant = localStorage.getItem('tenant');
    if (tenant) {
      try {
        const tenantData = JSON.parse(tenant);
        if (tenantData && tenantData._id) {
          config.headers['X-Tenant-ID'] = tenantData._id;
          console.log(`🏢 Adding tenant header to chat request: ${tenantData._id}`);
        }
      } catch (error) {
        console.error('Error parsing tenant data for chat:', error);
      }
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

const chatService = {
  // Initialize Stream Chat client
  initializeStreamChat: async (userId, userDetails, token) => {
    try {
      console.log('🎯 Initializing Stream Chat client...');
      console.log('User ID:', userId);
      console.log('User Details:', userDetails);
      
      if (!STREAM_CHAT_API_KEY) {
        throw new Error('Stream Chat API key not configured');
      }
      
      if (!token) {
        throw new Error('Stream Chat token is required');
      }
      
      // Create Stream Chat client
      const client = StreamChat.getInstance(STREAM_CHAT_API_KEY);
      
      // Connect user to Stream Chat
      await client.connectUser(
        {
          id: userId,
          name: userDetails.name,
          image: userDetails.profilePicture,
          ...userDetails
        },
        token
      );
      
      console.log('✅ Stream Chat client initialized and user connected');
      return client;
      
    } catch (error) {
      console.error('❌ Error initializing Stream Chat:', error);
      throw new Error(`Failed to initialize Stream Chat: ${error.message}`);
    }
  },

  // Generate Stream Chat token for current user
  generateChatToken: async (userId = null) => {
    try {
      console.log('🔑 Generating Stream Chat token...');
      
      const response = await chatApi.post('/token', {
        userId: userId,
        action: 'generateToken'
      });
      
      if (response.data.success) {
        console.log('✅ Stream Chat token generated successfully');
        return response.data.data.token;
      } else {
        throw new Error(response.data.message || 'Failed to generate token');
      }
      
    } catch (error) {
      console.error('❌ Error generating chat token:', error);
      throw new Error(`Failed to generate chat token: ${error.message}`);
    }
  },

  // Get associated doctors for patient messaging
  getAssociatedDoctors: async () => {
    try {
      console.log('🔍 Getting associated doctors for messaging...');
      
      const response = await chatApi.get('/doctors');
      
      if (response.data.success) {
        console.log(`✅ Found ${response.data.count} associated doctors`);
        return response.data.data;
      } else {
        console.log('⚠️ No associated doctors found');
        return [];
      }
      
    } catch (error) {
      console.error('❌ Error getting associated doctors:', error);
      throw new Error(`Failed to get associated doctors: ${error.message}`);
    }
  },

  // Get user's appointments for messaging context
  getUserAppointments: async () => {
    try {
      console.log('🔍 Getting user appointments for messaging context...');
      
      const response = await chatApi.get('/appointments');
      
      if (response.data.success) {
        console.log(`✅ Found ${response.data.count} appointments for messaging`);
        return response.data.data;
      } else {
        console.log('⚠️ No appointments found for messaging');
        return [];
      }
      
    } catch (error) {
      console.error('❌ Error getting appointments for messaging:', error);
      throw new Error(`Failed to get appointments: ${error.message}`);
    }
  },

  // Create or get a channel between doctor and patient
  createDoctorPatientChannel: async (streamClient, doctorId, patientId, doctorInfo, patientInfo) => {
  try {
    console.log('💬 Creating/getting doctor-patient channel...');
    console.log('Doctor ID:', doctorId);
    console.log('Patient ID:', patientId);
    
    if (!streamClient) {
      throw new Error('Stream Chat client not initialized');
    }
    
    // 🚀 FIXED: Use consistent channel ID format (patient_doctor order)
    const channelId = `doctor_${patientId}_${doctorId}`;
    
    // Create channel
    const channel = streamClient.channel('messaging', channelId, {
      name: `Dr. ${doctorInfo.firstName} ${doctorInfo.lastName} & ${patientInfo.firstName} ${patientInfo.lastName}`,
      members: [doctorId, patientId],
      created_by_id: doctorId,
      doctor_id: doctorId,
      patient_id: patientId,
      channel_type: 'doctor_patient',
      doctor_name: `Dr. ${doctorInfo.firstName} ${doctorInfo.lastName}`,
      patient_name: `${patientInfo.firstName} ${patientInfo.lastName}`,
      tenant_id: getCurrentTenantId()
    });
    
    // Watch the channel (this creates it if it doesn't exist)
    await channel.watch();
    
    console.log('✅ Doctor-patient channel created/retrieved:', channelId);
    return channel;
    
  } catch (error) {
    console.error('❌ Error creating doctor-patient channel:', error);
    throw new Error(`Failed to create channel: ${error.message}`);
  }
},

// Get or create channel for patient-doctor communication  
getPatientDoctorChannel: async (streamClient, patientId, doctorId, patientInfo, doctorInfo) => {
  try {
    console.log('💬 Getting patient-doctor channel...');
    console.log('Patient ID:', patientId);
    console.log('Doctor ID:', doctorId);
    
    if (!streamClient) {
      throw new Error('Stream Chat client not initialized');
    }
    
    // 🚀 FIXED: Use SAME format as Flutter (patient_doctor order)
    const channelId = `doctor_${patientId}_${doctorId}`;
    
    // Create/get channel
    const channel = streamClient.channel('messaging', channelId, {
      name: `${patientInfo.firstName} ${patientInfo.lastName} & Dr. ${doctorInfo.firstName} ${doctorInfo.lastName}`,
      members: [patientId, doctorId],
      created_by_id: patientId,
      doctor_id: doctorId,
      patient_id: patientId,
      channel_type: 'doctor_patient',
      doctor_name: `Dr. ${doctorInfo.firstName} ${doctorInfo.lastName}`,
      patient_name: `${patientInfo.firstName} ${patientInfo.lastName}`,
      tenant_id: getCurrentTenantId()
    });
    
    // Watch the channel
    await channel.watch();
    
    console.log('✅ Patient-doctor channel retrieved:', channelId);
    return channel;
    
  } catch (error) {
    console.error('❌ Error getting patient-doctor channel:', error);
    throw new Error(`Failed to get channel: ${error.message}`);
  }
},

  // Send a message in a channel
  sendMessage: async (channel, messageText, senderType = 'user') => {
    try {
      if (!channel) {
        throw new Error('Channel not provided');
      }
      
      if (!messageText.trim()) {
        throw new Error('Message text cannot be empty');
      }
      
      console.log('📤 Sending message:', messageText.substring(0, 50) + '...');
      
      const message = await channel.sendMessage({
        text: messageText.trim(),
        sender_type: senderType,
        sent_at: new Date().toISOString()
      });
      
      console.log('✅ Message sent successfully');
      return message;
      
    } catch (error) {
      console.error('❌ Error sending message:', error);
      throw new Error(`Failed to send message: ${error.message}`);
    }
  },

  // Get channel messages with pagination
  getChannelMessages: async (channel, limit = 50, offset = 0) => {
    try {
      if (!channel) {
        throw new Error('Channel not provided');
      }
      
      console.log(`📥 Getting ${limit} messages with offset ${offset}...`);
      
      const state = await channel.query({
        messages: { 
          limit: limit,
          offset: offset
        }
      });
      
      const messages = state.messages || [];
      console.log(`✅ Retrieved ${messages.length} messages`);
      
      return messages;
      
    } catch (error) {
      console.error('❌ Error getting channel messages:', error);
      throw new Error(`Failed to get messages: ${error.message}`);
    }
  },

  // Mark channel as read
  markChannelAsRead: async (channel) => {
    try {
      if (!channel) {
        throw new Error('Channel not provided');
      }
      
      await channel.markRead();
      console.log('✅ Channel marked as read');
      
    } catch (error) {
      console.error('❌ Error marking channel as read:', error);
      // Don't throw error for marking as read - it's not critical
    }
  },

  // Get user's channels (conversations)
  getUserChannels: async (streamClient, userId) => {
    try {
      if (!streamClient) {
        throw new Error('Stream Chat client not initialized');
      }
      
      console.log('📋 Getting user channels...');
      
      // Query channels where user is a member
      const filter = { 
        members: { $in: [userId] },
        channel_type: 'doctor_patient'
      };
      
      const sort = { last_message_at: -1 };
      const channels = await streamClient.queryChannels(filter, sort, {
        watch: true,
        state: true
      });
      
      console.log(`✅ Found ${channels.length} channels for user`);
      return channels;
      
    } catch (error) {
      console.error('❌ Error getting user channels:', error);
      throw new Error(`Failed to get channels: ${error.message}`);
    }
  },

  // Disconnect Stream Chat client
  disconnectStreamChat: async (streamClient) => {
    try {
      if (streamClient) {
        console.log('🔌 Disconnecting Stream Chat client...');
        await streamClient.disconnectUser();
        console.log('✅ Stream Chat client disconnected');
      }
    } catch (error) {
      console.error('❌ Error disconnecting Stream Chat:', error);
      // Don't throw error for disconnect - it's cleanup
    }
  },

  // Listen for new messages in all user channels
  setupMessageListeners: (streamClient, onNewMessage) => {
    try {
      if (!streamClient) {
        throw new Error('Stream Chat client not initialized');
      }
      
      console.log('👂 Setting up message listeners...');
      
      // Listen for new messages across all channels
      streamClient.on('message.new', (event) => {
        console.log('📩 New message received:', event.message.text);
        if (onNewMessage) {
          onNewMessage(event);
        }
      });
      
      // Listen for channel updates
      streamClient.on('channel.updated', (event) => {
        console.log('🔄 Channel updated:', event.channel.id);
      });
      
      console.log('✅ Message listeners set up');
      
    } catch (error) {
      console.error('❌ Error setting up message listeners:', error);
    }
  },

  // Format message timestamp for display
  formatMessageTime: (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    const isYesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toDateString() === date.toDateString();
    if (isYesterday) return 'Yesterday';
    
    return date.toLocaleDateString();
  },

  // Validate Stream Chat configuration
  validateConfiguration: () => {
    const issues = [];
    
    if (!STREAM_CHAT_API_KEY) {
      issues.push('REACT_APP_STREAM_CHAT_API_KEY not configured');
    }
    
    if (!API_URL) {
      issues.push('REACT_APP_API_URL not configured');
    }
    
    const token = localStorage.getItem('token');
    if (!token) {
      issues.push('User authentication token not found');
    }
    
    if (issues.length > 0) {
      console.warn('⚠️ Stream Chat configuration issues:', issues);
      return { valid: false, issues };
    }
    
    console.log('✅ Stream Chat configuration validated');
    return { valid: true, issues: [] };
  }
};

// Helper function to get current tenant ID
function getCurrentTenantId() {
  try {
    const tenant = localStorage.getItem('tenant');
    if (tenant) {
      const tenantData = JSON.parse(tenant);
      return tenantData._id || null;
    }
  } catch (error) {
    console.error('Error getting tenant ID:', error);
  }
  return null;
}

export default chatService;