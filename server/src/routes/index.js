// server/src/routes/index.js
const express = require('express');
const router = express.Router();

// Import all route modules
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const doctorRoutes = require('./doctorRoutes');
const journalRoutes = require('./journalRoutes');
const moodRoutes = require('./moodRoutes');
const notificationRoutes = require('./notificationRoutes');
const conversationRoutes = require('./conversationRoutes');

// Mount the routes - IMPORTANT: Don't add '/api' prefix here
// as it's already added in the main server file

// Auth routes
router.use('/auth', authRoutes);

// User routes
router.use('/users', userRoutes);

// Doctor routes
router.use('/doctor', doctorRoutes);

// Journal routes
router.use('/journals', journalRoutes);

// Mood tracking routes
router.use('/mood', moodRoutes);

// Notification routes
router.use('/notifications', notificationRoutes);

// Conversation routes
router.use('/conversations', conversationRoutes);

module.exports = router;