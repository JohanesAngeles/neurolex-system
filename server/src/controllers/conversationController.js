// server/src/controllers/conversationController.js
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const mongoose = require('mongoose');

// Helper function to validate MongoDB ObjectID
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

// Get all conversations for the current user
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`Getting conversations for user: ${userId}`);

    // Find all conversations where the current user is a participant
    const conversations = await Conversation.find({
      participants: userId
    })
    .sort({ updatedAt: -1 })
    .populate('participants', 'firstName lastName email profilePicture')
    .lean();

    console.log(`Found ${conversations.length} conversations`);

    // Process the conversations to get the format the frontend expects
    const formattedConversations = conversations.map(conversation => {
      // Find the other participant (not the current user)
      const recipient = conversation.participants.find(
        participant => participant._id.toString() !== userId.toString()
      );

      // Check if unreadCounts exists and is a Map-like object
      let unreadCount = 0;
      if (conversation.unreadCounts) {
        // Handle both Map objects and plain objects
        if (typeof conversation.unreadCounts.get === 'function') {
          // It's a Map
          unreadCount = conversation.unreadCounts.get(userId.toString()) || 0;
        } else if (typeof conversation.unreadCounts === 'object') {
          // It's a plain object (common when using .lean())
          unreadCount = conversation.unreadCounts[userId.toString()] || 0;
        }
      }

      return {
        id: conversation._id,
        recipientId: recipient._id,
        recipientName: `${recipient.firstName} ${recipient.lastName}`,
        recipientAvatar: recipient.profilePicture,
        lastMessage: conversation.lastMessage?.content || '',
        lastMessageTime: conversation.lastMessage?.timestamp || new Date(),
        unreadCount: unreadCount,
        // This would need to be implemented with a real-time system
        isOnline: false
      };
    });

    res.status(200).json({
      success: true,
      conversations: formattedConversations
    });
  } catch (error) {
    console.error('Error getting conversations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get conversations',
      error: error.message
    });
  }
};

// Get all users who can be messaged
exports.getUsers = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    // Get all users except the current user
    const users = await User.find({ 
      _id: { $ne: currentUserId } 
    })
    .select('_id firstName lastName email profilePicture')
    .lean();

    console.log(`Found ${users.length} users for user ${currentUserId}`);

    res.status(200).json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get users',
      error: error.message
    });
  }
};

// Create a new conversation or get existing one
exports.createOrGetConversation = async (req, res) => {
  try {
    const { recipientId } = req.body;
    const currentUserId = req.user.id;

    if (!recipientId) {
      return res.status(400).json({
        success: false,
        message: 'Recipient ID is required'
      });
    }

    // Check if the recipient user exists
    const recipientUser = await User.findById(recipientId);
    if (!recipientUser) {
      return res.status(404).json({
        success: false,
        message: 'Recipient not found'
      });
    }

    // Check if conversation already exists between these users
    let conversation = await Conversation.findOne({
      participants: {
        $all: [currentUserId, recipientId],
        $size: 2
      }
    }).populate('participants', 'firstName lastName email profilePicture');

    // If conversation doesn't exist, create a new one
    if (!conversation) {
      console.log(`Creating new conversation between ${currentUserId} and ${recipientId}`);
      // Initialize unreadCounts as an empty object
      const unreadCounts = {};
      unreadCounts[currentUserId.toString()] = 0;
      unreadCounts[recipientId.toString()] = 0;
      
      conversation = await Conversation.create({
        participants: [currentUserId, recipientId],
        lastMessage: {
          content: '',
          sender: null,
          timestamp: new Date(),
          read: false
        },
        unreadCounts: unreadCounts
      });

      // Populate the participants after creation
      conversation = await Conversation.findById(conversation._id)
        .populate('participants', 'firstName lastName email profilePicture');
    } else {
      console.log(`Found existing conversation between ${currentUserId} and ${recipientId}`);
    }

    // Find the recipient in the populated participants
    const recipient = conversation.participants.find(
      participant => participant._id.toString() === recipientId.toString()
    );

    // Get unreadCount safely
    let unreadCount = 0;
    if (conversation.unreadCounts) {
      if (typeof conversation.unreadCounts.get === 'function') {
        unreadCount = conversation.unreadCounts.get(currentUserId.toString()) || 0;
      } else if (typeof conversation.unreadCounts === 'object') {
        unreadCount = conversation.unreadCounts[currentUserId.toString()] || 0;
      }
    }

    // Format the response
    const conversationData = {
      id: conversation._id,
      recipientId: recipient._id,
      recipientName: `${recipient.firstName} ${recipient.lastName}`,
      recipientAvatar: recipient.profilePicture,
      lastMessage: conversation.lastMessage?.content || '',
      lastMessageTime: conversation.lastMessage?.timestamp || new Date(),
      unreadCount: unreadCount,
      isOnline: false // This would be implemented with a real-time system
    };

    res.status(200).json({
      success: true,
      conversation: conversationData
    });
  } catch (error) {
    console.error('Error creating/getting conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create or get conversation',
      error: error.message
    });
  }
};

// Get messages for a conversation
// Get messages for a conversation
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    console.log(`DETAILED DEBUG: Getting messages for conversation: ${conversationId}, user: ${userId}`);
    console.log(`DETAILED DEBUG: conversationId type: ${typeof conversationId}`);
    
    // Try to validate the ID
    const isValidId = mongoose.Types.ObjectId.isValid(conversationId);
    console.log(`DETAILED DEBUG: Is valid ObjectId: ${isValidId}`);

    if (!isValidId) {
      console.error(`DETAILED DEBUG: Invalid conversation ID format: ${conversationId}`);
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID format'
      });
    }

    // Find the conversation directly
    console.log(`DETAILED DEBUG: Attempting to find conversation with ID: ${conversationId}`);
    const conversation = await Conversation.findById(conversationId).lean();
    
    if (!conversation) {
      console.error(`DETAILED DEBUG: No conversation found with ID ${conversationId}`);
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }
    
    console.log(`DETAILED DEBUG: Found conversation: ${conversation._id}`);
    if (conversation.participants) {
      console.log(`DETAILED DEBUG: Participants: ${conversation.participants.join(', ')}`);
    }
    
    // Check if user is a participant
    const isParticipant = conversation.participants && conversation.participants.some(
      p => p.toString() === userId
    );
    
    if (!isParticipant) {
      console.error(`DETAILED DEBUG: User ${userId} is not a participant in conversation ${conversationId}`);
      return res.status(403).json({
        success: false,
        message: 'You are not a participant in this conversation'
      });
    }
    
    console.log(`DETAILED DEBUG: User ${userId} is a participant in conversation ${conversationId}`);

    // Get messages for the conversation
    console.log(`DETAILED DEBUG: Finding messages for conversation ${conversationId}`);
    const messages = await Message.find({ conversationId })
      .sort({ createdAt: 1 })
      .populate('sender', 'firstName lastName profilePicture')
      .lean();

    console.log(`DETAILED DEBUG: Found ${messages.length} messages for conversation ${conversationId}`);
    if (messages.length > 0) {
      console.log(`DETAILED DEBUG: First message sample: ${messages[0].content.substring(0, 30)}...`);
    }

    // Format the messages
    const formattedMessages = messages.map(message => ({
      _id: message._id,
      senderId: message.sender._id,
      senderName: `${message.sender.firstName} ${message.sender.lastName}`,
      senderAvatar: message.sender.profilePicture,
      content: message.content,
      timestamp: message.createdAt,
      status: message.status,
      isRead: message.readBy && Array.isArray(message.readBy) && 
              message.readBy.some(id => id.toString() === userId.toString())
    }));

    console.log(`DETAILED DEBUG: Successfully formatted ${formattedMessages.length} messages`);

    res.status(200).json({
      success: true,
      messages: formattedMessages
    });
  } catch (error) {
    console.error('DETAILED DEBUG ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get messages',
      error: error.message
    });
  }
};

// Send a message in a conversation
exports.sendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content } = req.body;
    const senderId = req.user.id;

    console.log(`Sending message to conversation: ${conversationId}, from user: ${senderId}`);

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }

    // Validate conversationId format
    if (!isValidObjectId(conversationId)) {
      console.error(`Invalid conversation ID format: ${conversationId}`);
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID format'
      });
    }

    // Validate if the conversation exists and user is a participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: senderId
    });

    if (!conversation) {
      console.error(`Conversation not found or user not participant. ID: ${conversationId}, User: ${senderId}`);
      return res.status(404).json({
        success: false,
        message: 'Conversation not found or you are not a participant'
      });
    }

    // Create the message
    const message = await Message.create({
      conversationId,
      sender: senderId,
      content,
      readBy: [senderId], // Mark as read by sender
      status: 'sent'
    });

    // Populate sender information
    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'firstName lastName profilePicture')
      .lean();

    // Update the conversation's last message
    conversation.lastMessage = {
      content,
      sender: senderId,
      timestamp: new Date(),
      read: false
    };
    
    // Update unread counts for other participants
    // Make sure unreadCounts is initialized if it doesn't exist
    if (!conversation.unreadCounts) {
      conversation.unreadCounts = {};
    }
    
    conversation.participants.forEach(participantId => {
      const participantIdStr = participantId.toString();
      if (participantIdStr !== senderId) {
        // Handle both Map and plain object
        if (typeof conversation.unreadCounts.get === 'function') {
          const currentCount = conversation.unreadCounts.get(participantIdStr) || 0;
          conversation.unreadCounts.set(participantIdStr, currentCount + 1);
        } else {
          const currentCount = conversation.unreadCounts[participantIdStr] || 0;
          conversation.unreadCounts[participantIdStr] = currentCount + 1;
        }
      }
    });
    
    conversation.updatedAt = new Date();
    await conversation.save();

    console.log(`Message sent successfully to conversation ${conversationId}`);

    // Format the message for response
    const formattedMessage = {
      _id: populatedMessage._id,
      senderId: populatedMessage.sender._id,
      senderName: `${populatedMessage.sender.firstName} ${populatedMessage.sender.lastName}`,
      senderAvatar: populatedMessage.sender.profilePicture,
      content: populatedMessage.content,
      timestamp: populatedMessage.createdAt,
      status: populatedMessage.status,
      isRead: populatedMessage.readBy && Array.isArray(populatedMessage.readBy) && 
              populatedMessage.readBy.some(id => id.toString() === senderId.toString())
    };

    res.status(201).json({
      success: true,
      message: formattedMessage
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message
    });
  }
};

// Mark a conversation as read
exports.markAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    console.log(`Marking conversation as read: ${conversationId}, user: ${userId}`);

    // Validate conversationId format
    if (!isValidObjectId(conversationId)) {
      console.error(`Invalid conversation ID format: ${conversationId}`);
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID format'
      });
    }

    // Validate if the conversation exists and user is a participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId
    });

    if (!conversation) {
      console.error(`Conversation not found or user not participant. ID: ${conversationId}, User: ${userId}`);
      return res.status(404).json({
        success: false,
        message: 'Conversation not found or you are not a participant'
      });
    }

    // Initialize unreadCounts if it doesn't exist
    if (!conversation.unreadCounts) {
      conversation.unreadCounts = {};
    }
    
    // Reset unread count for current user
    const userIdStr = userId.toString();
    if (typeof conversation.unreadCounts.get === 'function') {
      conversation.unreadCounts.set(userIdStr, 0);
    } else {
      conversation.unreadCounts[userIdStr] = 0;
    }
    
    await conversation.save();

    // Mark all messages in the conversation as read by this user
    await Message.updateMany(
      { 
        conversationId,
        sender: { $ne: userId }, // Only mark messages from others
        readBy: { $ne: userId }  // Not already read by user
      },
      { $addToSet: { readBy: userId } }
    );

    console.log(`Conversation ${conversationId} marked as read successfully`);

    res.status(200).json({
      success: true,
      message: 'Conversation marked as read'
    });
  } catch (error) {
    console.error('Error marking conversation as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark conversation as read',
      error: error.message
    });
  }
};



// Debug endpoint to check conversation and message access
exports.debugConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    console.log(`DEBUG: Checking conversation ${conversationId} for user ${userId}`);
    console.log(`DEBUG: conversationId type: ${typeof conversationId}`);
    
    // Try to validate the ID
    const isValidId = mongoose.Types.ObjectId.isValid(conversationId);
    console.log(`DEBUG: Is valid ObjectId: ${isValidId}`);

    if (!isValidId) {
      return res.status(400).json({
        success: false,
        debug: true,
        message: 'Invalid conversation ID format',
        conversationId
      });
    }

    // Step 1: Find the conversation directly
    const conversation = await Conversation.findById(conversationId).lean();
    
    if (!conversation) {
      console.log(`DEBUG: No conversation found with ID ${conversationId}`);
      return res.status(404).json({
        success: false,
        debug: true,
        message: 'Conversation not found',
        conversationId
      });
    }
    
    console.log(`DEBUG: Found conversation: ${conversation._id}`);
    console.log(`DEBUG: Participants: ${conversation.participants.join(', ')}`);
    
    // Step 2: Check if user is a participant
    const isParticipant = conversation.participants.some(
      p => p.toString() === userId
    );
    
    if (!isParticipant) {
      console.log(`DEBUG: User ${userId} is not a participant in conversation ${conversationId}`);
      return res.status(403).json({
        success: false,
        debug: true,
        message: 'User is not a participant in this conversation',
        userId,
        conversationId,
        participants: conversation.participants
      });
    }
    
    // Step 3: Find messages for this conversation
    const messages = await Message.find({ conversationId }).lean();
    
    console.log(`DEBUG: Found ${messages.length} messages for conversation ${conversationId}`);

    return res.status(200).json({
      success: true,
      debug: true,
      conversation,
      messageCount: messages.length,
      messages: messages.map(m => ({
        id: m._id,
        sender: m.sender,
        content: m.content
      }))
    });
  } catch (error) {
    console.error('DEBUG ERROR:', error);
    return res.status(500).json({
      success: false,
      debug: true,
      message: 'Debug endpoint error',
      error: error.message,
      stack: error.stack
    });
  }
};

module.exports = exports;