// server/src/routes/streamWebhookRoutes.js
const express = require('express');
const router = express.Router();
const streamWebhookController = require('../controllers/streamWebhookController');

/**
 * Stream Chat webhook endpoint
 * This is where Stream Chat will send events when messages are sent
 * 
 * URL: POST /api/webhooks/stream
 */
router.post('/stream', streamWebhookController.handleStreamWebhook);

/**
 * Test webhook endpoint for debugging
 * You can use this to test webhook functionality
 * 
 * URL: POST /api/webhooks/stream/test
 */
router.post('/stream/test', streamWebhookController.testWebhook);

/**
 * Health check endpoint
 * URL: GET /api/webhooks/health
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Stream webhook service is running',
    timestamp: new Date().toISOString(),
    endpoints: {
      webhook: '/api/webhooks/stream',
      test: '/api/webhooks/stream/test',
      health: '/api/webhooks/health'
    }
  });
});

module.exports = router;