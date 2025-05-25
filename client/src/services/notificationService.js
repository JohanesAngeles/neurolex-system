// client/src/services/notificationService.js
import axios from 'axios';
import { getSocket } from './socketService';

const API_URL = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/notifications`;

// Get all notifications
const getNotifications = async () => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.get(API_URL, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data.data;
  } catch (error) {
    console.error('Error fetching notifications:', error);
    throw error;
  }
};

// Mark notification as read
const markAsRead = async (notificationId) => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.patch(`${API_URL}/${notificationId}/read`, {}, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data.data;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

// Mark all notifications as read
const markAllAsRead = async () => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.patch(`${API_URL}/read-all`, {}, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};

// Send a call notification
const sendCallNotification = async (recipientId, channelName, callType = 'video') => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.post(`${API_URL}/call`, 
      { 
        recipientId, 
        channelName, 
        callType 
      }, 
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    return response.data.data;
  } catch (error) {
    console.error('Error sending call notification:', error);
    throw error;
  }
};

// Update call status via socket
const updateCallStatus = (callId, status, targetUserId = null) => {
  const socket = getSocket();
  if (socket) {
    socket.emit('callStatus', { callId, status, targetUserId });
    return true;
  }
  return false;
};

// Join a call room via socket
const joinCallRoom = (callId) => {
  const socket = getSocket();
  if (socket) {
    socket.emit('joinCallRoom', callId);
    return true;
  }
  return false;
};

// Leave a call room via socket
const leaveCallRoom = (callId) => {
  const socket = getSocket();
  if (socket) {
    socket.emit('leaveCallRoom', callId);
    return true;
  }
  return false;
};

const notificationService = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  sendCallNotification,
  updateCallStatus,
  joinCallRoom,
  leaveCallRoom
};

export default notificationService;