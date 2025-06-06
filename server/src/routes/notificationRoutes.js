// server/src/routes/notificationRoutes.js - DEBUG VERSION
const express = require('express');
const router = express.Router();
// Import auth middleware as default export
const protect = require('../middleware/auth');
const notificationController = require('../controllers/notificationController');

// 🔍 DEBUG: Check controller import
console.log('🔍 Controller functions:', Object.keys(notificationController));

// Apply authentication middleware to all routes
router.use(protect);

// 🔧 Add debug middleware for notification routes
router.use((req, res, next) => {
  console.log('\n=== NOTIFICATION ROUTE DEBUG ===');
  console.log('Method:', req.method);
  console.log('Path:', req.path);
  console.log('Full URL:', req.originalUrl);
  console.log('User ID:', req.user?.id || req.user?._id);
  console.log('Body keys:', Object.keys(req.body || {}));
  console.log('=================================\n');
  next();
});

// 📱 CORE NOTIFICATION ROUTES
// Get all notifications for authenticated user (with pagination)
router.get('/', notificationController.getNotifications);

// Get notification count (unread + total)
router.get('/count', notificationController.getNotificationCount);

// Mark specific notification as read
router.patch('/:id/read', notificationController.markAsRead);

// Mark all notifications as read
router.patch('/read-all', notificationController.markAllAsRead);

// 🔔 NOTIFICATION CREATION ROUTES
// Generic notification creation
router.post('/', notificationController.createNotification);

// Assignment notifications (doctor assigns tasks to patients)
router.post('/assignment', notificationController.createAssignmentNotification);

// 🔥 DEBUG: Message notifications (chat messages) with extra logging
router.post('/message', (req, res, next) => {
  console.log('🚀 ROUTE /message HIT - About to call controller');
  console.log('🚀 Controller function exists:', typeof notificationController.createMessageNotification);
  next();
}, notificationController.createMessageNotification);

// 🔥 NEW: Message notifications with FCM (fixed endpoint for frontend)
/**
 * @route   POST /api/notifications/create-message
 * @desc    Create message notification with FCM
 * @access  Private - Requires authentication
 */
router.post('/create-message', (req, res, next) => {
  console.log('🚀 ROUTE /create-message HIT - About to call controller');
  console.log('🚀 Controller function exists:', typeof notificationController.createMessageNotification);
  next();
}, notificationController.createMessageNotification);

// System notifications (automated system events)
router.post('/system', notificationController.createSystemNotification);

// Call notifications (video/voice calls)
router.post('/call', notificationController.createCallNotification);

// 🧪 TEST ROUTE - Remove in production
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Enhanced notification routes are working!',
    userId: req.user?.id || req.user?._id,
    controllerFunctions: Object.keys(notificationController), // 🔥 NEW: Show available functions
    availableRoutes: [
      'GET /api/notifications - Get all notifications',
      'GET /api/notifications/count - Get notification counts',
      'PATCH /api/notifications/:id/read - Mark notification as read',
      'PATCH /api/notifications/read-all - Mark all as read',
      'POST /api/notifications - Create generic notification',
      'POST /api/notifications/assignment - Create assignment notification',
      'POST /api/notifications/message - Create message notification',
      'POST /api/notifications/create-message - Create message notification (FCM)', // 🔥 NEW
      'POST /api/notifications/system - Create system notification',
      'POST /api/notifications/call - Create call notification'
    ],
    realTimeEvents: [
      'notification - New notification received',
      'notificationCountUpdate - Unread count changed',
      'newAssignment - New assignment from doctor',
      'newMessage - New chat message',
      'systemNotification - System event occurred',
      'incomingCall - Incoming video/voice call'
    ]
  });
});

module.exports = router;