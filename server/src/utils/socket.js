// server/src/utils/socket.js - ENHANCED VERSION
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Notification = require('../models/Notification');

let io;

/**
 * Initialize Socket.IO server with enhanced real-time notifications
 * @param {object} server - HTTP server instance
 * @returns {object} - Socket.IO server instance
 */
exports.initializeSocketServer = (server) => {
  io = socketIo(server, {
    cors: {
      origin: ['http://localhost:3000', 'http://localhost', '*'],
      methods: ['GET', 'POST'],
      credentials: true
    },
    // Enhanced configuration for better real-time performance
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error: Token not provided'));
      }
      
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from database with role information
      const user = await User.findById(decoded.id).select('name email role profilePicture isOnline lastSeen');
      
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }
      
      // Attach user to socket
      socket.user = user;
      
      console.log(`🔐 Socket authenticated for user: ${user.name} (${user.role}) - ID: ${user._id}`);
      next();
    } catch (error) {
      console.error('🚫 Socket authentication failed:', error.message);
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  // Connection handler with enhanced features
  io.on('connection', async (socket) => {
    try {
      console.log(`\n🔌 User connected: ${socket.user.name} (${socket.user.role})`);
      console.log(`📱 Socket ID: ${socket.id}`);
      console.log(`👤 User ID: ${socket.user.id}`);
      
      // Join user to their private notification room
      const userRoom = `user-${socket.user.id}`;
      socket.join(userRoom);
      console.log(`🏠 User joined private room: ${userRoom}`);
      
      // Join role-based rooms for broadcast notifications
      const roleRoom = `role-${socket.user.role}`;
      socket.join(roleRoom);
      console.log(`👥 User joined role room: ${roleRoom}`);
      
      // Update user online status
      await updateUserOnlineStatus(socket.user.id, true);
      
      // Send initial notification count
      await sendNotificationCount(socket.user.id);
      
      // Send any missed notifications while offline
      await sendMissedNotifications(socket.user.id);
      
      // Notify other users that this user is online (for doctors/patients)
      socket.broadcast.emit('userOnlineStatus', {
        userId: socket.user.id,
        name: socket.user.name,
        isOnline: true,
        timestamp: new Date()
      });

      // 💬 CHAT MESSAGE HANDLING (Enhanced)
      socket.on('send_message', async (data) => {
        try {
          console.log(`💬 Message from ${socket.user.name} to user ${data.recipientId}`);
          
          const recipientRoom = `user-${data.recipientId}`;
          
          // Emit the message to the recipient
          io.to(recipientRoom).emit('receive_message', {
            senderId: socket.user.id,
            senderName: socket.user.name,
            senderProfilePicture: socket.user.profilePicture,
            conversationId: data.conversationId,
            content: data.content,
            timestamp: new Date(),
            messageType: data.messageType || 'text'
          });
          
          // Create a message notification if recipient is not in the same conversation
          const notificationData = {
            recipientId: data.recipientId,
            messageContent: data.content,
            conversationId: data.conversationId
          };
          
          // Trigger message notification creation
          await createMessageNotification(socket.user.id, notificationData);
          
          // Emit delivery confirmation to sender
          socket.emit('message_delivered', {
            messageId: data.messageId,
            conversationId: data.conversationId,
            timestamp: new Date()
          });
          
        } catch (error) {
          console.error('💬 Socket message error:', error);
          socket.emit('message_error', {
            error: 'Failed to send message',
            messageId: data.messageId
          });
        }
      });

      // 📞 CALL HANDLING (Enhanced)
      socket.on('joinCallRoom', (callId) => {
        socket.join(`call-${callId}`);
        console.log(`📞 User ${socket.user.name} joined call room: ${callId}`);
        
        // Notify others in the call
        socket.to(`call-${callId}`).emit('userJoinedCall', {
          userId: socket.user.id,
          userName: socket.user.name,
          userProfilePicture: socket.user.profilePicture
        });
      });
      
      socket.on('leaveCallRoom', (callId) => {
        socket.leave(`call-${callId}`);
        console.log(`📞 User ${socket.user.name} left call room: ${callId}`);
        
        // Notify others in the call
        socket.to(`call-${callId}`).emit('userLeftCall', {
          userId: socket.user.id,
          userName: socket.user.name
        });
      });
      
      socket.on('callStatus', ({ callId, status, targetUserId }) => {
        console.log(`📞 Call status update: ${status} for call ${callId}`);
        
        if (targetUserId) {
          io.to(`user-${targetUserId}`).emit('callStatusUpdate', {
            callId,
            status,
            caller: {
              id: socket.user.id,
              name: socket.user.name,
              profilePicture: socket.user.profilePicture
            }
          });
        } else if (callId) {
          socket.to(`call-${callId}`).emit('callStatusUpdate', {
            callId,
            status,
            caller: {
              id: socket.user.id,
              name: socket.user.name
            }
          });
        }
      });

      // 🔔 NOTIFICATION HANDLING
      socket.on('markNotificationRead', async (notificationId) => {
        try {
          await Notification.findOneAndUpdate(
            { _id: notificationId, recipient: socket.user.id },
            { read: true }
          );
          
          // Send updated notification count
          await sendNotificationCount(socket.user.id);
          
          console.log(`🔔 Notification ${notificationId} marked as read by ${socket.user.name}`);
        } catch (error) {
          console.error('🔔 Error marking notification as read:', error);
        }
      });

      socket.on('markAllNotificationsRead', async () => {
        try {
          await Notification.updateMany(
            { recipient: socket.user.id, read: false },
            { read: true }
          );
          
          // Send updated notification count
          await sendNotificationCount(socket.user.id);
          
          console.log(`🔔 All notifications marked as read by ${socket.user.name}`);
        } catch (error) {
          console.error('🔔 Error marking all notifications as read:', error);
        }
      });

      // 📋 ASSIGNMENT HANDLING
      socket.on('assignmentCompleted', async (assignmentData) => {
        try {
          console.log(`📋 Assignment completed by ${socket.user.name}:`, assignmentData);
          
          // Notify the doctor about assignment completion
          if (assignmentData.doctorId) {
            io.to(`user-${assignmentData.doctorId}`).emit('assignmentUpdate', {
              type: 'completed',
              patientId: socket.user.id,
              patientName: socket.user.name,
              assignmentId: assignmentData.assignmentId,
              assignmentType: assignmentData.assignmentType,
              completedAt: new Date()
            });

            // Create notification for doctor
            await createSystemNotification(assignmentData.doctorId, {
              systemEvent: 'assignment_completed',
              eventData: {
                patientId: socket.user.id,
                patientName: socket.user.name,
                assignmentType: assignmentData.assignmentType
              }
            });
          }
        } catch (error) {
          console.error('📋 Error handling assignment completion:', error);
        }
      });

      // 💭 MOOD TRACKING
      socket.on('moodUpdated', async (moodData) => {
        try {
          console.log(`💭 Mood updated by ${socket.user.name}:`, moodData);
          
          // Notify connected doctors about mood update
          if (socket.user.role === 'patient' && moodData.doctorId) {
            io.to(`user-${moodData.doctorId}`).emit('patientMoodUpdate', {
              patientId: socket.user.id,
              patientName: socket.user.name,
              moodData: moodData,
              timestamp: new Date()
            });
          }
        } catch (error) {
          console.error('💭 Error handling mood update:', error);
        }
      });

      // 🌐 SYSTEM EVENTS
      socket.on('systemEvent', async (eventData) => {
        try {
          console.log(`🌐 System event from ${socket.user.name}:`, eventData);
          
          // Handle different system events
          switch (eventData.type) {
            case 'profile_updated':
              // Notify connections about profile update
              socket.broadcast.emit('userProfileUpdate', {
                userId: socket.user.id,
                updates: eventData.updates
              });
              break;
            case 'appointment_scheduled':
              // Notify patient about new appointment
              if (eventData.patientId) {
                io.to(`user-${eventData.patientId}`).emit('appointmentUpdate', {
                  type: 'scheduled',
                  appointment: eventData.appointmentData
                });
              }
              break;
          }
        } catch (error) {
          console.error('🌐 Error handling system event:', error);
        }
      });

      // 🔄 REAL-TIME STATUS UPDATES
      socket.on('typing', (data) => {
        socket.to(`user-${data.recipientId}`).emit('userTyping', {
          userId: socket.user.id,
          userName: socket.user.name,
          conversationId: data.conversationId
        });
      });

      socket.on('stopTyping', (data) => {
        socket.to(`user-${data.recipientId}`).emit('userStoppedTyping', {
          userId: socket.user.id,
          conversationId: data.conversationId
        });
      });

      // 📱 CLIENT RECONNECTION HANDLING
      socket.on('requestSync', async () => {
        console.log(`🔄 Sync requested by ${socket.user.name}`);
        
        // Send fresh notification count
        await sendNotificationCount(socket.user.id);
        
        // Send any missed notifications
        await sendMissedNotifications(socket.user.id);
        
        socket.emit('syncComplete', {
          timestamp: new Date(),
          message: 'Data synchronized successfully'
        });
      });

      // 🚫 DISCONNECT HANDLER
      socket.on('disconnect', async () => {
        try {
          console.log(`🔌 User disconnected: ${socket.user.name}`);
          
          // Update user offline status
          await updateUserOnlineStatus(socket.user.id, false);
          
          // Notify other users that this user is offline
          socket.broadcast.emit('userOnlineStatus', {
            userId: socket.user.id,
            name: socket.user.name,
            isOnline: false,
            lastSeen: new Date()
          });
          
        } catch (error) {
          console.error('🚫 Error handling disconnect:', error);
        }
      });

    } catch (error) {
      console.error('🔌 Connection error:', error);
      socket.disconnect();
    }
  });

  return io;
};

/**
 * Get the Socket.IO server instance
 * @returns {object|null} - Socket.IO server instance or null if not initialized
 */
exports.getIo = () => {
  if (!io) {
    console.warn('⚠️ Socket.IO server not initialized');
    return null;
  }
  return io;
};

// 🔧 HELPER FUNCTIONS

/**
 * Update user online status
 */
async function updateUserOnlineStatus(userId, isOnline) {
  try {
    await User.findByIdAndUpdate(userId, {
      isOnline,
      lastSeen: new Date()
    });
  } catch (error) {
    console.error('❌ Error updating user online status:', error);
  }
}

/**
 * Send notification count to user
 */
async function sendNotificationCount(userId) {
  try {
    const unreadCount = await Notification.countDocuments({
      recipient: userId,
      read: false
    });

    const totalCount = await Notification.countDocuments({
      recipient: userId
    });

    if (io) {
      io.to(`user-${userId}`).emit('notificationCountUpdate', {
        unreadCount,
        totalCount,
        timestamp: new Date()
      });
    }
  } catch (error) {
    console.error('❌ Error sending notification count:', error);
  }
}

/**
 * Send missed notifications to user
 */
async function sendMissedNotifications(userId) {
  try {
    // Get recent unread notifications (last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const missedNotifications = await Notification.find({
      recipient: userId,
      read: false,
      createdAt: { $gte: twentyFourHoursAgo }
    })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate('sender', 'name profilePicture');

    if (missedNotifications.length > 0 && io) {
      io.to(`user-${userId}`).emit('missedNotifications', {
        notifications: missedNotifications,
        count: missedNotifications.length
      });
      
      console.log(`📫 Sent ${missedNotifications.length} missed notifications to user ${userId}`);
    }
  } catch (error) {
    console.error('❌ Error sending missed notifications:', error);
  }
}

/**
 * Create message notification
 */
async function createMessageNotification(senderId, notificationData) {
  try {
    const sender = await User.findById(senderId).select('name profilePicture');
    
    if (!sender) return;

    const notification = await Notification.create({
      recipient: notificationData.recipientId,
      sender: senderId,
      title: 'New Message',
      message: `${sender.name}: ${notificationData.messageContent.substring(0, 50)}${notificationData.messageContent.length > 50 ? '...' : ''}`,
      type: 'message',
      data: {
        conversationId: notificationData.conversationId,
        messagePreview: notificationData.messageContent.substring(0, 100),
        senderInfo: {
          id: senderId,
          name: sender.name,
          profilePicture: sender.profilePicture
        }
      },
      read: false
    });

    await notification.populate('sender', 'name profilePicture');

    // Emit notification
    if (io) {
      io.to(`user-${notificationData.recipientId}`).emit('notification', {
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
      await sendNotificationCount(notificationData.recipientId);
    }
  } catch (error) {
    console.error('❌ Error creating message notification:', error);
  }
}

/**
 * Create system notification
 */
async function createSystemNotification(recipientId, notificationData) {
  try {
    let title, message;
    const { systemEvent, eventData } = notificationData;
    
    switch (systemEvent) {
      case 'assignment_completed':
        title = 'Assignment Completed';
        message = `${eventData.patientName} has completed their ${eventData.assignmentType}`;
        break;
      case 'mood_alert':
        title = 'Mood Alert';
        message = `${eventData.patientName} has reported concerning mood changes`;
        break;
      default:
        title = 'System Update';
        message = 'You have a new system notification';
    }

    const notification = await Notification.create({
      recipient: recipientId,
      sender: null,
      title,
      message,
      type: 'system',
      data: eventData,
      read: false
    });

    // Emit notification
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

      // Update notification count
      await sendNotificationCount(recipientId);
    }
  } catch (error) {
    console.error('❌ Error creating system notification:', error);
  }
}

/**
 * Broadcast notification to role-based rooms
 */
exports.broadcastToRole = (role, event, data) => {
  if (io) {
    io.to(`role-${role}`).emit(event, data);
    console.log(`📢 Broadcasted ${event} to role: ${role}`);
  }
};

/**
 * Send notification to specific user
 */
exports.sendNotificationToUser = (userId, notification) => {
  if (io) {
    io.to(`user-${userId}`).emit('notification', { notification });
    console.log(`📨 Sent notification to user: ${userId}`);
  }
};