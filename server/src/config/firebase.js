// server/config/firebase.js - FIREBASE ADMIN CONFIGURATION

const admin = require('firebase-admin');

let firebaseApp = null;

/**
 * Initialize Firebase Admin SDK
 */
function initializeFirebase() {
  try {
    // Check if already initialized
    if (firebaseApp) {
      console.log('🔥 Firebase Admin already initialized');
      return firebaseApp;
    }

    // Method 1: Use environment variable (recommended for production)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID
      });
      
      console.log('✅ Firebase Admin initialized from environment variable');
      return firebaseApp;
    }

    // Method 2: Use service account file (for development)
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID
      });
      
      console.log('✅ Firebase Admin initialized from credentials file');
      return firebaseApp;
    }

    // Method 3: Fallback to manual configuration
    const firebaseConfig = {
      type: process.env.FIREBASE_TYPE || 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
      token_uri: process.env.FIREBASE_TOKEN_URI || 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL || 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
    };

    // Validate required fields
    if (!firebaseConfig.project_id || !firebaseConfig.private_key || !firebaseConfig.client_email) {
      throw new Error('Missing required Firebase configuration. Please check your environment variables.');
    }

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(firebaseConfig),
      projectId: firebaseConfig.project_id
    });

    console.log('✅ Firebase Admin initialized from environment configuration');
    return firebaseApp;

  } catch (error) {
    console.error('❌ Firebase Admin initialization failed:', error.message);
    console.error('💡 Please ensure Firebase credentials are properly configured');
    
    // Don't throw error in development, just log it
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Continuing without Firebase - push notifications will not work');
      return null;
    }
    
    throw error;
  }
}

/**
 * Get Firebase Admin instance
 */
function getFirebaseAdmin() {
  if (!firebaseApp) {
    return initializeFirebase();
  }
  return firebaseApp;
}

/**
 * Send push notification to a specific user
 */
async function sendPushNotification({
  fcmToken,
  title,
  body,
  data = {},
  priority = 'normal',
  sound = 'default'
}) {
  try {
    const firebase = getFirebaseAdmin();
    
    if (!firebase) {
      console.warn('⚠️ Firebase not available - skipping push notification');
      return { success: false, reason: 'Firebase not initialized' };
    }

    const message = {
      token: fcmToken,
      notification: {
        title: title,
        body: body
      },
      data: {
        ...data,
        timestamp: new Date().toISOString()
      },
      android: {
        notification: {
          channelId: data.type === 'call' ? 'neurolex_calls' : 
                    data.type === 'message' ? 'neurolex_messages' : 'neurolex_notifications',
          priority: priority === 'high' ? 'max' : 'default',
          sound: sound,
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
            sound: sound,
            badge: 1,
            'content-available': 1
          }
        },
        headers: {
          'apns-priority': priority === 'high' ? '10' : '5'
        }
      }
    };

    const response = await firebase.messaging().send(message);
    
    console.log(`✅ Push notification sent successfully: ${response}`);
    return { success: true, messageId: response };

  } catch (error) {
    console.error('❌ Error sending push notification:', error);
    
    if (error.code === 'messaging/registration-token-not-registered') {
      return { success: false, reason: 'token_expired', error: error.code };
    }
    
    return { success: false, reason: 'send_failed', error: error.message };
  }
}

/**
 * Send push notification to multiple users
 */
async function sendMulticastNotification({
  fcmTokens,
  title,
  body,
  data = {},
  priority = 'normal'
}) {
  try {
    const firebase = getFirebaseAdmin();
    
    if (!firebase) {
      console.warn('⚠️ Firebase not available - skipping multicast notification');
      return { success: false, reason: 'Firebase not initialized' };
    }

    const message = {
      tokens: fcmTokens,
      notification: {
        title: title,
        body: body
      },
      data: {
        ...data,
        timestamp: new Date().toISOString()
      },
      android: {
        notification: {
          channelId: data.type === 'call' ? 'neurolex_calls' : 
                    data.type === 'message' ? 'neurolex_messages' : 'neurolex_notifications',
          priority: priority === 'high' ? 'max' : 'default',
          sound: 'default'
        }
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: title,
              body: body
            },
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    const response = await firebase.messaging().sendMulticast(message);
    
    console.log(`✅ Multicast notification sent: ${response.successCount}/${fcmTokens.length} successful`);
    
    // Handle failed tokens
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push({
            token: fcmTokens[idx],
            error: resp.error?.code
          });
        }
      });
      
      console.warn('⚠️ Some notifications failed:', failedTokens);
    }
    
    return { 
      success: true, 
      successCount: response.successCount,
      failureCount: response.failureCount,
      responses: response.responses
    };

  } catch (error) {
    console.error('❌ Error sending multicast notification:', error);
    return { success: false, reason: 'send_failed', error: error.message };
  }
}

/**
 * Validate FCM token
 */
async function validateFCMToken(token) {
  try {
    const firebase = getFirebaseAdmin();
    
    if (!firebase) {
      return { valid: false, reason: 'Firebase not initialized' };
    }

    // Try to send a dry-run message to validate the token
    const message = {
      token: token,
      notification: {
        title: 'Test',
        body: 'Test'
      },
      dryRun: true
    };

    await firebase.messaging().send(message);
    return { valid: true };

  } catch (error) {
    console.error('❌ FCM token validation failed:', error);
    
    if (error.code === 'messaging/registration-token-not-registered') {
      return { valid: false, reason: 'token_expired' };
    }
    
    return { valid: false, reason: 'invalid_token', error: error.message };
  }
}

/**
 * Clean up expired tokens for a user
 */
async function cleanupExpiredTokens(userId, fcmToken) {
  try {
    const User = require('../models/User');
    
    const validation = await validateFCMToken(fcmToken);
    
    if (!validation.valid && validation.reason === 'token_expired') {
      console.log(`🧹 Cleaning up expired FCM token for user: ${userId}`);
      
      await User.findByIdAndUpdate(userId, {
        $unset: { fcmToken: 1 }
      });
      
      return true;
    }
    
    return false;

  } catch (error) {
    console.error('❌ Error cleaning up expired tokens:', error);
    return false;
  }
}

module.exports = {
  initializeFirebase,
  getFirebaseAdmin,
  sendPushNotification,
  sendMulticastNotification,
  validateFCMToken,
  cleanupExpiredTokens
};