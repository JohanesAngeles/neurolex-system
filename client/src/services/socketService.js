// src/services/socketService.js
import { io } from 'socket.io-client';

let socket = null;

// Initialize socket connection
export const initializeSocket = () => {
  if (socket) {
    socket.disconnect();
  }

  const token = localStorage.getItem('token');
  
  if (!token) {
    console.warn('No token found, socket connection aborted');
    return null;
  }
  
  // Determine the correct base URL
  // We need to ensure we connect to the same host/port as the current page
  // This helps avoid cross-origin issues in development
  const getBaseUrl = () => {
    // First try environment variable
    if (process.env.REACT_APP_API_URL) {
      return process.env.REACT_APP_API_URL;
    }
    
    // If we're running on localhost:3000, the backend is likely on port 3000 as well
    if (window.location.hostname === 'localhost') {
      return `${window.location.protocol}//${window.location.hostname}:${window.location.port}`;
    }
    
    // For production, use the same origin
    return window.location.origin;
  };

  const baseUrl = getBaseUrl();
  console.log(`Connecting socket to: ${baseUrl}`);

  // Create socket connection with proper path
  socket = io(baseUrl, {
    auth: { token },
    path: '/socket.io/', // Make sure path matches server setup
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    transports: ['websocket', 'polling'] // Try websocket first, fallback to polling
  });

  // Event listeners
  socket.on('connect', () => {
    console.log('Socket connected successfully');
  });

  socket.on('disconnect', (reason) => {
    console.log(`Socket disconnected: ${reason}`);
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error.message);
    
    // For debugging only - log extra details
    console.debug('Socket connection details:', {
      url: baseUrl,
      transport: socket.io.engine.transport.name,
      protocol: window.location.protocol,
      readyState: socket.io.engine.readyState
    });
  });

  // Listen for namespace errors
  socket.on('error', (error) => {
    if (error.type === 'UnauthorizedError' || error.code === 'invalid_token') {
      console.error('Socket authentication failed, token may be invalid');
      // Optionally redirect to login
      // window.location.href = '/login';
    }
  });

  return socket;
};

// Get the current socket instance
export const getSocket = () => {
  if (!socket) {
    return initializeSocket();
  }
  return socket;
};

// Emit an event through the socket
export const emitEvent = (eventName, data, callback) => {
  const currentSocket = getSocket();
  if (currentSocket) {
    currentSocket.emit(eventName, data, callback);
    return true;
  }
  console.warn(`Failed to emit ${eventName}: Socket not connected`);
  return false;
};

// Subscribe to an event
export const onEvent = (eventName, callback) => {
  const currentSocket = getSocket();
  if (currentSocket) {
    currentSocket.on(eventName, callback);
    return () => currentSocket.off(eventName, callback); // Return unsubscribe function
  }
  console.warn(`Failed to subscribe to ${eventName}: Socket not connected`);
  return () => {}; // Empty unsubscribe function
};

// Close socket connection
export const closeSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log('Socket connection closed');
  }
};

// eslint-disable-next-line import/no-anonymous-default-export
export default {
  initializeSocket,
  getSocket,
  emitEvent,
  onEvent,
  closeSocket
};