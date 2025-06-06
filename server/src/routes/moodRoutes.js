// server/src/routes/moodRoutes.js
const express = require('express');
const router = express.Router();

// Import middleware
const { protect } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenantMiddleware');

// Import controllers
const {
  createMoodCheckIn,
  getMoodHistory,
  getMoodAnalytics,
  getCurrentMood,
  canCheckIn,
  getUserMoodHistory,
  // Legacy methods
  saveMood,
  getUserMoods
} = require('../controllers/moodController');

// Apply authentication and tenant middleware to all routes
router.use(protect);
router.use(tenantMiddleware);

// === NEW MOOD CHECK-IN ROUTES ===

/**
 * @desc    Create a new mood check-in
 * @route   POST /api/mood/checkin
 * @access  Private
 */
router.post('/checkin', createMoodCheckIn);

/**
 * @desc    Get mood history for authenticated user
 * @route   GET /api/mood/history
 * @access  Private
 * @query   ?limit=30&page=1
 */
router.get('/history', getMoodHistory);

/**
 * @desc    Get mood analytics for authenticated user
 * @route   GET /api/mood/analytics
 * @access  Private
 * @query   ?days=30
 */
router.get('/analytics', getMoodAnalytics);

/**
 * @desc    Get current/latest mood for authenticated user
 * @route   GET /api/mood/current
 * @access  Private
 */
router.get('/current', getCurrentMood);

/**
 * @desc    Check if user can submit a new mood check-in
 * @route   GET /api/mood/can-checkin
 * @access  Private
 */
router.get('/can-checkin', canCheckIn);

// === ADMIN/DOCTOR ROUTES ===

/**
 * @desc    Get mood history for a specific user (Admin/Doctor access)
 * @route   GET /api/mood/user/:userId
 * @access  Private (Admin/Doctor only)
 * @query   ?limit=30&page=1
 */
router.get('/user/:userId', getUserMoodHistory);

/**
 * @desc    Get mood analytics for a specific user (Admin/Doctor access)
 * @route   GET /api/mood/user/:userId/analytics
 * @access  Private (Admin/Doctor only)
 */
router.get('/user/:userId/analytics', async (req, res) => {
  try {
    const { userId } = req.params;
    const { days = 30 } = req.query;
    
    // Check permissions
    if (req.user.id !== userId && !['admin', 'doctor'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this user\'s analytics'
      });
    }
    
    const Mood = require('../models/Mood');
    
    const analytics = await Mood.getMoodAnalytics(
      req.user.tenantId,
      userId,
      parseInt(days)
    );
    
    const trends = await Mood.getMoodTrends(
      req.user.tenantId,
      userId,
      parseInt(days)
    );
    
    const recentMoods = await Mood.find({
      tenantId: req.user.tenantId,
      userId: userId,
      timestamp: { 
        $gte: new Date(Date.now() - (parseInt(days) * 24 * 60 * 60 * 1000)) 
      }
    });
    
    const moodScore = Mood.calculateMoodScore(recentMoods);
    
    res.status(200).json({
      success: true,
      data: {
        ...analytics,
        moodScore,
        trends,
        period: `${days} days`,
        userId
      }
    });
  } catch (error) {
    console.error('Error getting user mood analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Server error occurred while retrieving mood analytics'
    });
  }
});

// === LEGACY ROUTES (for backward compatibility) ===

/**
 * @desc    Legacy create mood entry
 * @route   POST /api/mood
 * @access  Private
 */
router.post('/', saveMood);

/**
 * @desc    Legacy get mood entries
 * @route   GET /api/mood
 * @access  Private
 */
router.get('/', getUserMoods);

/**
 * @desc    Legacy get current mood for specific user
 * @route   GET /api/mood/users/:userId/current
 * @access  Private
 */
router.get('/users/:userId/current', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check permissions
    if (req.user.id !== userId && !['admin', 'doctor'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this user\'s mood data'
      });
    }
    
    const Mood = require('../models/Mood');
    
    const latestMood = await Mood.findOne({
      tenantId: req.user.tenantId,
      userId: userId
    })
    .sort({ timestamp: -1 })
    .select('moodRating moodKey moodLabel moodSvgUrl reflection timestamp sentiment');
    
    if (!latestMood) {
      return res.status(200).json({
        success: true,
        message: 'No mood entries found',
        mood: 'neutral',
        timestamp: new Date().toISOString(),
        notes: ''
      });
    }
    
    // Legacy response format
    res.status(200).json({
      success: true,
      mood: latestMood.moodKey,
      moodRating: latestMood.moodRating,
      moodLabel: latestMood.moodLabel,
      moodSvgUrl: latestMood.moodSvgUrl,
      timestamp: latestMood.timestamp,
      notes: latestMood.reflection,
      ...latestMood.toObject()
    });
  } catch (error) {
    console.error(`Error getting current mood: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get current mood',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @desc    Legacy create mood entry for specific user
 * @route   POST /api/mood/users/:userId/create
 * @access  Private
 */
router.post('/users/:userId/create', async (req, res) => {
  try {
    const { userId } = req.params;
    const { mood, notes, reflection, timestamp } = req.body;
    
    // Check permissions
    if (req.user.id !== userId && !['admin', 'doctor'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to create mood entries for this user'
      });
    }
    
    if (!mood) {
      return res.status(400).json({
        success: false,
        message: 'Mood is required'
      });
    }
    
    const Mood = require('../models/Mood');
    const { CloudinaryHelper } = require('../utils/cloudinaryHelper');
    
    // Convert legacy mood format to new format
    const moodMapping = {
      'very_happy': { key: 'great', rating: 5, label: 'I\'m great' },
      'happy': { key: 'good', rating: 4, label: 'I\'m good' },
      'neutral': { key: 'okay', rating: 3, label: 'I\'m okay' },
      'sad': { key: 'struggling', rating: 2, label: 'I\'m struggling' },
      'very_sad': { key: 'upset', rating: 1, label: 'I\'m upset' },
      // Handle new format as well
      'great': { key: 'great', rating: 5, label: 'I\'m great' },
      'good': { key: 'good', rating: 4, label: 'I\'m good' },
      'okay': { key: 'okay', rating: 3, label: 'I\'m okay' },
      'struggling': { key: 'struggling', rating: 2, label: 'I\'m struggling' },
      'upset': { key: 'upset', rating: 1, label: 'I\'m upset' }
    };
    
    const moodData = moodMapping[mood] || moodMapping['okay'];
    
    const moodEntry = new Mood({
      tenantId: req.user.tenantId,
      userId: userId,
      moodRating: moodData.rating,
      moodKey: moodData.key,
      moodLabel: moodData.label,
      moodSvgUrl: CloudinaryHelper.getMoodUrl(moodData.key),
      reflection: notes || reflection || '',
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      metadata: {
        deviceType: 'web',
        appVersion: '1.0.0',
        timezone: 'UTC'
      }
    });
    
    await moodEntry.save();
    
    res.status(201).json({
      success: true,
      message: 'Mood entry created successfully',
      data: moodEntry
    });
  } catch (error) {
    console.error(`Error creating mood entry: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to create mood entry',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;