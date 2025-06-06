// ADD THIS TO YOUR chatRoutes.js file:

const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Import middleware
const { protect } = require('../middleware/auth');

// Import chat controller
const chatController = require('../controllers/chatController');

// 🔥 NEW: Import socket service for webhook handling
const { handleStreamChatMessage } = require('../utils/socket');

/**
 * @route   POST /api/chat/token
 * @desc    Generate Stream Chat token for authenticated user
 * @access  Private - Requires authentication
 */
router.post('/token', protect, chatController.generateChatToken);

/**
 * @route   GET /api/chat/doctors
 * @desc    Get user's associated doctors for chat (from appointments + associations)
 * @access  Private - Requires authentication
 */
router.get('/doctors', protect, chatController.getAssociatedDoctors);

/**
 * @route   GET /api/chat/appointments
 * @desc    Get user's appointments for messaging context
 * @access  Private - Requires authentication
 */
router.get('/appointments', protect, chatController.getUserAppointmentsForMessaging);

// 🔥 NEW: Stream Chat Webhook Endpoint for FCM Notifications
/**
 * @route   POST /api/chat/webhook
 * @desc    Handle Stream Chat webhooks to trigger FCM notifications
 * @access  Public - Webhook from Stream Chat (with signature verification)
 */
router.post('/webhook', async (req, res) => {
  try {
    console.log('📨 Stream Chat webhook received');
    
    // 🔒 Verify webhook signature (important for security)
    const signature = req.get('x-signature');
    const body = JSON.stringify(req.body);
    const webhookSecret = process.env.STREAM_CHAT_WEBHOOK_SECRET;
    
    if (webhookSecret && signature) {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('hex');
      
      if (signature !== expectedSignature) {
        console.error('❌ Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }
    
    const { type, message, user, channel } = req.body;
    
    console.log(`📨 Webhook type: ${type}`);
    console.log(`📨 Channel: ${channel?.id}`);
    console.log(`📨 User: ${user?.id}`);
    
    // 🔥 Handle message.new events to trigger FCM notifications
    if (type === 'message.new' && message && user && channel) {
      
      // Skip notifications for system messages or commands
      if (message.type === 'system' || message.text?.startsWith('/')) {
        console.log('⚠️ Skipping system message or command');
        return res.status(200).json({ message: 'System message ignored' });
      }
      
      // Skip notifications from bots
      if (user.role === 'admin' || user.name?.toLowerCase().includes('bot')) {
        console.log('⚠️ Skipping bot message');
        return res.status(200).json({ message: 'Bot message ignored' });
      }
      
      console.log(`💬 Processing new message from ${user.id} in channel ${channel.id}`);
      
      // 🔥 Trigger FCM notifications for message recipients
      const result = await handleStreamChatMessage({
        user: {
          id: user.id,
          name: user.name || 'Unknown User'
        },
        message: {
          id: message.id,
          text: message.text || '',
          type: message.type,
          created_at: message.created_at
        },
        channel: {
          id: channel.id,
          type: channel.type,
          members: channel.members || []
        }
      });
      
      if (result.success) {
        console.log(`✅ FCM notifications sent to ${result.notificationsSent} recipients`);
        return res.status(200).json({ 
          message: 'Notifications sent successfully',
          recipients: result.notificationsSent 
        });
      } else {
        console.error('❌ Failed to send notifications:', result.error);
        return res.status(500).json({ error: 'Failed to send notifications' });
      }
    }
    
    // Handle other webhook types if needed
    else if (type === 'user.presence.changed') {
      console.log(`👤 User presence changed: ${user?.id} - ${req.body.user?.online ? 'online' : 'offline'}`);
      // You can handle user presence updates here
    }
    
    else if (type === 'channel.created' || type === 'channel.updated') {
      console.log(`📢 Channel event: ${type} - ${channel?.id}`);
      // Handle channel events if needed
    }
    
    else {
      console.log(`ℹ️ Unhandled webhook type: ${type}`);
    }
    
    // Always return success to Stream Chat
    return res.status(200).json({ message: 'Webhook processed' });
    
  } catch (error) {
    console.error('❌ Stream Chat webhook error:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// 🔥 NEW: Endpoint to update user FCM token
/**
 * @route   POST /api/chat/fcm-token
 * @desc    Update user's FCM token for push notifications
 * @access  Private - Requires authentication
 */
router.post('/fcm-token', protect, async (req, res) => {
  try {
    const { fcmToken, deviceInfo } = req.body;
    
    if (!fcmToken) {
      return res.status(400).json({
        success: false,
        error: 'FCM token is required'
      });
    }
    
    console.log(`🔥 Updating FCM token for user: ${req.user.id}`);
    
    // Get user model (with tenant support)
    const User = req.tenantConnection ? 
      req.tenantConnection.model('User') : 
      require('../models/User');
    
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Update FCM token and device info
    const updateSuccess = await user.updateFCMToken(fcmToken, deviceInfo);
    
    if (updateSuccess) {
      console.log(`✅ FCM token updated successfully for user: ${user.fullName}`);
      return res.status(200).json({
        success: true,
        message: 'FCM token updated successfully'
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Failed to update FCM token'
      });
    }
    
  } catch (error) {
    console.error('❌ Error updating FCM token:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update FCM token'
    });
  }
});

// 🔥 NEW: Endpoint to remove FCM token (logout)
/**
 * @route   DELETE /api/chat/fcm-token
 * @desc    Remove user's FCM token (when logging out)
 * @access  Private - Requires authentication
 */
router.delete('/fcm-token', protect, async (req, res) => {
  try {
    console.log(`🔥 Removing FCM token for user: ${req.user.id}`);
    
    // Get user model (with tenant support)
    const User = req.tenantConnection ? 
      req.tenantConnection.model('User') : 
      require('../models/User');
    
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Remove FCM token
    const removeSuccess = await user.removeFCMToken();
    
    if (removeSuccess) {
      console.log(`✅ FCM token removed successfully for user: ${user.fullName}`);
      return res.status(200).json({
        success: true,
        message: 'FCM token removed successfully'
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Failed to remove FCM token'
      });
    }
    
  } catch (error) {
    console.error('❌ Error removing FCM token:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to remove FCM token'
    });
  }
});

module.exports = router;