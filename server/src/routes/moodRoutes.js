// server/src/routes/moodRoutes.js - COMPLETE UPDATED VERSION WITH ADMIN FIX
const express = require('express');
const router = express.Router();

// Import controllers
// Note: Authentication (protect) and tenant middleware are applied in server/index.js
const {
  createMoodCheckIn,
  getMoodHistory,
  getMoodAnalytics,
  getCurrentMood,
  canCheckIn,
  getUserMoodHistory,
  getDoctorPatientMoodAnalytics, // ← ADDED THIS NEW IMPORT
  // Legacy methods
  saveMood,
  getUserMoods
} = require('../controllers/moodController');

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
 * @desc    Get mood history for a specific user (Admin/Doctor access) - UPDATED WITH ADMIN FIX
 * @route   GET /api/mood/user/:userId
 * @access  Private (Admin/Doctor only)
 * @query   ?limit=30&page=1&days=7
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { days = 7, limit = 50, page = 1 } = req.query;
    
    console.log(`🔍 MOOD: Admin/Doctor accessing mood data for user ${userId}`);
    console.log(`🔍 MOOD: Request user:`, {
      id: req.user?.id,
      role: req.user?.role,
      email: req.user?.email
    });
    
    // ✅ SAFE FIX: Enhanced admin permission check
    const isAdmin = req.user && (
      req.user.role === 'admin' || 
      req.user.id === 'admin_default' || 
      req.user._id === 'admin_default'
    );
    
    const isDoctor = req.user && req.user.role === 'doctor';
    const isOwner = req.user && (req.user.id === userId || req.user._id === userId);
    
    // Check permissions - allow admin, doctor, or owner
    if (!isAdmin && !isDoctor && !isOwner) {
      console.log('❌ MOOD: Access denied - insufficient permissions');
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this user\'s mood data'
      });
    }
    
    console.log(`✅ MOOD: Access granted - Admin: ${isAdmin}, Doctor: ${isDoctor}, Owner: ${isOwner}`);
    
    // ✅ SAFE: Use tenant connection if available, fallback to require
    let Mood;
    if (req.tenantConnection) {
      Mood = req.tenantConnection.model('Mood');
      console.log('🔗 MOOD: Using tenant connection');
    } else {
      // Fallback for admin access without tenant connection
      Mood = require('../models/Mood');
      console.log('🔗 MOOD: Using direct model (fallback)');
    }
    
    // Build query filters
    const queryFilters = { userId: userId };
    
    // Add tenant filter if available
    if (req.user.tenantId) {
      queryFilters.tenantId = req.user.tenantId;
      console.log(`🏢 MOOD: Filtering by tenant: ${req.user.tenantId}`);
    }
    
    // Add date filter for recent data
    if (days && days !== 'all') {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(days));
      queryFilters.timestamp = { $gte: daysAgo };
      console.log(`📅 MOOD: Filtering by days: ${days} (since ${daysAgo.toISOString()})`);
    }
    
    console.log('🔍 MOOD: Query filters:', queryFilters);
    
    // Get mood entries with pagination
    const moodEntries = await Mood.find(queryFilters)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .select('moodRating moodKey moodLabel moodSvgUrl reflection timestamp sentiment metadata');
    
    console.log(`📊 MOOD: Found ${moodEntries.length} mood entries`);
    
    // Get total count for pagination
    const totalEntries = await Mood.countDocuments(queryFilters);
    
    // Return response in format expected by frontend
    res.status(200).json({
      success: true,
      data: moodEntries,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalEntries / parseInt(limit)),
        totalEntries,
        limit: parseInt(limit)
      },
      message: `Retrieved ${moodEntries.length} mood entries`
    });
    
  } catch (error) {
    console.error('❌ MOOD: Error getting user mood history:', error);
    res.status(500).json({
      success: false,
      message: 'Server error occurred while retrieving mood data',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @desc    Get comprehensive mood analytics for all patients under doctor's care
 * @route   GET /api/mood/doctor/analytics
 * @access  Private (Doctor only)
 * @query   ?days=7
 */
router.get('/doctor/analytics', getDoctorPatientMoodAnalytics);

/**
 * @desc    Get mood analytics for a specific user (Admin/Doctor access)
 * @route   GET /api/mood/user/:userId/analytics
 * @access  Private (Admin/Doctor only)
 */
router.get('/user/:userId/analytics', async (req, res) => {
  try {
    const { userId } = req.params;
    const { days = 30 } = req.query;
    
    // ✅ ENHANCED: Better permission check for analytics
    const isAdmin = req.user && (
      req.user.role === 'admin' || 
      req.user.id === 'admin_default' || 
      req.user._id === 'admin_default'
    );
    
    const isDoctor = req.user && req.user.role === 'doctor';
    const isOwner = req.user && (req.user.id === userId || req.user._id === userId);
    
    // Check permissions
    if (!isAdmin && !isDoctor && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this user\'s analytics'
      });
    }
    
    // ✅ FIXED: Use tenant connection instead of require
    let Mood;
    if (req.tenantConnection) {
      Mood = req.tenantConnection.model('Mood');
    } else {
      Mood = require('../models/Mood');
    }
    
    // Build query filters
    const queryFilters = { userId: userId };
    
    // Add tenant filter if available
    if (req.user.tenantId) {
      queryFilters.tenantId = req.user.tenantId;
    }
    
    // Add date filter
    queryFilters.timestamp = { 
      $gte: new Date(Date.now() - (parseInt(days) * 24 * 60 * 60 * 1000)) 
    };
    
    // Get recent moods for calculation
    const recentMoods = await Mood.find(queryFilters);
    
    // Calculate basic analytics
    const totalEntries = recentMoods.length;
    const averageRating = totalEntries > 0 
      ? recentMoods.reduce((sum, mood) => sum + mood.moodRating, 0) / totalEntries 
      : 0;
    
    // Calculate mood distribution
    const moodDistribution = recentMoods.reduce((dist, mood) => {
      dist[mood.moodKey] = (dist[mood.moodKey] || 0) + 1;
      return dist;
    }, {});
    
    const moodScore = totalEntries > 0
      ? Math.round(((averageRating - 1) / 4) * 100)
      : 0;
    
    res.status(200).json({
      success: true,
      data: {
        totalEntries,
        averageRating: Math.round(averageRating * 100) / 100,
        moodScore,
        moodDistribution,
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
    
    // ✅ ENHANCED: Better permission check
    const isAdmin = req.user && (
      req.user.role === 'admin' || 
      req.user.id === 'admin_default' || 
      req.user._id === 'admin_default'
    );
    
    const isDoctor = req.user && req.user.role === 'doctor';
    const isOwner = req.user && (req.user.id === userId || req.user._id === userId);
    
    // Check permissions
    if (!isAdmin && !isDoctor && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this user\'s mood data'
      });
    }
    
    // ✅ FIXED: Use tenant connection instead of require
    let Mood;
    if (req.tenantConnection) {
      Mood = req.tenantConnection.model('Mood');
    } else {
      Mood = require('../models/Mood');
    }
    
    // Build query
    const query = { userId: userId };
    if (req.user.tenantId) {
      query.tenantId = req.user.tenantId;
    }
    
    const latestMood = await Mood.findOne(query)
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
    
    // ✅ ENHANCED: Better permission check
    const isAdmin = req.user && (
      req.user.role === 'admin' || 
      req.user.id === 'admin_default' || 
      req.user._id === 'admin_default'
    );
    
    const isDoctor = req.user && req.user.role === 'doctor';
    const isOwner = req.user && (req.user.id === userId || req.user._id === userId);
    
    // Check permissions
    if (!isAdmin && !isDoctor && !isOwner) {
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
    
    // ✅ FIXED: Use tenant connection instead of require
    let Mood;
    if (req.tenantConnection) {
      Mood = req.tenantConnection.model('Mood');
    } else {
      Mood = require('../models/Mood');
    }
    
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