/**
 * Updated service for handling mood tracking operations with symptom support
 */

// Base API URL - replace with your actual API endpoint
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

/**
 * Get the current user ID from localStorage
 * @returns {String|null} - User ID or null if not found
 */
const getCurrentUserId = () => {
  // Try to get the user from localStorage
  const user = localStorage.getItem('user');
  if (user) {
    try {
      return JSON.parse(user)._id || JSON.parse(user).id;
    } catch (error) {
      console.error('Error parsing user from localStorage:', error);
      return null;
    }
  }
  return null;
};

/**
 * Get tenant ID from localStorage if available
 * @returns {String|null} - Tenant ID or null if not found
 */
const getCurrentTenantId = () => {
  // Try to get tenant data from localStorage
  const tenant = localStorage.getItem('tenant');
  if (tenant) {
    try {
      const tenantData = JSON.parse(tenant);
      return tenantData._id;
    } catch (error) {
      console.error('Error parsing tenant from localStorage:', error);
      return null;
    }
  }
  return null;
};

/**
 * Get user-specific storage key
 * @param {String} key - Base key name
 * @returns {String} - User-specific key
 */
const getUserStorageKey = (key) => {
  const userId = getCurrentUserId();
  return userId ? `${key}_${userId}` : key;
};

/**
 * Save a mood entry to the backend
 * @param {Object} moodData - The mood data to save
 * @returns {Promise} - Promise resolving to the response data
 */
const saveMoodEntry = async (moodData) => {
  try {
    // Get the authentication token
    const token = localStorage.getItem('token');
    
    if (!token) {
      throw new Error('Authentication required');
    }
    
    // Get current user ID for the mood data
    const userId = getCurrentUserId();
    if (!userId) {
      throw new Error('User ID not available');
    }
    
    // Get tenant ID if available
    const tenantId = getCurrentTenantId();
    
    // Add user ID and tenant ID to the mood data
    const enhancedMoodData = {
      ...moodData,
      userId,
      tenantId
    };
    
    // Format the data to match the backend expectations
    const apiPayload = {
      mood: enhancedMoodData.mood,
      // Use either reflection or notes field
      reflection: enhancedMoodData.reflection,
      notes: enhancedMoodData.reflection, // Duplicate to ensure backend gets it
      symptoms: enhancedMoodData.symptoms || [],
      timestamp: enhancedMoodData.timestamp,
      userId: enhancedMoodData.userId,
      tenantId: enhancedMoodData.tenantId
    };
    
    console.log('Sending mood data to API:', apiPayload);
    
    const response = await fetch(`${API_URL}/mood`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(apiPayload)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('API error response:', errorData);
      throw new Error(errorData.message || `Server responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('API success response:', data);
    
    // Store in local storage as well for quick access
    const userLastSubmissionKey = getUserStorageKey('lastMoodSubmission');
    localStorage.setItem(userLastSubmissionKey, new Date().toISOString());
    
    // Also store in the current day's mood data
    storeCurrentDayMood(enhancedMoodData);
    
    // Trigger a custom event to notify other components
    try {
      const event = new CustomEvent('moodSubmitted', { detail: enhancedMoodData });
      window.dispatchEvent(event);
      console.log('Mood submitted event dispatched');
    } catch (eventError) {
      console.error('Error dispatching mood event:', eventError);
    }
    
    return data;
  } catch (error) {
    console.error('Error saving mood entry:', error);
    
    // For now, save to localStorage as a fallback
    const userId = getCurrentUserId();
    const tenantId = getCurrentTenantId();
    
    const localMoodData = {
      ...moodData,
      userId,
      tenantId,
      timestamp: new Date().toISOString(),
      syncStatus: 'pending' // Mark for future sync when online
    };
    
    // Use user-specific keys for local storage
    const userLastSubmissionKey = getUserStorageKey('lastMoodSubmission');
    const userPendingEntriesKey = getUserStorageKey('pendingMoodEntries');
    
    // Store the submission time
    localStorage.setItem(userLastSubmissionKey, new Date().toISOString());
    
    // Store the actual mood data
    const existingEntries = JSON.parse(localStorage.getItem(userPendingEntriesKey) || '[]');
    existingEntries.push(localMoodData);
    localStorage.setItem(userPendingEntriesKey, JSON.stringify(existingEntries));
    
    // Also store in the current day's mood data
    storeCurrentDayMood(localMoodData);
    
    // Trigger a custom event even on error
    try {
      const event = new CustomEvent('moodSubmitted', { detail: localMoodData });
      window.dispatchEvent(event);
      console.log('Mood submitted event dispatched (from error handler)');
    } catch (eventError) {
      console.error('Error dispatching mood event:', eventError);
    }
    
    // Throw the error again for the caller to handle
    throw error;
  }
};

/**
 * Store the current day's mood data for immediate access
 * @param {Object} moodData - The mood data to store
 */
const storeCurrentDayMood = (moodData) => {
  try {
    const userId = moodData.userId || getCurrentUserId();
    
    if (!userId) return;
    
    // Create a key for today's date
    const today = new Date();
    const dateKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    const todayMoodKey = `mood_${dateKey}_${userId}`;
    
    // Store the mood data with today's date as key
    localStorage.setItem(todayMoodKey, JSON.stringify(moodData));
    console.log(`Stored today's mood data with key: ${todayMoodKey}`);
    
    // Also update today's date in a central "submitted dates" record
    const submittedDatesKey = getUserStorageKey('moodSubmittedDates');
    let submittedDates = [];
    
    try {
      submittedDates = JSON.parse(localStorage.getItem(submittedDatesKey) || '[]');
    } catch (e) {
      console.error('Error parsing submitted dates:', e);
    }
    
    if (!submittedDates.includes(dateKey)) {
      submittedDates.push(dateKey);
      localStorage.setItem(submittedDatesKey, JSON.stringify(submittedDates));
    }
  } catch (error) {
    console.error('Error storing current day mood:', error);
  }
};

/**
 * Check if user has submitted a mood today
 * @returns {Boolean} - True if mood was submitted today, false otherwise
 */
const hasSubmittedToday = () => {
  const userLastSubmissionKey = getUserStorageKey('lastMoodSubmission');
  const lastSubmission = localStorage.getItem(userLastSubmissionKey);
  
  if (!lastSubmission) return false;
  
  const lastDate = new Date(lastSubmission);
  const today = new Date();
  
  // Check if last submission was today
  return (
    lastDate.getDate() === today.getDate() &&
    lastDate.getMonth() === today.getMonth() &&
    lastDate.getFullYear() === today.getFullYear()
  );
};

/**
 * Get user's mood history
 * @param {Number} limit - Maximum number of entries to retrieve
 * @returns {Promise} - Promise resolving to mood history data
 */
const getMoodHistory = async (limit = 7) => {
  try {
    // Get the authentication token
    const token = localStorage.getItem('token');
    
    if (!token) {
      throw new Error('Authentication required');
    }
    
    const userId = getCurrentUserId();
    if (!userId) {
      throw new Error('User ID not available');
    }
    
    // Get tenant ID if available
    const tenantId = getCurrentTenantId();
    
    // Build URL with tenant ID if available
    let url = `${API_URL}/mood?userId=${userId}&limit=${limit}`;
    if (tenantId) {
      url += `&tenantId=${tenantId}`;
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to retrieve mood history');
    }
    
    // Merge with local storage data for completeness
    const mergedMoods = mergeWithLocalMoods(data.moods || []);
    return { moods: mergedMoods };
  } catch (error) {
    console.error('Error getting mood history:', error);
    
    // Try to get data from localStorage as fallback
    try {
      // Get both pending entries and daily entries
      const moods = getLocalMoodHistory(limit);
      return { moods };
    } catch (localError) {
      console.error('Error getting local mood history:', localError);
      return { moods: [] };
    }
  }
};

/**
 * Merge API mood data with local mood data
 * @param {Array} apiMoods - Mood data from the API
 * @returns {Array} - Merged mood data
 */
const mergeWithLocalMoods = (apiMoods) => {
  try {
    const userId = getCurrentUserId();
    if (!userId) return apiMoods;
    
    // Get all local moods
    const localMoods = getLocalMoodHistory();
    
    // Create a map of API moods by date for easy lookup
    const moodMap = new Map();
    apiMoods.forEach(mood => {
      const date = new Date(mood.timestamp);
      const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      moodMap.set(dateKey, mood);
    });
    
    // Add local moods that don't exist in API data
    localMoods.forEach(localMood => {
      const date = new Date(localMood.timestamp);
      const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      
      if (!moodMap.has(dateKey)) {
        moodMap.set(dateKey, localMood);
      }
    });
    
    // Convert map back to array
    return Array.from(moodMap.values());
  } catch (error) {
    console.error('Error merging mood data:', error);
    return apiMoods;
  }
};

/**
 * Get mood history from localStorage
 * @param {Number} limit - Maximum number of entries to retrieve
 * @returns {Array} - Array of mood entries
 */
const getLocalMoodHistory = (limit = Infinity) => {
  try {
    const userId = getCurrentUserId();
    if (!userId) return [];
    
    const moods = [];
    
    // Get pending entries
    const pendingEntriesKey = getUserStorageKey('pendingMoodEntries');
    const pendingEntries = JSON.parse(localStorage.getItem(pendingEntriesKey) || '[]');
    moods.push(...pendingEntries);
    
    // Get daily entries
    const submittedDatesKey = getUserStorageKey('moodSubmittedDates');
    const submittedDates = JSON.parse(localStorage.getItem(submittedDatesKey) || '[]');
    
    for (const dateKey of submittedDates) {
      const moodKey = `mood_${dateKey}_${userId}`;
      const moodData = localStorage.getItem(moodKey);
      
      if (moodData) {
        try {
          moods.push(JSON.parse(moodData));
        } catch (e) {
          console.error(`Error parsing mood data for ${dateKey}:`, e);
        }
      }
    }
    
    // Sort by timestamp (newest first)
    moods.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Limit the number of entries
    return moods.slice(0, limit);
  } catch (error) {
    console.error('Error getting local mood history:', error);
    return [];
  }
};

/**
 * Get today's mood data if available
 * @returns {Object|null} - Today's mood data or null if not found
 */
const getTodaysMood = () => {
  try {
    const userId = getCurrentUserId();
    if (!userId) return null;
    
    const today = new Date();
    const dateKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    const todayMoodKey = `mood_${dateKey}_${userId}`;
    
    const moodData = localStorage.getItem(todayMoodKey);
    return moodData ? JSON.parse(moodData) : null;
  } catch (error) {
    console.error('Error getting today\'s mood:', error);
    return null;
  }
};

/**
 * Reset the tracker to show again (for testing purposes)
 */
const resetTracker = () => {
  const userLastSubmissionKey = getUserStorageKey('lastMoodSubmission');
  localStorage.removeItem(userLastSubmissionKey);
};

const moodService = {
  saveMoodEntry,
  hasSubmittedToday,
  getMoodHistory,
  getTodaysMood,
  resetTracker,
  getCurrentUserId,
  getCurrentTenantId
};

export default moodService;