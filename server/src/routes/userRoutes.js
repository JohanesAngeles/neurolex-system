// server/src/routes/userRoutes.js - YOUR COMPLETE FILE + FCM TOKEN SUPPORT
const express = require('express');
const userController = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenantMiddleware');

// 🔧 NEW: Add multer for file uploads
const multer = require('multer');

const router = express.Router();

// Apply middleware in the correct order - auth first, then tenant connection
router.use(protect);
router.use(tenantMiddleware);

// 🔧 NEW: Configure multer for profile picture uploads
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1 // Only allow 1 file
  },
  fileFilter: (req, file, cb) => {
    console.log('📁 File filter - received file:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });

    // Check file type
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      console.log('✅ File type approved:', file.mimetype);
      cb(null, true);
    } else {
      console.log('❌ File type rejected:', file.mimetype);
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'), false);
    }
  }
});

// =============================================
// 🔥 NEW: MOBILE PUSH NOTIFICATION ENDPOINTS
// =============================================

/**
 * Update FCM token for push notifications
 * PATCH /api/users/fcm-token
 */
router.patch('/fcm-token', async (req, res) => {
  try {
    console.log('🔥 Updating FCM token for user:', req.user.id);
    
    const { fcmToken, platform, deviceType, appVersion } = req.body;
    
    if (!fcmToken) {
      return res.status(400).json({
        success: false,
        message: 'FCM token is required'
      });
    }
    
    // Check if user has the FCM methods (for backward compatibility)
    if (typeof req.user.updateFCMToken !== 'function') {
      console.warn('⚠️ User model does not have FCM methods - please update User model');
      
      // Fallback: Update user directly
      const User = require('../models/User');
      await User.findByIdAndUpdate(req.user.id, {
        fcmToken: fcmToken,
        'deviceInfo.platform': platform || 'mobile',
        'deviceInfo.deviceType': deviceType || 'flutter',
        'deviceInfo.appVersion': appVersion || '1.0.0',
        'deviceInfo.lastActive': new Date()
      });
      
      return res.status(200).json({
        success: true,
        message: 'FCM token updated successfully (fallback method)',
        data: {
          userId: req.user.id,
          tokenUpdated: true,
          platform: platform || 'mobile'
        }
      });
    }
    
    // Update user's FCM token using new methods
    const success = await req.user.updateFCMToken(fcmToken, {
      platform: platform || 'mobile',
      deviceType: deviceType || 'flutter',
      appVersion: appVersion || '1.0.0'
    });
    
    if (success) {
      console.log('✅ FCM token updated successfully');
      
      res.status(200).json({
        success: true,
        message: 'FCM token updated successfully',
        data: {
          userId: req.user.id,
          tokenUpdated: true,
          platform: platform || 'mobile'
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to update FCM token'
      });
    }
    
  } catch (error) {
    console.error('❌ Error updating FCM token:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update FCM token',
      error: error.message
    });
  }
});

/**
 * Remove FCM token (logout/disable notifications)
 * DELETE /api/users/fcm-token
 */
router.delete('/fcm-token', async (req, res) => {
  try {
    console.log('🗑️ Removing FCM token for user:', req.user.id);
    
    // Check if user has the FCM methods (for backward compatibility)
    if (typeof req.user.removeFCMToken !== 'function') {
      // Fallback: Update user directly
      const User = require('../models/User');
      await User.findByIdAndUpdate(req.user.id, {
        $unset: { fcmToken: 1 }
      });
      
      return res.status(200).json({
        success: true,
        message: 'FCM token removed successfully (fallback method)'
      });
    }
    
    const success = await req.user.removeFCMToken();
    
    if (success) {
      res.status(200).json({
        success: true,
        message: 'FCM token removed successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to remove FCM token'
      });
    }
    
  } catch (error) {
    console.error('❌ Error removing FCM token:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove FCM token',
      error: error.message
    });
  }
});

/**
 * Update notification settings
 * PATCH /api/users/notification-settings
 */
router.patch('/notification-settings', async (req, res) => {
  try {
    console.log('⚙️ Updating notification settings for user:', req.user.id);
    
    const settings = req.body;
    
    // Check if user has the notification methods (for backward compatibility)
    if (typeof req.user.updateNotificationSettings !== 'function') {
      // Fallback: Update user directly
      const User = require('../models/User');
      await User.findByIdAndUpdate(req.user.id, {
        notificationSettings: {
          ...req.user.notificationSettings,
          ...settings
        }
      });
      
      return res.status(200).json({
        success: true,
        message: 'Notification settings updated successfully (fallback method)',
        data: settings
      });
    }
    
    const success = await req.user.updateNotificationSettings(settings);
    
    if (success) {
      res.status(200).json({
        success: true,
        message: 'Notification settings updated successfully',
        data: req.user.notificationSettings
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to update notification settings'
      });
    }
    
  } catch (error) {
    console.error('❌ Error updating notification settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notification settings',
      error: error.message
    });
  }
});

/**
 * Get notification settings
 * GET /api/users/notification-settings
 */
router.get('/notification-settings', async (req, res) => {
  try {
    // Check if user has notification methods (for backward compatibility)
    const canReceivePush = typeof req.user.canReceivePushNotifications === 'function' 
      ? req.user.canReceivePushNotifications()
      : !!(req.user.fcmToken && req.user.isActive);
      
    const isInQuietHours = typeof req.user.isInQuietHours === 'function'
      ? req.user.isInQuietHours()
      : false;
    
    res.status(200).json({
      success: true,
      data: {
        settings: req.user.notificationSettings || {
          pushNotifications: true,
          emailNotifications: true,
          smsNotifications: false,
          messageNotifications: true,
          appointmentReminders: true,
          systemNotifications: true,
          quietHours: {
            enabled: false,
            startTime: '22:00',
            endTime: '08:00'
          }
        },
        canReceivePush: canReceivePush,
        isInQuietHours: isInQuietHours,
        deviceInfo: req.user.deviceInfo || {
          platform: null,
          deviceType: null,
          appVersion: null,
          lastActive: new Date()
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting notification settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get notification settings',
      error: error.message
    });
  }
});

/**
 * Test push notification endpoint
 * POST /api/users/test-notification
 */
router.post('/test-notification', async (req, res) => {
  try {
    console.log('🧪 Testing push notification for user:', req.user.id);
    
    const { title, message, type } = req.body;
    
    // Check if user can receive notifications
    const canReceivePush = typeof req.user.canReceivePushNotifications === 'function'
      ? req.user.canReceivePushNotifications()
      : !!(req.user.fcmToken && req.user.isActive);
    
    if (!canReceivePush) {
      return res.status(400).json({
        success: false,
        message: 'User cannot receive push notifications',
        reasons: {
          noFcmToken: !req.user.fcmToken,
          notActive: !req.user.isActive,
          pushDisabled: req.user.notificationSettings?.pushNotifications === false
        }
      });
    }
    
    // Import the FCM service
    const admin = require('firebase-admin');
    
    if (!admin.apps.length) {
      return res.status(500).json({
        success: false,
        message: 'Firebase not initialized'
      });
    }
    
    const notification = {
      token: req.user.fcmToken,
      notification: {
        title: title || 'Test Notification',
        body: message || 'This is a test notification from Neurolex'
      },
      data: {
        type: type || 'test',
        timestamp: new Date().toISOString(),
        userId: req.user.id
      }
    };
    
    const response = await admin.messaging().send(notification);
    
    res.status(200).json({
      success: true,
      message: 'Test notification sent successfully',
      data: {
        messageId: response,
        userId: req.user.id,
        title: notification.notification.title,
        body: notification.notification.body
      }
    });
    
  } catch (error) {
    console.error('❌ Error sending test notification:', error);
    
    if (error.code === 'messaging/registration-token-not-registered') {
      // Remove the expired token
      if (typeof req.user.removeFCMToken === 'function') {
        await req.user.removeFCMToken();
      } else {
        const User = require('../models/User');
        await User.findByIdAndUpdate(req.user.id, { $unset: { fcmToken: 1 } });
      }
      
      res.status(400).json({
        success: false,
        message: 'FCM token expired and has been removed. Please refresh the app.',
        code: 'TOKEN_EXPIRED'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send test notification',
        error: error.message
      });
    }
  }
});

// =============================================
// 🔥 MOBILE-SPECIFIC ENDPOINTS
// =============================================

/**
 * Get mobile app data (optimized for mobile)
 * GET /api/users/mobile/profile
 */
router.get('/mobile/profile', async (req, res) => {
  try {
    const user = req.user;
    
    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName || `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.role,
        profilePicture: user.profilePicture,
        phone: user.personalContactNumber || user.phone,
        onboardingCompleted: user.onboardingCompleted,
        isVerified: user.isVerified,
        notificationSettings: user.notificationSettings,
        canReceiveNotifications: typeof user.canReceivePushNotifications === 'function' 
          ? user.canReceivePushNotifications()
          : !!(user.fcmToken && user.isActive),
        lastLogin: user.lastLogin
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting mobile profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get mobile profile',
      error: error.message
    });
  }
});

/**
 * Update device activity (for tracking when user was last active)
 * PATCH /api/users/mobile/activity
 */
router.patch('/mobile/activity', async (req, res) => {
  try {
    const { appVersion, platform } = req.body;
    
    // Update device info with current activity
    if (typeof req.user.updateFCMToken === 'function') {
      const success = await req.user.updateFCMToken(req.user.fcmToken, {
        ...req.user.deviceInfo,
        appVersion: appVersion || req.user.deviceInfo?.appVersion,
        platform: platform || req.user.deviceInfo?.platform,
        lastActive: new Date()
      });
      
      if (success) {
        res.status(200).json({
          success: true,
          message: 'Activity updated successfully',
          data: {
            lastActive: new Date(),
            deviceInfo: req.user.deviceInfo
          }
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update activity'
        });
      }
    } else {
      // Fallback: Update directly
      const User = require('../models/User');
      await User.findByIdAndUpdate(req.user.id, {
        'deviceInfo.lastActive': new Date(),
        'deviceInfo.appVersion': appVersion,
        'deviceInfo.platform': platform
      });
      
      res.status(200).json({
        success: true,
        message: 'Activity updated successfully (fallback)',
        data: {
          lastActive: new Date()
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error updating mobile activity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update activity',
      error: error.message
    });
  }
});

/**
 * Get user activity/device info
 * GET /api/users/activity
 */
router.get('/activity', async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        lastLogin: req.user.lastLogin,
        deviceInfo: req.user.deviceInfo || {
          platform: null,
          deviceType: null,
          appVersion: null,
          lastActive: new Date()
        },
        isActive: req.user.isActive,
        fcmTokenExists: !!req.user.fcmToken,
        canReceiveNotifications: typeof req.user.canReceivePushNotifications === 'function'
          ? req.user.canReceivePushNotifications()
          : !!(req.user.fcmToken && req.user.isActive)
      }
    });
  } catch (error) {
    console.error('❌ Error getting user activity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user activity',
      error: error.message
    });
  }
});

// =============================================
// YOUR EXISTING ROUTES (UNCHANGED)
// =============================================

// 🔧 CRITICAL: Add debug middleware for profile routes
router.use('/profile', (req, res, next) => {
  console.log('\n=== PROFILE ROUTE DEBUG ===');
  console.log('Method:', req.method);
  console.log('Path:', req.path);
  console.log('Full URL:', req.originalUrl);
  console.log('Headers:', {
    'content-type': req.headers['content-type'],
    'authorization': req.headers.authorization ? 'present' : 'missing',
    'x-tenant-id': req.headers['x-tenant-id']
  });
  console.log('Body keys:', Object.keys(req.body || {}));
  console.log('User ID:', req.user?.id || req.user?._id);
  console.log('Tenant ID:', req.tenantId);
  console.log('Tenant Connection:', !!req.tenantConnection);
  console.log('===============================\n');
  next();
});

// 🔧 CRITICAL: Add debug middleware for onboarding route
router.use('/onboarding', (req, res, next) => {
  console.log('\n=== ONBOARDING ROUTE DEBUG ===');
  console.log('Method:', req.method);
  console.log('Headers:', req.headers);
  console.log('Body keys:', Object.keys(req.body || {}));
  console.log('User ID:', req.user?.id || req.user?._id);
  console.log('Tenant ID:', req.tenantId);
  console.log('Tenant Connection:', !!req.tenantConnection);
  console.log('===============================\n');
  next();
});

// User profile routes
router.get('/me', userController.getCurrentUser);
router.get('/profile', userController.getProfile);

// 🔧 CRITICAL: Profile update routes - THESE ARE THE KEY FIXES
router.put('/profile/basic', userController.updateProfileBasic);
router.patch('/profile/basic', userController.updateProfileBasic); // Support both PUT and PATCH
router.put('/profile/password', userController.updatePassword);
router.patch('/profile/password', userController.updatePassword); // Support both PUT and PATCH

// 🔧 NEW: Profile picture upload routes
router.post('/profile/picture', upload.single('profilePicture'), (req, res, next) => {
  console.log('\n=== PROFILE PICTURE UPLOAD DEBUG ===');
  console.log('Method:', req.method);
  console.log('Path:', req.path);
  console.log('File received:', !!req.file);
  console.log('File details:', req.file ? {
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    buffer: !!req.file.buffer
  } : 'No file');
  console.log('User ID:', req.user?.id || req.user?._id);
  console.log('Content-Type:', req.headers['content-type']);
  console.log('=====================================\n');
  next();
}, userController.uploadProfilePicture);

router.delete('/profile/picture', userController.deleteProfilePicture);

// 🔧 CRITICAL: Onboarding routes (both POST and PUT for compatibility)
router.post('/onboarding', userController.updateOnboarding);
router.put('/onboarding', userController.updateOnboarding);
router.patch('/onboarding', userController.updateOnboarding); // Add PATCH support
router.post('/onboarding/skip', userController.skipOnboarding);

// Other profile management
router.get('/doctors', userController.getDoctors);

// Mobile app routes
router.get('/users/:userId/appointments', userController.getUserAppointments);
router.get('/users/:userId/journal-entries', userController.getUserJournalEntries);
router.get('/users/:userId/moods/current', userController.getCurrentMood);
router.post('/users/:userId/moods', userController.createMood);

// Admin routes
router.get('/', userController.getUsers);
router.post('/', userController.createUser);
router.get('/:id', userController.getUserById);
router.delete('/:id', userController.deleteUser);

// 🔧 CRITICAL: Add a test route to verify the routes are working
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'User routes are working with FCM support!',
    userId: req.user?.id || req.user?._id,
    tenantId: req.tenantId,
    routes: [
      'GET /api/users/me',
      'GET /api/users/profile', 
      'PUT /api/users/profile/basic',
      'PUT /api/users/profile/password',
      'POST /api/users/profile/picture',
      'DELETE /api/users/profile/picture',
      'POST /api/users/onboarding',
      '🔥 PATCH /api/users/fcm-token',
      '🔥 DELETE /api/users/fcm-token',
      '🔥 PATCH /api/users/notification-settings',
      '🔥 GET /api/users/notification-settings',
      '🔥 POST /api/users/test-notification',
      '🔥 GET /api/users/mobile/profile',
      '🔥 PATCH /api/users/mobile/activity'
    ]
  });
});

// =============================================
// ERROR HANDLING MIDDLEWARE
// =============================================

// 🔧 NEW: Error handling middleware for multer errors
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    console.error('Multer error:', error);
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 5MB.'
      });
    }
    
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Only one file is allowed.'
      });
    }
    
    return res.status(400).json({
      success: false,
      message: 'File upload error: ' + error.message
    });
  }
  
  if (error.message && error.message.includes('Invalid file type')) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  
  next(error);
});

module.exports = router;