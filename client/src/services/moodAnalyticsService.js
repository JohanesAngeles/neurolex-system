// client/src/services/moodAnalyticsService.js
import axios from 'axios';

// Setup base URL for API requests
const API_URL = process.env.REACT_APP_API_URL || '/api';

// Create axios instance with common configuration
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add request interceptor to include authentication token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor for better error logging
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log errors to help with debugging
    console.error('Mood API Error:', {
      url: error.config?.url,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    return Promise.reject(error);
  }
);

// Service functions for mood analytics and doctor-related operations
const moodAnalyticsService = {
  /**
   * Create a new mood check-in entry
   * @param {Object} moodData - Mood check-in data
   * @returns {Promise} API response
   */
  createMoodCheckIn: async (moodData) => {
    try {
      console.log('moodService.createMoodCheckIn called with:', moodData);
      const response = await api.post('/mood/checkin', moodData);
      console.log('moodService.createMoodCheckIn response:', response.data);
      return response.data;
    } catch (error) {
      console.error('moodService.createMoodCheckIn error:', error);
      throw error;
    }
  },

  /**
   * Get mood history for authenticated user
   * @param {Object} params - Query parameters (limit, page)
   * @returns {Promise} API response
   */
  getMoodHistory: async (params = {}) => {
    try {
      const { limit = 30, page = 1 } = params;
      console.log('moodService.getMoodHistory called with params:', { limit, page });
      
      const response = await api.get('/mood/history', {
        params: { limit, page }
      });
      console.log('moodService.getMoodHistory response:', response.data);
      return response.data;
    } catch (error) {
      console.error('moodService.getMoodHistory error:', error);
      throw error;
    }
  },

  /**
   * Get mood analytics for authenticated user
   * @param {number} days - Number of days to analyze (default: 30)
   * @returns {Promise} API response
   */
  getMoodAnalytics: async (days = 30) => {
    try {
      console.log('moodService.getMoodAnalytics called with days:', days);
      const response = await api.get('/mood/analytics', {
        params: { days }
      });
      console.log('moodService.getMoodAnalytics response:', response.data);
      return response.data;
    } catch (error) {
      console.error('moodService.getMoodAnalytics error:', error);
      throw error;
    }
  },

  /**
   * Get current/latest mood for authenticated user
   * @returns {Promise} API response
   */
  getCurrentMood: async () => {
    try {
      console.log('moodService.getCurrentMood called');
      const response = await api.get('/mood/current');
      console.log('moodService.getCurrentMood response:', response.data);
      return response.data;
    } catch (error) {
      console.error('moodService.getCurrentMood error:', error);
      throw error;
    }
  },

  /**
   * Check if user can submit a new mood check-in
   * @returns {Promise} API response
   */
  canCheckIn: async () => {
    try {
      console.log('moodService.canCheckIn called');
      const response = await api.get('/mood/can-checkin');
      console.log('moodService.canCheckIn response:', response.data);
      return response.data;
    } catch (error) {
      console.error('moodService.canCheckIn error:', error);
      throw error;
    }
  },

  /**
   * Get mood history for a specific user (Admin/Doctor access)
   * @param {string} userId - User ID
   * @param {Object} params - Query parameters (limit, page)
   * @returns {Promise} API response
   */
  getUserMoodHistory: async (userId, params = {}) => {
    try {
      const { limit = 30, page = 1 } = params;
      console.log('moodService.getUserMoodHistory called for user:', userId, 'with params:', { limit, page });
      
      const response = await api.get(`/mood/user/${userId}`, {
        params: { limit, page }
      });
      console.log('moodService.getUserMoodHistory response:', response.data);
      return response.data;
    } catch (error) {
      console.error('moodService.getUserMoodHistory error:', error);
      throw error;
    }
  },

  /**
   * Get mood analytics for a specific user (Admin/Doctor access)
   * @param {string} userId - User ID
   * @param {number} days - Number of days to analyze (default: 30)
   * @returns {Promise} API response
   */
  getUserMoodAnalytics: async (userId, days = 30) => {
    try {
      console.log('moodService.getUserMoodAnalytics called for user:', userId, 'with days:', days);
      const response = await api.get(`/mood/user/${userId}/analytics`, {
        params: { days }
      });
      console.log('moodService.getUserMoodAnalytics response:', response.data);
      return response.data;
    } catch (error) {
      console.error('moodService.getUserMoodAnalytics error:', error);
      throw error;
    }
  },

  /**
   * Get comprehensive mood analytics for all patients under doctor's care
   * @param {number} days - Number of days to analyze (default: 7)
   * @returns {Promise} API response
   */
  getDoctorPatientMoodAnalytics: async (days = 7) => {
    try {
      console.log('moodService.getDoctorPatientMoodAnalytics called with days:', days);
      const response = await api.get('/mood/doctor/analytics', {
        params: { days }
      });
      console.log('moodService.getDoctorPatientMoodAnalytics response:', response.data);
      return response.data;
    } catch (error) {
      console.error('moodService.getDoctorPatientMoodAnalytics error:', error);
      throw error;
    }
  },

  /**
   * Get mood trends for a user over time
   * @param {string} userId - User ID (optional, uses current user if not provided)
   * @param {number} days - Number of days to analyze (default: 30)
   * @returns {Promise} API response with trend data
   */
  getMoodTrends: async (userId = null, days = 30) => {
    try {
      const endpoint = userId ? `/mood/user/${userId}/analytics` : '/mood/analytics';
      console.log('moodService.getMoodTrends called for endpoint:', endpoint);
      
      const response = await api.get(endpoint, {
        params: { days }
      });
      
      // Extract trend data from analytics response
      const analytics = response.data;
      if (analytics.success && analytics.data) {
        return {
          success: true,
          trends: analytics.data.trends || [],
          moodDistribution: analytics.data.moodDistribution || {},
          period: `${days} days`
        };
      }
      
      return response.data;
    } catch (error) {
      console.error('moodService.getMoodTrends error:', error);
      throw error;
    }
  },

  /**
   * Export mood data as PDF or CSV
   * @param {Object} params - Export parameters
   * @returns {Promise} File download response
   */
  exportMoodData: async (params = {}) => {
    try {
      const { 
        format = 'pdf', 
        userId = null, 
        days = 30,
        includeDetails = true 
      } = params;
      
      console.log('moodService.exportMoodData called with params:', params);
      
      const endpoint = userId ? `/mood/user/${userId}/export` : '/mood/export';
      const response = await api.get(endpoint, {
        params: { 
          format, 
          days, 
          includeDetails 
        },
        responseType: 'blob' // Important for file downloads
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      // Set filename based on format
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `mood-analytics-${timestamp}.${format}`;
      link.setAttribute('download', filename);
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      return {
        success: true,
        message: `Mood data exported successfully as ${format.toUpperCase()}`,
        filename
      };
    } catch (error) {
      console.error('moodService.exportMoodData error:', error);
      throw error;
    }
  },

  /**
   * Get mood statistics summary
   * @param {Object} params - Parameters for statistics
   * @returns {Promise} API response with statistics
   */
  getMoodStatistics: async (params = {}) => {
    try {
      const { 
        userId = null,
        startDate = null,
        endDate = null,
        groupBy = 'day' // day, week, month
      } = params;
      
      console.log('moodService.getMoodStatistics called with params:', params);
      
      const endpoint = userId ? `/mood/user/${userId}/statistics` : '/mood/statistics';
      const response = await api.get(endpoint, {
        params: { 
          startDate, 
          endDate, 
          groupBy 
        }
      });
      
      console.log('moodService.getMoodStatistics response:', response.data);
      return response.data;
    } catch (error) {
      console.error('moodService.getMoodStatistics error:', error);
      throw error;
    }
  },

  /**
   * Get mood insights and recommendations
   * @param {string} userId - User ID (optional)
   * @param {number} days - Number of days to analyze
   * @returns {Promise} API response with insights
   */
  getMoodInsights: async (userId = null, days = 30) => {
    try {
      console.log('moodService.getMoodInsights called for user:', userId, 'days:', days);
      
      const endpoint = userId ? `/mood/user/${userId}/insights` : '/mood/insights';
      const response = await api.get(endpoint, {
        params: { days }
      });
      
      console.log('moodService.getMoodInsights response:', response.data);
      return response.data;
    } catch (error) {
      console.error('moodService.getMoodInsights error:', error);
      throw error;
    }
  },

  /**
   * Utility function to format mood data for charts
   * @param {Array} moodData - Raw mood data from API
   * @param {string} chartType - Type of chart (line, bar, pie)
   * @returns {Object} Formatted data for chart libraries
   */
  formatMoodDataForChart: (moodData, chartType = 'line') => {
    try {
      if (!Array.isArray(moodData)) {
        console.warn('Invalid mood data for chart formatting');
        return { labels: [], datasets: [] };
      }

      const moodColors = {
        great: '#4CAF50',
        good: '#8BC34A',
        okay: '#FFC107',
        struggling: '#FF9800',
        upset: '#F44336'
      };

      switch (chartType) {
        case 'line':
          return {
            labels: moodData.map(entry => 
              new Date(entry.timestamp).toLocaleDateString()
            ),
            datasets: [{
              label: 'Mood Rating',
              data: moodData.map(entry => entry.moodRating),
              borderColor: '#4CAF50',
              backgroundColor: 'rgba(76, 175, 80, 0.1)',
              fill: true
            }]
          };

        case 'pie':
          const moodCounts = moodData.reduce((acc, entry) => {
            acc[entry.moodKey] = (acc[entry.moodKey] || 0) + 1;
            return acc;
          }, {});

          return {
            labels: Object.keys(moodCounts).map(key => 
              key.charAt(0).toUpperCase() + key.slice(1)
            ),
            datasets: [{
              data: Object.values(moodCounts),
              backgroundColor: Object.keys(moodCounts).map(key => moodColors[key])
            }]
          };

        default:
          return { labels: [], datasets: [] };
      }
    } catch (error) {
      console.error('Error formatting mood data for chart:', error);
      return { labels: [], datasets: [] };
    }
  },

  /**
   * Get user's current authentication status for mood services
   * @returns {boolean} Authentication status
   */
  isAuthenticated: () => {
    const token = localStorage.getItem('token');
    return !!token;
  },

  /**
   * Get current user info from localStorage
   * @returns {Object|null} User data or null
   */
  getCurrentUser: () => {
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error('Error getting current user from localStorage:', error);
      return null;
    }
  }
};

export default moodAnalyticsService;