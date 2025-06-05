// server/src/controllers/streamWebhookController.js
const crypto = require('crypto');
const notificationController = require('./notificationController');
const { getIo } = require('../utils/socket');

// Your Stream Chat webhook secret (set this in your .env file)
const STREAM_WEBHOOK_SECRET = process.env.STREAM_WEBHOOK_SECRET || 'your-webhook-secret';

/**
 * Handle Stream Chat webhooks
 * This gets called whenever a message is sent in Stream Chat
 */
exports.handleStreamWebhook = async (req, res) => {
  try {
    console.log('🔔 Stream Chat webhook received');
    console.log('📝 Webhook payload:', JSON.stringify(req.body, null, 2));
    
    // Verify webhook signature for security
    const isValidSignature = verifyWebhookSignature(req);
    if (!isValidSignature) {
      console.log('❌ Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    const { type, message, user, channel } = req.body;
    
    // Only handle new message events
    if (type === 'message.new') {
      console.log('💬 New message event detected');
      console.log('📨 Message:', message?.text);
      console.log('👤 From user:', user?.id);
      console.log('📢 In channel:', channel?.id);
      
      await handleNewMessageEvent(message, user, channel);
    }
    
    // Handle other events you might want notifications for
    else if (type === 'user.presence.changed') {
      console.log('👥 User presence changed:', user?.id, user?.online);
      // You could create notifications for when doctors come online
    }
    
    else if (type === 'channel.created') {
      console.log('📝 New channel created:', channel?.id);
      // You could create notifications for new conversation started
    }
    
    else {
      console.log(`🔄 Webhook event type '${type}' - no action needed`);
    }
    
    // Always respond with 200 to acknowledge receipt
    res.status(200).json({ success: true });
    
  } catch (error) {
    console.error('❌ Error handling Stream webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Handle new message events from Stream Chat
 */
async function handleNewMessageEvent(message, sender, channel) {
  try {
    console.log('🔔 Processing new message for notifications...');
    
    // Extract message details
    const messageText = message?.text || 'New message';
    const senderId = sender?.id;
    const senderName = sender?.name || `${sender?.first_name || ''} ${sender?.last_name || ''}`.trim();
    const channelId = channel?.id;
    
    if (!senderId) {
      console.log('❌ No sender ID found, skipping notification');
      return;
    }
    
    // Get channel members to find who should receive notifications
    const channelMembers = channel?.members || [];
    console.log('👥 Channel members:', channelMembers.map(m => m.user_id || m.user?.id));
    
    // Create notifications for all channel members except the sender
    for (const member of channelMembers) {
      const memberId = member.user_id || member.user?.id;
      
      if (memberId && memberId !== senderId) {
        console.log(`🔔 Creating notification for user: ${memberId}`);
        
        try {
          // Create notification using your existing notification controller
          await createMessageNotificationForUser({
            recipientId: memberId,
            senderId: senderId,
            senderName: senderName,
            messageContent: messageText,
            conversationId: channelId
          });
          
        } catch (notificationError) {
          console.error(`❌ Error creating notification for user ${memberId}:`, notificationError);
        }
      }
    }
    
    console.log('✅ Message notifications processed successfully');
    
  } catch (error) {
    console.error('❌ Error processing new message event:', error);
  }
}

/**
 * Create a message notification for a specific user
 */
async function createMessageNotificationForUser({ recipientId, senderId, senderName, messageContent, conversationId }) {
  try {
    console.log(`📱 Creating message notification: ${senderName} -> User ${recipientId}`);
    
    // Truncate long messages for notification
    const truncatedMessage = messageContent.length > 100 
      ? messageContent.substring(0, 100) + '...' 
      : messageContent;
    
    // Create notification in database
    const notificationData = {
      recipient: recipientId,
      sender: senderId,
      title: `New message from ${senderName}`,
      message: truncatedMessage,
      type: 'message',
      data: {
        conversationId: conversationId,
        messageContent: messageContent,
        senderName: senderName,
        timestamp: new Date().toISOString()
      }
    };
    
    // Use your existing notification creation logic
    const fakeReq = {
      user: { id: senderId },
      body: notificationData
    };
    
    const fakeRes = {
      status: (code) => ({
        json: (data) => {
          if (code === 201 || code === 200) {
            console.log(`✅ Notification created successfully for user ${recipientId}`);
            
            // Broadcast via Socket.io for real-time delivery
            broadcastNotificationViaSocket(recipientId, notificationData);
          } else {
            console.error(`❌ Failed to create notification: ${data.message}`);
          }
        }
      })
    };
    
    // Call your existing notification controller
    await notificationController.createNotification(fakeReq, fakeRes);
    
  } catch (error) {
    console.error('❌ Error creating message notification:', error);
  }
}

/**
 * Broadcast notification via Socket.io for real-time delivery
 */
function broadcastNotificationViaSocket(recipientId, notificationData) {
  try {
    const io = getIo();
    if (io) {
      console.log(`📡 Broadcasting notification via Socket.io to user: ${recipientId}`);
      
      // Emit to user's private room
      io.to(`user-${recipientId}`).emit('newMessage', {
        type: 'message',
        notification: notificationData,
        timestamp: new Date().toISOString()
      });
      
      // Also emit general notification event
      io.to(`user-${recipientId}`).emit('notification', {
        type: 'message',
        notification: notificationData,
        timestamp: new Date().toISOString()
      });
      
      console.log(`✅ Socket.io notification sent to user-${recipientId}`);
    } else {
      console.log('⚠️ Socket.io not available for real-time notification');
    }
    
  } catch (error) {
    console.error('❌ Error broadcasting notification via Socket.io:', error);
  }
}

/**
 * Verify Stream Chat webhook signature for security
 */
function verifyWebhookSignature(req) {
  try {
    // If no webhook secret is configured, skip verification (development only)
    if (!STREAM_WEBHOOK_SECRET || STREAM_WEBHOOK_SECRET === 'your-webhook-secret') {
      console.log('⚠️ No webhook secret configured - skipping signature verification');
      return true;
    }
    
    const signature = req.headers['x-signature'];
    const timestamp = req.headers['x-signature-timestamp'];
    
    if (!signature || !timestamp) {
      console.log('❌ Missing signature headers');
      return false;
    }
    
    // Create expected signature
    const body = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', STREAM_WEBHOOK_SECRET)
      .update(timestamp + body)
      .digest('hex');
    
    const isValid = signature === expectedSignature;
    console.log(`🔐 Webhook signature validation: ${isValid ? 'VALID' : 'INVALID'}`);
    
    return isValid;
    
  } catch (error) {
    console.error('❌ Error verifying webhook signature:', error);
    return false;
  }
}

/**
 * Handle test webhook endpoint
 */
exports.testWebhook = async (req, res) => {
  console.log('🧪 Test webhook endpoint called');
  console.log('📝 Test payload:', req.body);
  
  res.status(200).json({
    success: true,
    message: 'Test webhook received successfully',
    timestamp: new Date().toISOString()
  });
};

module.exports = exports;