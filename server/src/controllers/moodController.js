// controllers/moodController.js

// Import models from the centralized index
const { Mood } = require('../schemas/definitions/moodSchema');

/**
 * @desc    Save a new mood entry
 * @route   POST /api/mood
 * @access  Private
 */
const saveMood = async (req, res) => {
  try {
    console.log('Mood data received:', req.body);
    
    // Extract all needed fields from request body
    const { 
      mood, 
      notes, 
      reflection, 
      symptoms, 
      timestamp 
    } = req.body;
    
    if (!mood) {
      return res.status(400).json({ 
        success: false, 
        message: 'Mood value is required' 
      });
    }
    
    // Create a new mood entry
    const moodEntry = new Mood({
      user: req.user.id,
      mood,
      // Use either notes or reflection field (frontend sends reflection, but schema has notes)
      notes: notes || reflection || '',
      // Add symptoms array if it exists
      symptoms: symptoms || [],
      timestamp: timestamp || new Date()
    });
    
    console.log('Saving mood entry to database:', moodEntry);
    
    // Save the mood entry
    const savedMood = await moodEntry.save();
    
    // Return the saved mood entry
    res.status(201).json({
      success: true,
      data: savedMood
    });
  } catch (error) {
    console.error('Error saving mood entry:', error);
    res.status(500).json({
      success: false,
      message: 'Server error occurred while saving mood entry',
      error: error.message
    });
  }
};

/**
 * @desc    Get mood entries for a user
 * @route   GET /api/mood
 * @access  Private
 */
const getUserMoods = async (req, res) => {
  try {
    const { userId, limit = 7 } = req.query;
    
    // Make sure userId matches authenticated user or user has admin privileges
    if (userId && userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this data'
      });
    }
    
    // Set the user ID to get moods for (either from query or from authenticated user)
    const targetUserId = userId || req.user.id;
    
    // Find mood entries for the user
    const moodEntries = await Mood.find({ user: targetUserId })
      .sort({ timestamp: -1 })  // Sort by newest first
      .limit(parseInt(limit));
    
    res.status(200).json({
      success: true,
      moods: moodEntries
    });
  } catch (error) {
    console.error('Error getting mood entries:', error);
    res.status(500).json({
      success: false,
      message: 'Server error occurred while retrieving mood entries'
    });
  }
};

module.exports = {
  saveMood,
  getUserMoods
};