// server/src/controllers/moodController.js
const Mood = require('../models/Mood');
const { CloudinaryHelper } = require('../utils/cloudinaryHelper');

/**
 * @desc    Create a new mood check-in entry
 * @route   POST /api/mood/checkin
 * @access  Private
 */
const createMoodCheckIn = async (req, res) => {
  try {
    console.log('Mood check-in data received:', req.body);
    
    const { 
      moodRating,
      moodKey, 
      moodLabel,
      reflection,
      timezone,
      deviceType,
      appVersion
    } = req.body;
    
    // Validation
    if (!moodRating || !moodKey || !moodLabel) {
      return res.status(400).json({ 
        success: false, 
        message: 'Mood rating, key, and label are required' 
      });
    }

    // Check if user already has a mood entry within the last 2 hours
    const recentMood = await Mood.findRecentMoodByUser(
      req.user.tenantId, 
      req.user.id, 
      2
    );

    if (recentMood) {
      return res.status(429).json({
        success: false,
        message: 'You can only submit one mood check-in every 2 hours',
        nextAllowedTime: new Date(recentMood.timestamp.getTime() + (2 * 60 * 60 * 1000)),
        lastEntry: {
          moodKey: recentMood.moodKey,
          moodLabel: recentMood.moodLabel,
          timestamp: recentMood.timestamp
        }
      });
    }

    // Generate Cloudinary SVG URL based on mood key
    const moodSvgUrl = CloudinaryHelper.getMoodUrl(moodKey);
    
    // Create new mood entry
    const moodEntry = new Mood({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      moodRating: parseInt(moodRating),
      moodKey,
      moodLabel,
      moodSvgUrl,
      reflection: reflection || '',
      timestamp: new Date(),
      metadata: {
        deviceType: deviceType || 'mobile',
        appVersion: appVersion || '1.0.0',
        timezone: timezone || 'UTC'
      }
    });
    
    console.log('Saving mood check-in to database:', moodEntry);
    
    const savedMood = await moodEntry.save();
    
    res.status(201).json({
      success: true,
      message: 'Mood check-in saved successfully',
      data: {
        id: savedMood._id,
        moodRating: savedMood.moodRating,
        moodKey: savedMood.moodKey,
        moodLabel: savedMood.moodLabel,
        moodSvgUrl: savedMood.moodSvgUrl,
        reflection: savedMood.reflection,
        timestamp: savedMood.timestamp,
        sentiment: savedMood.sentiment
      }
    });
  } catch (error) {
    console.error('Error saving mood check-in:', error);
    res.status(500).json({
      success: false,
      message: 'Server error occurred while saving mood check-in',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @desc    Get mood history for authenticated user
 * @route   GET /api/mood/history
 * @access  Private
 */
const getMoodHistory = async (req, res) => {
  try {
    const { limit = 30, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const moodHistory = await Mood.find({
      tenantId: req.user.tenantId,
      userId: req.user.id
    })
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .select('moodRating moodKey moodLabel moodSvgUrl reflection timestamp sentiment');
    
    // Get total count for pagination
    const totalCount = await Mood.countDocuments({
      tenantId: req.user.tenantId,
      userId: req.user.id
    });
    
    res.status(200).json({
      success: true,
      data: moodHistory,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalEntries: totalCount,
        hasNext: skip + moodHistory.length < totalCount,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Error getting mood history:', error);
    res.status(500).json({
      success: false,
      message: 'Server error occurred while retrieving mood history'
    });
  }
};

/**
 * @desc    Get mood analytics for authenticated user
 * @route   GET /api/mood/analytics
 * @access  Private
 */
const getMoodAnalytics = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const analytics = await Mood.getMoodAnalytics(
      req.user.tenantId,
      req.user.id,
      parseInt(days)
    );
    
    // Calculate mood trends
    const trends = await Mood.getMoodTrends(
      req.user.tenantId,
      req.user.id,
      parseInt(days)
    );
    
    // Calculate mood score
    const recentMoods = await Mood.find({
      tenantId: req.user.tenantId,
      userId: req.user.id,
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
        period: `${days} days`
      }
    });
  } catch (error) {
    console.error('Error getting mood analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Server error occurred while retrieving mood analytics'
    });
  }
};

/**
 * @desc    Get current/latest mood for authenticated user
 * @route   GET /api/mood/current
 * @access  Private
 */
const getCurrentMood = async (req, res) => {
  try {
    const latestMood = await Mood.findOne({
      tenantId: req.user.tenantId,
      userId: req.user.id
    })
    .sort({ timestamp: -1 })
    .select('moodRating moodKey moodLabel moodSvgUrl reflection timestamp sentiment');
    
    if (!latestMood) {
      return res.status(200).json({
        success: true,
        message: 'No mood entries found',
        data: null
      });
    }
    
    res.status(200).json({
      success: true,
      data: latestMood
    });
  } catch (error) {
    console.error('Error getting current mood:', error);
    res.status(500).json({
      success: false,
      message: 'Server error occurred while retrieving current mood'
    });
  }
};

/**
 * @desc    Check if user can submit a new mood check-in
 * @route   GET /api/mood/can-checkin
 * @access  Private
 */
const canCheckIn = async (req, res) => {
  try {
    const recentMood = await Mood.findRecentMoodByUser(
      req.user.tenantId,
      req.user.id,
      2
    );
    
    if (recentMood) {
      const nextAllowedTime = new Date(recentMood.timestamp.getTime() + (2 * 60 * 60 * 1000));
      const canCheckInNow = new Date() >= nextAllowedTime;
      
      return res.status(200).json({
        success: true,
        canCheckIn: canCheckInNow,
        nextAllowedTime: canCheckInNow ? null : nextAllowedTime,
        lastCheckIn: {
          moodKey: recentMood.moodKey,
          moodLabel: recentMood.moodLabel,
          timestamp: recentMood.timestamp
        }
      });
    }
    
    res.status(200).json({
      success: true,
      canCheckIn: true,
      nextAllowedTime: null,
      lastCheckIn: null
    });
  } catch (error) {
    console.error('Error checking mood check-in eligibility:', error);
    res.status(500).json({
      success: false,
      message: 'Server error occurred while checking check-in eligibility'
    });
  }
};

/**
 * @desc    Get mood entries for a specific user (Admin/Doctor access)
 * @route   GET /api/mood/user/:userId
 * @access  Private (Admin/Doctor only)
 */
const getUserMoodHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 30, page = 1 } = req.query;
    
    // Check if requesting user has permission to view other user's data
    if (req.user.id !== userId && !['admin', 'doctor'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this user\'s mood data'
      });
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const moodHistory = await Mood.find({
      tenantId: req.user.tenantId, // Ensure tenant isolation
      userId: userId
    })
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .select('moodRating moodKey moodLabel moodSvgUrl reflection timestamp sentiment');
    
    const totalCount = await Mood.countDocuments({
      tenantId: req.user.tenantId,
      userId: userId
    });
    
    res.status(200).json({
      success: true,
      data: moodHistory,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalEntries: totalCount,
        hasNext: skip + moodHistory.length < totalCount,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Error getting user mood history:', error);
    res.status(500).json({
      success: false,
      message: 'Server error occurred while retrieving user mood history'
    });
  }
};

module.exports = {
  createMoodCheckIn,
  getMoodHistory,
  getMoodAnalytics,
  getCurrentMood,
  canCheckIn,
  getUserMoodHistory,
  
  // Legacy methods for backward compatibility
  saveMood: createMoodCheckIn,
  getUserMoods: getMoodHistory
};