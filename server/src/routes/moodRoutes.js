const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Define protect middleware directly in this file for now
const protect = async (req, res, next) => {
  try {
    let token;
    
    // Get token from Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, no token provided'
      });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from token
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    // Handle expired token
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired, please log in again'
      });
    }
    
    // Handle invalid token
    return res.status(401).json({
      success: false,
      message: 'Not authorized, invalid token'
    });
  }
};

// Import controllers (using a try-catch to handle potential issues)
let moodController;
try {
  moodController = require('../controllers/moodController');
} catch (error) {
  console.error('Error importing mood controller:', error);
  // Provide fallback controllers
  moodController = {
    saveMood: (req, res) => {
      res.status(500).json({ message: 'Controller not implemented yet' });
    },
    getUserMoods: (req, res) => {
      res.status(500).json({ message: 'Controller not implemented yet' });
    }
  };
}

// Create mood entry
router.post('/', protect, moodController.saveMood);

// Get mood entries for a user
router.get('/', protect, moodController.getUserMoods);

router.get('/users/:userId/moods/current', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get latest mood entry
    const latestMood = await Mood.findOne({ user: userId })
      .sort({ createdAt: -1 })
      .lean();
    
    if (!latestMood) {
      return res.status(200).json({
        mood: 'neutral',
        timestamp: new Date().toISOString(),
        notes: ''
      });
    }
    
    res.status(200).json(latestMood);
  } catch (error) {
    console.error(`Error getting current mood: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get current mood',
      error: error.message
    });
  }
});

// Create mood entry
router.post('/users/:userId/moods', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const { mood, notes, timestamp } = req.body;
    
    // Validate mood
    if (!mood) {
      return res.status(400).json({
        success: false,
        message: 'Mood is required'
      });
    }
    
    // Create mood entry
    const moodEntry = new Mood({
      user: userId,
      mood,
      notes: notes || '',
      timestamp: timestamp ? new Date(timestamp) : new Date()
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
      error: error.message
    });
  }
});

module.exports = router;