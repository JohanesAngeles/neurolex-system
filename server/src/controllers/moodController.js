// server/src/controllers/moodController.js
const { CloudinaryHelper } = require('../utils/cloudinaryHelper');

/**
 * @desc    Create a new mood check-in entry
 * @route   POST /api/mood/checkin
 * @access  Private
 */
const createMoodCheckIn = async (req, res) => {
  try {
    console.log('Mood check-in data received:', req.body);
    console.log('Tenant Database:', req.tenantDbName);
    
    // ✅ FIXED: Use tenant connection instead of default
    const Mood = req.tenantConnection.model('Mood');
    
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
    const recentMood = await Mood.findOne({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      timestamp: { $gte: new Date(Date.now() - (2 * 60 * 60 * 1000)) }
    }).sort({ timestamp: -1 });

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
    
    console.log('Saving mood check-in to tenant database:', req.tenantDbName);
    console.log('Mood entry data:', moodEntry);
    
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
    // ✅ FIXED: Use tenant connection
    const Mood = req.tenantConnection.model('Mood');
    
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
    // ✅ FIXED: Use tenant connection
    const Mood = req.tenantConnection.model('Mood');
    
    const { days = 30 } = req.query;
    
    // Get recent moods for calculation
    const recentMoods = await Mood.find({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      timestamp: { 
        $gte: new Date(Date.now() - (parseInt(days) * 24 * 60 * 60 * 1000)) 
      }
    });
    
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
    // ✅ FIXED: Use tenant connection
    const Mood = req.tenantConnection.model('Mood');
    
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
    // ✅ FIXED: Use tenant connection
    const Mood = req.tenantConnection.model('Mood');
    
    const recentMood = await Mood.findOne({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      timestamp: { $gte: new Date(Date.now() - (2 * 60 * 60 * 1000)) }
    }).sort({ timestamp: -1 });
    
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
    // ✅ FIXED: Use tenant connection
    const Mood = req.tenantConnection.model('Mood');
    
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

/**
 * @desc    Get comprehensive mood analytics for all patients under a doctor's care
 * @route   GET /api/mood/doctor/analytics
 * @access  Private (Doctor only)
 */
const getDoctorPatientMoodAnalytics = async (req, res) => {
  try {
    console.log('Fetching doctor mood analytics for:', req.user.id);
    
    // Use tenant connection
    const Mood = req.tenantConnection.model('Mood');
    const PatientDoctorAssociation = req.tenantConnection.model('PatientDoctorAssociation');
    
    // Verify user is a doctor
    if (req.user.role !== 'doctor') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Doctor role required.'
      });
    }

    const { days = 7 } = req.query; // Default to 7 days for analytics
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    // Get all active patients under this doctor's care
    const patientAssociations = await PatientDoctorAssociation.find({
      doctor: req.user.id,
      status: 'active'
    }).select('patient');
    
    const patientIds = patientAssociations.map(assoc => assoc.patient);
    
    if (patientIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          keyMetrics: {
            totalLogs: 0,
            averageLogsPerDay: 0,
            averageMoodScore: 0,
            topEmotionalTrends: []
          },
          dailyOverview: [],
          moodDistribution: {
            great: { count: 0, percentage: 0 },
            good: { count: 0, percentage: 0 },
            okay: { count: 0, percentage: 0 },
            struggling: { count: 0, percentage: 0 },
            upset: { count: 0, percentage: 0 }
          }
        }
      });
    }

    // 1. KEY METRICS CALCULATION
    // Get all mood entries for patients under doctor's care
    const allMoodEntries = await Mood.find({
      tenantId: req.user.tenantId,
      userId: { $in: patientIds },
      timestamp: { $gte: startDate }
    }).sort({ timestamp: -1 });

    const totalLogs = allMoodEntries.length;
    const averageLogsPerDay = Math.round((totalLogs / parseInt(days)) * 10) / 10;
    
    // Calculate average mood score (1-5 scale converted to percentage)
    const averageMoodRating = totalLogs > 0 
      ? allMoodEntries.reduce((sum, entry) => sum + entry.moodRating, 0) / totalLogs 
      : 0;
    const averageMoodScore = Math.round(((averageMoodRating - 1) / 4) * 100) / 100;

    // Get top 3 emotional trends (most frequent mood keys)
    const moodKeyCount = allMoodEntries.reduce((acc, entry) => {
      acc[entry.moodKey] = (acc[entry.moodKey] || 0) + 1;
      return acc;
    }, {});
    
    const topEmotionalTrends = Object.entries(moodKeyCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([mood, count]) => ({
        mood: mood.charAt(0).toUpperCase() + mood.slice(1),
        count,
        percentage: Math.round((count / totalLogs) * 100)
      }));

    // 2. DAILY OVERVIEW (Last 7 days with most frequent mood per day)
    const dailyOverview = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));
      
      const dayMoods = allMoodEntries.filter(entry => 
        entry.timestamp >= dayStart && entry.timestamp <= dayEnd
      );
      
      // Find most frequent mood for the day
      const dayMoodCount = dayMoods.reduce((acc, entry) => {
        acc[entry.moodKey] = (acc[entry.moodKey] || 0) + 1;
        return acc;
      }, {});
      
      const mostFrequentMood = Object.entries(dayMoodCount)
        .sort(([,a], [,b]) => b - a)[0];
      
      // Calculate average mood score for the day
      const dayAverageMoodRating = dayMoods.length > 0
        ? dayMoods.reduce((sum, entry) => sum + entry.moodRating, 0) / dayMoods.length
        : 0;
      const dayAverageMoodScore = Math.round(((dayAverageMoodRating - 1) / 4) * 100) / 100;
      
      dailyOverview.push({
        date: dayStart.toISOString().split('T')[0],
        dateFormatted: dayStart.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        }),
        mostFrequentMood: mostFrequentMood ? mostFrequentMood[0] : 'okay',
        moodCount: mostFrequentMood ? mostFrequentMood[1] : 0,
        totalEntries: dayMoods.length,
        averageMoodScore: dayAverageMoodScore
      });
    }

    // 3. MOOD DISTRIBUTION (All 5 moods with counts and percentages)
    const moodDistribution = {
      great: { count: 0, percentage: 0 },
      good: { count: 0, percentage: 0 },
      okay: { count: 0, percentage: 0 },
      struggling: { count: 0, percentage: 0 },
      upset: { count: 0, percentage: 0 }
    };
    
    // Count each mood type
    allMoodEntries.forEach(entry => {
      if (moodDistribution[entry.moodKey]) {
        moodDistribution[entry.moodKey].count++;
      }
    });
    
    // Calculate percentages
    Object.keys(moodDistribution).forEach(moodKey => {
      moodDistribution[moodKey].percentage = totalLogs > 0 
        ? Math.round((moodDistribution[moodKey].count / totalLogs) * 100)
        : 0;
    });

    // Response
    res.status(200).json({
      success: true,
      data: {
        keyMetrics: {
          totalLogs,
          averageLogsPerDay,
          averageMoodScore,
          topEmotionalTrends
        },
        dailyOverview,
        moodDistribution,
        period: `${days} days`,
        totalPatients: patientIds.length,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error getting doctor patient mood analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Server error occurred while retrieving mood analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
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
  getUserMoods: getMoodHistory,
  getDoctorPatientMoodAnalytics
};