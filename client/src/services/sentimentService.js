// sentimentService.js
import axios from 'axios';

/**
 * Service for fetching and calculating sentiment analysis data from journal entries
 */
class SentimentService {
  /**
   * Fetch sentiment data for a specific time period
   * @param {string} timeFrame - 'week' or 'month' 
   * @param {string} userId - User ID
   * @returns {Promise} - Promise resolving to sentiment data
   */
  async getSentimentData(timeFrame, userId) {
    try {
      // In production, this would be a real API call
      const response = await axios.get(`/api/sentiment/${userId}`, {
        params: { timeFrame }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching sentiment data:', error);
      throw error;
    }
  }

  /**
   * Calculate overall sentiment score based on daily sentiments
   * @param {Array} sentiments - Array of daily sentiment objects
   * @returns {number} - Calculated sentiment score (0-100)
   */
  calculateSentimentScore(sentiments) {
    if (!sentiments || sentiments.length === 0) return 0;
    
    // Point values for each sentiment type
    const sentimentValues = {
      positive: 1,
      neutral: 0.5,
      negative: 0
    };
    
    // Calculate total points
    let totalPoints = 0;
    let countedDays = 0;
    
    sentiments.forEach(day => {
      if (day.sentiment && sentimentValues.hasOwnProperty(day.sentiment)) {
        totalPoints += sentimentValues[day.sentiment];
        countedDays++;
      }
    });
    
    // Calculate score (0-100)
    if (countedDays === 0) return 0;
    const maxPoints = countedDays;
    return Math.round((totalPoints / maxPoints) * 100);
  }

  /**
   * Get the predominant sentiment from an array of daily sentiments
   * @param {Array} sentiments - Array of daily sentiment objects
   * @returns {string} - The predominant sentiment ('positive', 'neutral', or 'negative')
   */
  getTopSentiment(sentiments) {
    if (!sentiments || sentiments.length === 0) return 'neutral';
    
    const counts = {
      positive: 0,
      neutral: 0,
      negative: 0
    };
    
    sentiments.forEach(day => {
      if (day.sentiment && counts.hasOwnProperty(day.sentiment)) {
        counts[day.sentiment]++;
      }
    });
    
    return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
  }

  /**
   * Generate a personalized insight message based on recent sentiment patterns
   * @param {Array} recentSentiments - Array of recent sentiment objects
   * @returns {string} - Personalized insight message
   */
  generateInsightMessage(recentSentiments) {
    if (!recentSentiments || recentSentiments.length === 0) {
      return "Start logging your journal to receive personalized insights.";
    }
    
    const positiveDays = recentSentiments.filter(d => d.sentiment === 'positive').length;
    const negativeDays = recentSentiments.filter(d => d.sentiment === 'negative').length;
    const neutralDays = recentSentiments.filter(d => d.sentiment === 'neutral').length;
    
    // Generate insight based on sentiment patterns
    if (negativeDays > positiveDays && negativeDays > neutralDays) {
      return "You've been feeling more frustrated recently, but also showed moments of hope. Consider journaling about what brought you joy today.";
    } else if (positiveDays > negativeDays && positiveDays > neutralDays) {
      return "You've been feeling quite positive lately. Reflect on what activities contributed to your good mood.";
    } else if (neutralDays > positiveDays && neutralDays > negativeDays) {
      return "Your emotions have been relatively balanced lately. This is a good time to explore deeper patterns in your journal.";
    } else {
      return "You've experienced a range of emotions recently. Journaling about these fluctuations could help you understand patterns.";
    }
  }
}

// eslint-disable-next-line import/no-anonymous-default-export
export default new SentimentService();