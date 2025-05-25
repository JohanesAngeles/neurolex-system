// server/src/controllers/notificationController.js
const User = require('../models/User');
const Notification = require('../models/Notification');
const { getIo } = require('../utils/socket');

/**
 * Create a notification
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
exports.createNotification = async (req, res) => {
  try {
    const { recipientId, title, message, type, data } = req.body;
    
    if (!recipientId || !title || !message || !type) {
      return res.status(400).json({
        success: false,
        error: 'Recipient ID, title, message, and type are required'
      });
    }
    
    const notification = await Notification.create({
      recipient: recipientId,
      sender: req.user ? req.user.id : null,
      title,
      message,
      type,
      data: data || {},
      read: false
    });
    
    // Emit the notification to the recipient via Socket.IO
    const io = getIo();
    if (io) {
      io.to(`user-${recipientId}`).emit('notification', {
        notification: {
          _id: notification._id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          data: notification.data,
          createdAt: notification.createdAt
        }
      });
    }
    
    return res.status(201).json({
      success: true,
      data: notification
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create notification'
    });
  }
};

/**
 * Create a call notification
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
exports.createCallNotification = async (req, res) => {
  try {
    const { recipientId, channelName, callType } = req.body;
    
    if (!recipientId || !channelName) {
      return res.status(400).json({
        success: false,
        error: 'Recipient ID and channel name are required'
      });
    }
    
    // Get caller info
    const senderId = req.user.id;
    const sender = await User.findById(senderId).select('name profilePicture');
    
    if (!sender) {
      return res.status(404).json({
        success: false,
        error: 'Caller not found'
      });
    }
    
    // Create notification data
    const callData = {
      callId: channelName,
      callType: callType || 'video',
      caller: {
        id: senderId,
        name: sender.name,
        profilePicture: sender.profilePicture
      }
    };
    
    // Create a notification record (optional)
    const notification = await Notification.create({
      recipient: recipientId,
      sender: senderId,
      title: 'Incoming Call',
      message: `${sender.name} is calling you`,
      type: 'call',
      data: callData,
      read: false
    });
    
    // Emit the call event via Socket.IO
    const io = getIo();
    if (io) {
      io.to(`user-${recipientId}`).emit('incomingCall', {
        callData,
        notification: {
          _id: notification._id,
          title: notification.title,
          message: notification.message,
          createdAt: notification.createdAt
        }
      });
    }
    
    return res.status(201).json({
      success: true,
      data: { 
        notification,
        callData
      }
    });
  } catch (error) {
    console.error('Error creating call notification:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create call notification'
    });
  }
};

/**
 * Get all notifications for the authenticated user
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      recipient: req.user.id
    })
    .sort({ createdAt: -1 })
    .populate('sender', 'name profilePicture');
    
    return res.status(200).json({
      success: true,
      count: notifications.length,
      data: notifications
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch notifications'
    });
  }
};

/**
 * Mark a notification as read
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user.id },
      { read: true },
      { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: notification
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to mark notification as read'
    });
  }
};

/**
 * Mark all notifications as read
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.id, read: false },
      { read: true }
    );
    
    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to mark all notifications as read'
    });
  }
};