// server/src/utils/socket.js
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

let io;

/**
 * Initialize Socket.IO server
 * @param {object} server - HTTP server instance
 * @returns {object} - Socket.IO server instance
 */
exports.initializeSocketServer = (server) => {
  io = socketIo(server, {
    cors: {
      origin: ['http://localhost:3000', 'http://localhost', '*'],
      methods: ['GET', 'POST'],
      credentials: true
    }
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
      
      // Get user from database
      const user = await User.findById(decoded.id);
      
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }
      
      // Attach user to socket
      socket.user = user;
      next();
    } catch (error) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.id}`);
    
    // Join user to their own room for private messages
    socket.join(`user-${socket.user.id}`);
    console.log(`User ${socket.user.id} joined their private room`);
    
    // Handle chat messages
    socket.on('send_message', async (data) => {
      try {
        // The recipient's user ID is used as the room name
        const recipientRoom = `user-${data.recipientId}`;
        
        // Emit the message to the recipient
        io.to(recipientRoom).emit('receive_message', {
          senderId: socket.user.id,
          conversationId: data.conversationId,
          content: data.content,
          timestamp: new Date()
        });
        
        // Emit a delivery notification back to the sender
        socket.emit('message_delivered', {
          messageId: data.messageId,
          conversationId: data.conversationId
        });
      } catch (error) {
        console.error('Socket message error:', error);
      }
    });
    
    // Handle joining a call room
    socket.on('joinCallRoom', (callId) => {
      socket.join(`call-${callId}`);
      console.log(`User ${socket.user.id} joined call room: ${callId}`);
    });
    
    // Handle leaving a call room
    socket.on('leaveCallRoom', (callId) => {
      socket.leave(`call-${callId}`);
      console.log(`User ${socket.user.id} left call room: ${callId}`);
    });
    
    // Handle call status updates
    socket.on('callStatus', ({ callId, status, targetUserId }) => {
      // Broadcast to the specific user
      if (targetUserId) {
        io.to(`user-${targetUserId}`).emit('callStatusUpdate', {
          callId,
          status,
          caller: {
            id: socket.user.id
          }
        });
      }
      // Or broadcast to the call room
      else if (callId) {
        socket.to(`call-${callId}`).emit('callStatusUpdate', {
          callId,
          status,
          caller: {
            id: socket.user.id
          }
        });
      }
    });
    
    // Disconnect handler
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.id}`);
    });
  });

  return io;
};

/**
 * Get the Socket.IO server instance
 * @returns {object|null} - Socket.IO server instance or null if not initialized
 */
exports.getIo = () => {
  if (!io) {
    console.warn('Socket.IO server not initialized');
    return null;
  }
  return io;
};