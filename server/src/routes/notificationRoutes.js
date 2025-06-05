// server/src/routes/notificationRoutes.js - MISSING FILE THAT FIXES 404!
const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');
const notificationController = require('../controllers/notificationController');

// 🔧 CRITICAL: Apply authentication middleware to all routes
router.use(protect);

// 🔔 Debug middleware to track notification requests
router.use((req, res, next) => {
  console.log('\n🔔 NOTIFICATION ROUTE HIT:');
  console.log('Method:', req.method);
  console.log('Path:', req.path);
  console.log('User ID:', req.user?.id || req.user?._id);
  console.log('Body:', req.body);
  console.log('==========================\n');
  next();
});

// 📱 CORE NOTIFICATION ROUTES
// Get all notifications for authenticated user
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

// 🚨 CRITICAL: Message notifications (THIS FIXES THE 404!)
router.post('/message', notificationController.createMessageNotification);

// System notifications (automated system events)
router.post('/system', notificationController.createSystemNotification);

// Call notifications (video/voice calls)
router.post('/call', notificationController.createCallNotification);

// 🧪 TEST ROUTE
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Notification routes are working! 404 FIXED!',
    userId: req.user?.id || req.user?._id,
    availableRoutes: [
      'GET /api/notifications - Get all notifications',
      'GET /api/notifications/count - Get notification counts', 
      'PATCH /api/notifications/:id/read - Mark notification as read',
      'PATCH /api/notifications/read-all - Mark all as read',
      'POST /api/notifications - Create generic notification',
      'POST /api/notifications/assignment - Create assignment notification',
      'POST /api/notifications/message - Create message notification ← FIXES 404!',
      'POST /api/notifications/system - Create system notification',
      'POST /api/notifications/call - Create call notification'
    ],
    timestamp: new Date().toISOString()
  });
});

module.exports = router;