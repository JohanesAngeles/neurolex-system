// server/src/routes/agoraRoutes.js
const express = require('express');
const router = express.Router();
const agoraController = require('../controllers/agoraController');
const auth = require('../middleware/auth'); // Remove the destructuring

// Apply auth middleware to ensure only authenticated users can get tokens
router.post('/rtc-token', auth, agoraController.generateRtcToken);
router.post('/rtm-token', auth, agoraController.generateRtmToken);

module.exports = router;