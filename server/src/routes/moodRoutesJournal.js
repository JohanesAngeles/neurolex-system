// moodRoutes.js - Express routes for mood/journal functionality
const express = require('express');
const router = express.Router();
const moodController = require('../controllers/moodController');
const auth = require('../middleware/auth');

/**
 * @route   GET /api/moods/sentiment/:userId
 * @desc    Get sentiment analysis data for a user
 * @access  Private
 */
router.get('/sentiment/:userId', auth, moodController.getSentimentData);

/**
 * @route   POST /api/moods/:userId
 * @desc    Record a new mood/journal entry
 * @access  Private
 */
router.post('/:userId', auth, moodController.recordMood);

/**
 * @route   GET /api/moods/:userId
 * @desc    Get all mood entries for a user
 * @access  Private
 */
router.get('/:userId', auth, moodController.getUserMoods);

/**
 * @route   GET /api/moods/insights/:userId
 * @desc    Get AI-powered insights based on user's mood patterns
 * @access  Private
 */
router.get('/insights/:userId', auth, moodController.getInsights);

module.exports = router;