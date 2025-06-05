// server/src/controllers/streamWebhookController.js - ENHANCED WITH MOBILE PUSH NOTIFICATIONS
const crypto = require('crypto');
const admin = require('firebase-admin');
const notificationController = require('./notificationController');
const { getIo } = require('../utils/socket');
const User = require('../models/User');

// Your Stream Chat webhook secret (set this in your .env file)
const STREAM_WEBHOOK_SECRET = process.env.STREAM_WEBHOOK_SECRET || 'your-webhook-secret';

// 🔥 FIREBASE ADMIN INITIALIZATION
let firebaseInitialized = false;

function initializeFirebase() {
  if (firebaseInitialized) return;
  
  try {
    if (!admin.apps.length) {
      // Initialize Firebase Admin with service account
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY 
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
        : require('../../config/firebase-service-account.json'); // Fallback to file

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID
      });

      console.log('🔥 Firebase Admin initialized successfully');
      firebaseInitialized = true;
    }
  } catch (error) {
    console.error('❌ Firebase Admin initialization failed:', error);
    console.log('⚠️ Mobile push notifications will not work without Firebase');
  }
}

// Initialize Firebase on module load
initializeFirebase();

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
      await handleUserPresenceChange(user);
    }
    
    else if (type === 'channel.created') {
      console.log('📝 New channel created:', channel?.id);
      await handleChannelCreated(channel, user);
    }
    
    else if (type === 'call.created') {
      console.log('📞 Call created:', channel?.id);
      await handleCallCreated(req.body);
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
 * Handle user presence changes (when doctors come online)
 */
async function handleUserPresenceChange(user) {
  try {
    if (!user?.online || !user?.id) return;
    
    console.log(`👥 User ${user.id} came online`);
    
    // Find patients who have this doctor and might want to be notified
    const dbUser = await User.findById(user.id);
    if (dbUser?.role === 'doctor') {
      // Notify patients that their doctor is now online
      const patients = dbUser.patients || [];
      
      for (const patientId of patients) {
        await createSystemNotificationForUser({
          recipientId: patientId,
          title: 'Doctor Available',
          message: `Dr. ${dbUser.firstName} ${dbUser.lastName} is now online`,
          systemEvent: 'doctor_online',
          data: { doctorId: user.id, doctorName: `${dbUser.firstName} ${dbUser.lastName}` }
        });
      }
    }
  } catch (error) {
    console.error('❌ Error handling user presence change:', error);
  }
}

/**
 * Handle new channel creation (new conversation started)
 */
async function handleChannelCreated(channel, creator) {
  try {
    console.log(`📝 New channel created: ${channel?.id}`);
    
    const channelMembers = channel?.members || [];
    const creatorId = creator?.id;
    
    // Notify all members except creator about new conversation
    for (const member of channelMembers) {
      const memberId = member.user_id || member.user?.id;
      
      if (memberId && memberId !== creatorId) {
        await createSystemNotificationForUser({
          recipientId: memberId,
          title: 'New Conversation',
          message: `${creator?.name || 'Someone'} started a new conversation with you`,
          systemEvent: 'conversation_started',
          data: { channelId: channel.id, creatorId }
        });
      }
    }
  } catch (error) {
    console.error('❌ Error handling channel creation:', error);
  }
}

/**
 * Handle call creation (incoming video/voice calls)
 */
async function handleCallCreated(webhookData) {
  try {
    const { call, user, channel } = webhookData;
    
    console.log(`📞 Call created in channel: ${channel?.id}`);
    
    const callerId = user?.id;
    const callerName = user?.name || `${user?.first_name || ''} ${user?.last_name || ''}`.trim();
    const channelMembers = channel?.members || [];
    
    // Notify all channel members except the caller about incoming call
    for (const member of channelMembers) {
      const memberId = member.user_id || member.user?.id;
      
      if (memberId && memberId !== callerId) {
        // Create high-priority call notification
        await createCallNotificationForUser({
          recipientId: memberId,
          callerId: callerId,
          callerName: callerName,
          channelId: channel.id,
          callId: call?.id || channel.id,
          callType: call?.type || 'video'
        });
      }
    }
  } catch (error) {
    console.error('❌ Error handling call creation:', error);
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
      body: {
        recipientId: recipientId,
        title: notificationData.title,
        message: notificationData.message,
        type: notificationData.type,
        data: notificationData.data
      }
    };
    
    const fakeRes = {
      status: (code) => ({
        json: (data) => {
          if (code === 201 || code === 200) {
            console.log(`✅ Notification created successfully for user ${recipientId}`);
            
            // Send mobile push notification
            sendMobilePushNotification({
              recipientId,
              title: notificationData.title,
              body: notificationData.message,
              data: {
                type: 'message',
                conversationId,
                senderId,
                senderName
              }
            });
            
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
 * Create a system notification for a specific user
 */
async function createSystemNotificationForUser({ recipientId, title, message, systemEvent, data = {} }) {
  try {
    console.log(`🌐 Creating system notification for user: ${recipientId}`);
    
    const fakeReq = {
      user: { id: 'system' },
      body: {
        recipientId,
        systemEvent,
        eventData: data
      }
    };
    
    const fakeRes = {
      status: (code) => ({
        json: (responseData) => {
          if (code === 201 || code === 200) {
            console.log(`✅ System notification created for user ${recipientId}`);
            
            // Send mobile push notification
            sendMobilePushNotification({
              recipientId,
              title,
              body: message,
              data: {
                type: 'system',
                systemEvent,
                ...data
              }
            });
          }
        }
      })
    };
    
    await notificationController.createSystemNotification(fakeReq, fakeRes);
    
  } catch (error) {
    console.error('❌ Error creating system notification:', error);
  }
}

/**
 * Create a call notification for a specific user
 */
async function createCallNotificationForUser({ recipientId, callerId, callerName, channelId, callId, callType }) {
  try {
    console.log(`📞 Creating call notification for user: ${recipientId}`);
    
    const fakeReq = {
      user: { id: callerId },
      body: {
        recipientId,
        channelName: callId,
        callType
      }
    };
    
    const fakeRes = {
      status: (code) => ({
        json: (data) => {
          if (code === 201 || code === 200) {
            console.log(`✅ Call notification created for user ${recipientId}`);
            
            // Send HIGH PRIORITY mobile push notification for calls
            sendMobilePushNotification({
              recipientId,
              title: 'Incoming Call',
              body: `${callerName} is calling you`,
              data: {
                type: 'call',
                callId,
                callerId,
                callerName,
                channelId,
                callType
              },
              priority: 'high',
              sound: 'default'
            });
          }
        }
      })
    };
    
    await notificationController.createCallNotification(fakeReq, fakeRes);
    
  } catch (error) {
    console.error('❌ Error creating call notification:', error);
  }
}

/**
 * 📱 SEND MOBILE PUSH NOTIFICATION VIA FCM
 */
async function sendMobilePushNotification({ recipientId, title, body, data = {}, priority = 'normal', sound = null }) {
  try {
    if (!firebaseInitialized) {
      console.log('⚠️ Firebase not initialized, skipping mobile push notification');
      return;
    }
    
    console.log(`📱 Sending mobile push notification to user: ${recipientId}`);
    
    // Get user's FCM token from database
    const user = await User.findById(recipientId);
    if (!user || !user.fcmToken) {
      console.log(`⚠️ No FCM token found for user ${recipientId}, skipping mobile push`);
      return;
    }
    
    const fcmToken = user.fcmToken;
    
    // Prepare the FCM message
    const message = {
      token: fcmToken,
      notification: {
        title: title,
        body: body,
      },
      data: {
        ...data,
        timestamp: new Date().toISOString(),
        recipientId: recipientId
      },
      android: {
        notification: {
          channelId: 'neurolex_notifications',
          priority: priority === 'high' ? 'max' : 'default',
          sound: sound || 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK'
        },
        priority: priority === 'high' ? 'high' : 'normal'
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: title,
              body: body
            },
            sound: sound || 'default',
            badge: 1,
            'content-available': 1
          }
        },
        headers: {
          'apns-priority': priority === 'high' ? '10' : '5'
        }
      }
    };
    
    // Send the push notification
    const response = await admin.messaging().send(message);
    console.log(`✅ Mobile push notification sent successfully: ${response}`);
    
  } catch (error) {
    if (error.code === 'messaging/registration-token-not-registered') {
      console.log(`⚠️ FCM token expired for user ${recipientId}, removing from database`);
      
      // Remove the expired token from user's record
      try {
        await User.findByIdAndUpdate(recipientId, { 
          $unset: { fcmToken: 1 } 
        });
      } catch (updateError) {
        console.error('❌ Error removing expired FCM token:', updateError);
      }
    } else {
      console.error('❌ Error sending mobile push notification:', error);
    }
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
  
  // Test mobile push notification
  const { userId, title, message } = req.body;
  if (userId) {
    await sendMobilePushNotification({
      recipientId: userId,
      title: title || 'Test Notification',
      body: message || 'This is a test notification from Neurolex',
      data: { type: 'test' }
    });
  }
  
  res.status(200).json({
    success: true,
    message: 'Test webhook received successfully',
    timestamp: new Date().toISOString(),
    firebaseStatus: firebaseInitialized ? 'INITIALIZED' : 'NOT INITIALIZED'
  });
};

module.exports = exports;