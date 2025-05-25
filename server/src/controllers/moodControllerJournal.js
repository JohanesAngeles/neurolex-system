// moodController.js - Server-side controller for mood/sentiment functionality
const Mood = require('../models/Mood');
const User = require('../models/User');
const { format, sub, isAfter, startOfDay } = require('date-fns');

/**
 * Controller for handling mood/sentiment related functionality
 */
const moodController = {
  /**
   * Get sentiment analysis data for a specific time period
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getSentimentData: async (req, res) => {
    try {
      const { userId } = req.params;
      const { timeFrame = 'week' } = req.query;
      
      // Set start date based on time frame
      const now = new Date();
      const startDate = timeFrame === 'week' 
        ? sub(now, { days: 7 }) 
        : sub(now, { days: 30 });
        
      // Get all mood entries for the user within the time range
      const moodEntries = await Mood.find({
        userId,
        date: { $gte: startOfDay(startDate) }
      }).sort({ date: 1 });
      
      // If no entries found, return empty data structure
      if (!moodEntries || moodEntries.length === 0) {
        return res.status(200).json({
          dates: [],
          summary: {
            positiveDays: 0,
            neutralDays: 0,
            negativeDays: 0,
            unloggedDays: timeFrame === 'week' ? 7 : 30,
            totalDays: timeFrame === 'week' ? 7 : 30,
            score: 0
          }
        });
      }
      
      // Process mood entries into daily sentiment data
      const daysInPeriod = timeFrame === 'week' ? 7 : 30;
      const dateArray = Array(daysInPeriod).fill().map((_, i) => {
        const date = sub(now, { days: daysInPeriod - 1 - i });
        return {
          date: date,
          formattedDate: format(date, 'yyyy-MM-dd'),
          day: format(date, 'EEEE'),
          dayShort: format(date, 'E'),
          dayOfMonth: format(date, 'd'),
          month: format(date, 'MMM'),
          sentiment: null  // Will be populated if an entry exists
        };
      });
      
      // Map mood entries to sentiment values
      const moodToSentimentMap = {
        5: 'positive',   // Very Happy
        4: 'positive',   // Happy
        3: 'neutral',    // Neutral
        2: 'negative',   // Sad
        1: 'negative'    // Very Sad
      };
      
      // Fill in sentiment for days that have entries
      moodEntries.forEach(entry => {
        const entryDate = format(entry.date, 'yyyy-MM-dd');
        const dayIndex = dateArray.findIndex(d => d.formattedDate === entryDate);
        
        if (dayIndex >= 0) {
          dateArray[dayIndex].sentiment = moodToSentimentMap[entry.value] || 'neutral';
          dateArray[dayIndex].originalValue = entry.value;
          dateArray[dayIndex].notes = entry.notes;
        }
      });
      
      // Count sentiment types
      const positiveDays = dateArray.filter(d => d.sentiment === 'positive').length;
      const neutralDays = dateArray.filter(d => d.sentiment === 'neutral').length;
      const negativeDays = dateArray.filter(d => d.sentiment === 'negative').length;
      const unloggedDays = dateArray.filter(d => d.sentiment === null).length;
      
      // Calculate score
      // Score calculation: (positive*1 + neutral*0.5 + negative*0) / totalDays * 100
      const totalPoints = positiveDays + (neutralDays * 0.5);
      const maxPoints = dateArray.length - unloggedDays;
      const score = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0;
      
      // Return formatted data
      return res.status(200).json({
        dates: dateArray,
        summary: {
          positiveDays,
          neutralDays,
          negativeDays,
          unloggedDays,
          totalDays: daysInPeriod,
          score
        }
      });
    } catch (error) {
      console.error('Error fetching sentiment data:', error);
      return res.status(500).json({ message: 'Server error while fetching sentiment data' });
    }
  },
  
  /**
   * Record a new mood/journal entry
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  recordMood: async (req, res) => {
    try {
      const { userId } = req.params;
      const { value, notes, date = new Date() } = req.body;
      
      // Validate mood value
      if (value < 1 || value > 5) {
        return res.status(400).json({ message: 'Mood value must be between 1 and 5' });
      }
      
      // Check if a mood entry already exists for this day
      const existingEntry = await Mood.findOne({
        userId,
        date: {
          $gte: startOfDay(new Date(date)),
          $lt: new Date(new Date(date).setDate(new Date(date).getDate() + 1))
        }
      });
      
      if (existingEntry) {
        // Update existing entry
        existingEntry.value = value;
        existingEntry.notes = notes;
        await existingEntry.save();
        return res.status(200).json(existingEntry);
      }
      
      // Create new mood entry
      const newMood = new Mood({
        userId,
        value,
        notes,
        date: new Date(date)
      });
      
      await newMood.save();
      return res.status(201).json(newMood);
      
    } catch (error) {
      console.error('Error recording mood:', error);
      return res.status(500).json({ message: 'Server error while recording mood' });
    }
  },
  
  /**
   * Get all mood entries for a user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getUserMoods: async (req, res) => {
    try {
      const { userId } = req.params;
      const { startDate, endDate } = req.query;
      
      const query = { userId };
      
      // Add date range filter if provided
      if (startDate) {
        query.date = { ...query.date, $gte: new Date(startDate) };
      }
      
      if (endDate) {
        query.date = { ...query.date, $lte: new Date(endDate) };
      }
      
      const moods = await Mood.find(query).sort({ date: -1 });
      return res.status(200).json(moods);
      
    } catch (error) {
      console.error('Error fetching user moods:', error);
      return res.status(500).json({ message: 'Server error while fetching mood data' });
    }
  },
  
  /**
   * Get AI-powered insights based on user's mood patterns
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getInsights: async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Get user's mood entries from the last 30 days
      const thirtyDaysAgo = sub(new Date(), { days: 30 });
      const moodEntries = await Mood.find({
        userId,
        date: { $gte: thirtyDaysAgo }
      }).sort({ date: 1 });
      
      if (!moodEntries || moodEntries.length === 0) {
        return res.status(200).json({
          insights: "Start logging your mood to receive personalized insights."
        });
      }
      
      // Map mood values to sentiment categories
      const moodToSentimentMap = {
        5: 'positive',
        4: 'positive',
        3: 'neutral',
        2: 'negative',
        1: 'negative'
      };
      
      const sentiments = moodEntries.map(entry => ({
        date: entry.date,
        sentiment: moodToSentimentMap[entry.value] || 'neutral',
        value: entry.value
      }));
      
      // Calculate various metrics for insights
      const positiveDays = sentiments.filter(s => s.sentiment === 'positive').length;
      const negativeDays = sentiments.filter(s => s.sentiment === 'negative').length;
      const neutralDays = sentiments.filter(s => s.sentiment === 'neutral').length;
      
      const totalEntries = sentiments.length;
      const positivePercentage = Math.round((positiveDays / totalEntries) * 100);
      const negativePercentage = Math.round((negativeDays / totalEntries) * 100);
      
      // Get the most recent 7 days of entries
      const recentEntries = sentiments.slice(-7);
      const recentPositive = recentEntries.filter(s => s.sentiment === 'positive').length;
      const recentNegative = recentEntries.filter(s => s.sentiment === 'negative').length;
      
      // Generate personalized insight message
      let insightMessage = "";
      
      if (recentNegative > recentPositive) {
        insightMessage = "You've been feeling more frustrated recently, but also showed moments of hope. Consider journaling about what brought you joy today.";
      } else if (recentPositive > recentNegative) {
        insightMessage = "You've been feeling quite positive lately. Reflect on what activities contributed to your good mood.";
      } else {
        insightMessage = "You've experienced a range of emotions recently. Journaling about these fluctuations could help you understand patterns.";
      }
      
      // Look for patterns
      const patterns = [];
      
      // Check for mood improvement
      if (recentPositive > Math.round(totalEntries * positivePercentage / 100)) {
        patterns.push("Your mood seems to be improving lately.");
      }
      
      // Check for mood decline
      if (recentNegative > Math.round(totalEntries * negativePercentage / 100)) {
        patterns.push("You've had more difficult days recently than your typical pattern.");
      }
      
      // Check for consistency
      const values = moodEntries.map(entry => entry.value);
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;
      const variance = values.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / values.length;
      
      if (variance < 0.5) {
        patterns.push("Your mood has been relatively stable over the past month.");
      } else if (variance > 1.5) {
        patterns.push("You've experienced significant mood fluctuations recently.");
      }
      
      return res.status(200).json({
        insights: insightMessage,
        patterns,
        metrics: {
          positivePercentage,
          negativePercentage,
          neutralPercentage: 100 - positivePercentage - negativePercentage,
          entriesCount: totalEntries
        }
      });
      
    } catch (error) {
      console.error('Error generating insights:', error);
      return res.status(500).json({ message: 'Server error while generating insights' });
    }
  }
};

module.exports = moodController;