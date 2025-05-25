// client/src/services/conversationService.js
import axios from 'axios';

// Use the full URL including port for the API server
const API_BASE_URL = 'http://localhost:5000/api/conversations';

// Create a dedicated axios instance for conversation service
const conversationAxios = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

// Add token to requests
conversationAxios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
      console.log(`Making ${config.method.toUpperCase()} request to ${config.url} with auth token`);
    } else {
      console.warn('No token found in localStorage for request to:', config.url);
    }
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for error logging
conversationAxios.interceptors.response.use(
  (response) => {
    console.log(`Response from ${response.config.url}: Status ${response.status}`);
    return response.data;
  },
  (error) => {
    console.error('API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    return Promise.reject(error);
  }
);

// Get all conversations
const getConversations = async () => {
  try {
    console.log('Fetching all conversations');
    return await conversationAxios.get('/');
  } catch (error) {
    console.error('Error getting conversations:', error);
    throw error;
  }
};

// Get all users who can be messaged
const getUsers = async () => {
  try {
    console.log('Fetching all available users');
    const response = await conversationAxios.get('/users');
    
    if (response && response.users && response.users.length === 0) {
      console.log('API returned zero users');
    }
    
    return response;
  } catch (error) {
    console.error('Error getting users:', error);
    if (error.response) {
      console.error('Server response error:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('No response received from server');
    }
    throw error;
  }
};

// Create or get a conversation with a user
const createOrGetConversation = async (recipientId) => {
  try {
    console.log(`Creating/getting conversation with user ID: ${recipientId}`);
    return await conversationAxios.post('/', { recipientId });
  } catch (error) {
    console.error('Error creating/getting conversation:', error);
    throw error;
  }
};

// Get messages for a conversation
const getMessages = async (conversationId) => {
  try {
    console.log(`Fetching messages for conversation: ${conversationId}`);
    return await conversationAxios.get(`/${conversationId}/messages`);
  } catch (error) {
    console.error(`Error getting messages for conversation ${conversationId}:`, error);
    throw error;
  }
};

// Send a message in a conversation
const sendMessage = async (conversationId, content) => {
  try {
    console.log(`Sending message in conversation: ${conversationId}`);
    return await conversationAxios.post(`/${conversationId}/messages`, { content });
  } catch (error) {
    console.error(`Error sending message in conversation ${conversationId}:`, error);
    throw error;
  }
};

// Mark a conversation as read
const markAsRead = async (conversationId) => {
  try {
    console.log(`Marking conversation as read: ${conversationId}`);
    return await conversationAxios.put(`/${conversationId}/read`);
  } catch (error) {
    console.error(`Error marking conversation ${conversationId} as read:`, error);
    throw error;
  }
};

const conversationService = {
  getConversations,
  getUsers,
  createOrGetConversation,
  getMessages,
  sendMessage,
  markAsRead
};

export default conversationService;