// server/src/routes/conversationRoutes.js
const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversationController');
const auth = require('../middleware/auth'); // Change this line - remove destructuring

// Apply auth middleware to all routes (use it directly, don't use .use())
// Get all conversations for the current user
router.get('/', auth, conversationController.getConversations);

// Get all users who can be messaged
router.get('/users', auth, conversationController.getUsers);

// Create a new conversation or get an existing one
router.post('/', auth, conversationController.createOrGetConversation);

// Get messages for a conversation
router.get('/:conversationId/messages', auth, conversationController.getMessages);

// Send a message in a conversation
router.post('/:conversationId/messages', auth, conversationController.sendMessage);

// Mark a conversation as read
router.put('/:conversationId/read', auth, conversationController.markAsRead);

router.get('/:conversationId/debug', auth, conversationController.debugConversation);

module.exports = router;



