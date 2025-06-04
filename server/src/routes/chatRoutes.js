// server/src/routes/chatRoutes.js - STREAM CHAT ROUTES

const express = require('express');
const router = express.Router();

// Import middleware
const { protect } = require('../middleware/auth');

// Import chat controller
const chatController = require('../controllers/chatController');

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

module.exports = router;