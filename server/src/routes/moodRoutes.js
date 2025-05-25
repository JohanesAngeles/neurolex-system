// server/src/routes/moodRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');

// Import mood model with error handling
let Mood;
try {
  Mood = require('../models/Mood');
} catch (error) {
  console.error('Error importing Mood model:', error);
}

// Import controllers with error handling
let moodController;
try {
  moodController = require('../controllers/moodController');
} catch (error) {
  console.error('Error importing mood controller:', error);
  // Provide fallback controllers
  moodController = {
    saveMood: (req, res) => {
      res.status(500).json({ success: false, message: 'Controller not implemented yet' });
    },
    getUserMoods: (req, res) => {
      res.status(500).json({ success: false, message: 'Controller not implemented yet' });
    }
  };
}

// Create mood entry
router.post('/', protect, moodController.saveMood);

// Get mood entries for a user
router.get('/', protect, moodController.getUserMoods);

// Get current mood for a specific user
router.get('/users/:userId/current', protect, async (req, res) => {
  try {
    if (!Mood) {
      return res.status(500).json({
        success: false,
        message: 'Mood model not available'
      });
    }

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

// Create mood entry for a specific user
router.post('/users/:userId/create', protect, async (req, res) => {
  try {
    if (!Mood) {
      return res.status(500).json({
        success: false,
        message: 'Mood model not available'
      });
    }

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