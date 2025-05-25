// server/src/routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
// Import auth middleware as default export
const protect = require('../middleware/auth');
const notificationController = require('../controllers/notificationController');

// Now apply the middleware directly without destructuring
router.get('/', protect, notificationController.getNotifications);
router.post('/', protect, notificationController.createNotification);
router.post('/call', protect, notificationController.createCallNotification);
router.patch('/:id/read', protect, notificationController.markAsRead);
router.patch('/read-all', protect, notificationController.markAllAsRead);

module.exports = router;