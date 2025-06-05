// server/src/controllers/notificationController.js - ENHANCED VERSION
const User = require('../models/User');
const Notification = require('../models/Notification');
const { getIo } = require('../utils/socket');

/**
 * Create a notification with enhanced real-time features
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

    // Populate sender info for real-time emission
    await notification.populate('sender', 'name profilePicture');
    
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
          sender: notification.sender,
          createdAt: notification.createdAt,
          read: false
        }
      });

      // Also emit notification count update
      const unreadCount = await Notification.countDocuments({
        recipient: recipientId,
        read: false
      });

      io.to(`user-${recipientId}`).emit('notificationCountUpdate', {
        unreadCount
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
 * Create assignment notification
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
exports.createAssignmentNotification = async (req, res) => {
  try {
    const { patientId, assignmentType, assignmentData } = req.body;
    
    if (!patientId || !assignmentType) {
      return res.status(400).json({
        success: false,
        error: 'Patient ID and assignment type are required'
      });
    }

    // Get doctor info
    const doctorId = req.user.id;
    const doctor = await User.findById(doctorId).select('name profilePicture');
    
    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: 'Doctor not found'
      });
    }

    let title, message;
    switch (assignmentType) {
      case 'journal_template':
        title = 'New Journal Assignment';
        message = `Dr. ${doctor.name} has assigned you a new journal template`;
        break;
      case 'mood_tracking':
        title = 'Mood Tracking Reminder';
        message = `Dr. ${doctor.name} wants you to track your mood`;
        break;
      case 'appointment':
        title = 'New Appointment Scheduled';
        message = `Dr. ${doctor.name} has scheduled a new appointment`;
        break;
      case 'medication_reminder':
        title = 'Medication Reminder';
        message = `Dr. ${doctor.name} has updated your medication schedule`;
        break;
      default:
        title = 'New Assignment';
        message = `Dr. ${doctor.name} has assigned you a new task`;
    }

    // Create notification
    const notification = await Notification.create({
      recipient: patientId,
      sender: doctorId,
      title,
      message,
      type: 'assignment',
      data: {
        assignmentType,
        doctorInfo: {
          id: doctorId,
          name: doctor.name,
          profilePicture: doctor.profilePicture
        },
        ...assignmentData
      },
      read: false
    });

    await notification.populate('sender', 'name profilePicture');

    // Emit real-time notification
    const io = getIo();
    if (io) {
      io.to(`user-${patientId}`).emit('notification', {
        notification: {
          _id: notification._id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          data: notification.data,
          sender: notification.sender,
          createdAt: notification.createdAt,
          read: false
        }
      });

      // Emit specific assignment event
      io.to(`user-${patientId}`).emit('newAssignment', {
        assignmentType,
        notification: notification
      });

      // Update notification count
      const unreadCount = await Notification.countDocuments({
        recipient: patientId,
        read: false
      });

      io.to(`user-${patientId}`).emit('notificationCountUpdate', {
        unreadCount
      });
    }

    return res.status(201).json({
      success: true,
      data: notification
    });
  } catch (error) {
    console.error('Error creating assignment notification:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create assignment notification'
    });
  }
};

/**
 * Create message notification
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
exports.createMessageNotification = async (req, res) => {
  try {
    const { recipientId, messageContent, conversationId } = req.body;
    
    if (!recipientId || !messageContent) {
      return res.status(400).json({
        success: false,
        error: 'Recipient ID and message content are required'
      });
    }

    // Get sender info
    const senderId = req.user.id;
    const sender = await User.findById(senderId).select('name profilePicture');
    
    if (!sender) {
      return res.status(404).json({
        success: false,
        error: 'Sender not found'
      });
    }

    // Create notification
    const notification = await Notification.create({
      recipient: recipientId,
      sender: senderId,
      title: 'New Message',
      message: `${sender.name}: ${messageContent.substring(0, 50)}${messageContent.length > 50 ? '...' : ''}`,
      type: 'message',
      data: {
        conversationId,
        messagePreview: messageContent.substring(0, 100),
        senderInfo: {
          id: senderId,
          name: sender.name,
          profilePicture: sender.profilePicture
        }
      },
      read: false
    });

    await notification.populate('sender', 'name profilePicture');

    // Emit real-time notification
    const io = getIo();
    if (io) {
      io.to(`user-${recipientId}`).emit('notification', {
        notification: {
          _id: notification._id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          data: notification.data,
          sender: notification.sender,
          createdAt: notification.createdAt,
          read: false
        }
      });

      // Emit specific message notification event
      io.to(`user-${recipientId}`).emit('newMessage', {
        conversationId,
        notification: notification
      });

      // Update notification count
      const unreadCount = await Notification.countDocuments({
        recipient: recipientId,
        read: false
      });

      io.to(`user-${recipientId}`).emit('notificationCountUpdate', {
        unreadCount
      });
    }

    return res.status(201).json({
      success: true,
      data: notification
    });
  } catch (error) {
    console.error('Error creating message notification:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create message notification'
    });
  }
};

/**
 * Create system notification
 * @param {object} req - Express request object  
 * @param {object} res - Express response object
 */
exports.createSystemNotification = async (req, res) => {
  try {
    const { recipientId, systemEvent, eventData } = req.body;
    
    if (!recipientId || !systemEvent) {
      return res.status(400).json({
        success: false,
        error: 'Recipient ID and system event are required'
      });
    }

    let title, message;
    switch (systemEvent) {
      case 'profile_updated':
        title = 'Profile Updated';
        message = 'Your profile information has been successfully updated';
        break;
      case 'appointment_reminder':
        title = 'Appointment Reminder';
        message = `You have an upcoming appointment in 24 hours`;
        break;
      case 'mood_reminder':
        title = 'Mood Check-in';
        message = 'Time for your daily mood check-in!';
        break;
      case 'journal_reminder':
        title = 'Journal Reminder';
        message = 'Take a moment to reflect and write in your journal';
        break;
      case 'session_completed':
        title = 'Session Completed';
        message = 'Your therapy session has been marked as completed';
        break;
      default:
        title = 'System Update';
        message = 'You have a new system notification';
    }

    // Create notification
    const notification = await Notification.create({
      recipient: recipientId,
      sender: null, // System notifications don't have a sender
      title,
      message,
      type: 'system',
      data: {
        systemEvent,
        ...eventData
      },
      read: false
    });

    // Emit real-time notification
    const io = getIo();
    if (io) {
      io.to(`user-${recipientId}`).emit('notification', {
        notification: {
          _id: notification._id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          data: notification.data,
          sender: null,
          createdAt: notification.createdAt,
          read: false
        }
      });

      // Emit specific system event
      io.to(`user-${recipientId}`).emit('systemNotification', {
        systemEvent,
        notification: notification
      });

      // Update notification count
      const unreadCount = await Notification.countDocuments({
        recipient: recipientId,
        read: false
      });

      io.to(`user-${recipientId}`).emit('notificationCountUpdate', {
        unreadCount
      });
    }

    return res.status(201).json({
      success: true,
      data: notification
    });
  } catch (error) {
    console.error('Error creating system notification:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create system notification'
    });
  }
};

/**
 * Create a call notification (existing function enhanced)
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
    
    // Create a notification record
    const notification = await Notification.create({
      recipient: recipientId,
      sender: senderId,
      title: 'Incoming Call',
      message: `${sender.name} is calling you`,
      type: 'call',
      data: callData,
      read: false
    });

    await notification.populate('sender', 'name profilePicture');
    
    // Emit the call event via Socket.IO
    const io = getIo();
    if (io) {
      // Emit incoming call event
      io.to(`user-${recipientId}`).emit('incomingCall', {
        callData,
        notification: {
          _id: notification._id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          data: notification.data,
          sender: notification.sender,
          createdAt: notification.createdAt
        }
      });

      // Also emit as regular notification
      io.to(`user-${recipientId}`).emit('notification', {
        notification: {
          _id: notification._id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          data: notification.data,
          sender: notification.sender,
          createdAt: notification.createdAt,
          read: false
        }
      });

      // Update notification count
      const unreadCount = await Notification.countDocuments({
        recipient: recipientId,
        read: false
      });

      io.to(`user-${recipientId}`).emit('notificationCountUpdate', {
        unreadCount
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
 * Get all notifications for the authenticated user (enhanced)
 */
exports.getNotifications = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const notifications = await Notification.find({
      recipient: req.user.id
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('sender', 'name profilePicture');

    const totalNotifications = await Notification.countDocuments({
      recipient: req.user.id
    });

    const unreadCount = await Notification.countDocuments({
      recipient: req.user.id,
      read: false
    });
    
    return res.status(200).json({
      success: true,
      count: notifications.length,
      totalCount: totalNotifications,
      unreadCount,
      currentPage: page,
      totalPages: Math.ceil(totalNotifications / limit),
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
 * Mark a notification as read (enhanced)
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

    // Emit updated notification count
    const io = getIo();
    if (io) {
      const unreadCount = await Notification.countDocuments({
        recipient: req.user.id,
        read: false
      });

      io.to(`user-${req.user.id}`).emit('notificationCountUpdate', {
        unreadCount
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
 * Mark all notifications as read (enhanced)
 */
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.id, read: false },
      { read: true }
    );

    // Emit updated notification count
    const io = getIo();
    if (io) {
      io.to(`user-${req.user.id}`).emit('notificationCountUpdate', {
        unreadCount: 0
      });
    }
    
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

/**
 * Get notification count
 */
exports.getNotificationCount = async (req, res) => {
  try {
    const unreadCount = await Notification.countDocuments({
      recipient: req.user.id,
      read: false
    });

    const totalCount = await Notification.countDocuments({
      recipient: req.user.id
    });

    return res.status(200).json({
      success: true,
      data: {
        unreadCount,
        totalCount
      }
    });
  } catch (error) {
    console.error('Error fetching notification count:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch notification count'
    });
  }
};