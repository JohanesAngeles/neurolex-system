// src/services/journalService.js
import axios from 'axios';

/**
 * Service for handling journal-related API calls
 */
class JournalService {
  /**
   * Get journal entries for the current user
   * @param {Object} options - Filter options for journal entries
   * @returns {Promise} Promise with journal entries
   */
  async getUserJournalEntries(options = {}) {
    try {
      // Get authentication token
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No authentication token found');
        return [];
      }
      
      // Get user info
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        console.error('No user data found');
        return [];
      }
      
      const userData = JSON.parse(userStr);
      const userId = userData.id || userData._id;
      
      // Get tenant ID if available
      const tenantStr = localStorage.getItem('tenant');
      const tenantId = tenantStr ? JSON.parse(tenantStr)._id : null;
      
      // Build query parameters
      const params = new URLSearchParams();
      
      // Add options to params
      if (options.limit) params.append('limit', options.limit);
      if (options.sort) params.append('sort', options.sort);
      
      // Add tenant ID if available
      if (tenantId) {
        params.append('tenantId', tenantId);
      }
      
      // Make API request
      const url = `/api/journal/users/${userId}/journal-entries?${params.toString()}`;
      console.log('Fetching journal entries from URL:', url);
      
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      console.log('Journal entries response:', response.data);
      
      // Return journal entries data
      if (response.data && response.data.success && Array.isArray(response.data.data)) {
        return response.data.data;
      } else if (Array.isArray(response.data)) {
        return response.data;
      } else {
        console.warn('Unexpected response format for journal entries:', response.data);
        return [];
      }
    } catch (error) {
      console.error('Error fetching journal entries:', error);
      return [];
    }
  }
  
  /**
   * Get a specific journal entry by ID
   * @param {string} entryId - ID of the journal entry
   * @returns {Promise} Promise with journal entry data
   */
  async getJournalEntry(entryId) {
    try {
      // Get authentication token
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      // Get tenant ID if available
      const tenantStr = localStorage.getItem('tenant');
      const tenantId = tenantStr ? JSON.parse(tenantStr)._id : null;
      
      // Build URL with tenant ID if available
      let url = `/api/journal/${entryId}`;
      if (tenantId) {
        url += `?tenantId=${tenantId}`;
      }
      
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      // Return journal entry data
      if (response.data && response.data.success) {
        return response.data.data;
      } else {
        return response.data;
      }
    } catch (error) {
      console.error(`Error fetching journal entry ${entryId}:`, error);
      throw error;
    }
  }
  
  /**
   * Create a new journal entry
   * @param {Object} entryData - Data for the new journal entry
   * @returns {Promise} Promise with the created journal entry
   */
  async createJournalEntry(entryData) {
    try {
      // Get authentication token
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      // Get tenant ID if available
      const tenantStr = localStorage.getItem('tenant');
      const tenantId = tenantStr ? JSON.parse(tenantStr)._id : null;
      
      // Build URL with tenant ID if available
      let url = `/api/journal`;
      if (tenantId) {
        url += `?tenantId=${tenantId}`;
      }
      
      const response = await axios.post(url, entryData, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      // Return created journal entry
      if (response.data && response.data.success) {
        return response.data.data;
      } else {
        return response.data;
      }
    } catch (error) {
      console.error('Error creating journal entry:', error);
      throw error;
    }
  }
  
  /**
   * Update a journal entry
   * @param {string} entryId - ID of the journal entry to update
   * @param {Object} entryData - Updated data for the journal entry
   * @returns {Promise} Promise with the updated journal entry
   */
  async updateJournalEntry(entryId, entryData) {
    try {
      // Get authentication token
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      // Get tenant ID if available
      const tenantStr = localStorage.getItem('tenant');
      const tenantId = tenantStr ? JSON.parse(tenantStr)._id : null;
      
      // Build URL with tenant ID if available
      let url = `/api/journal/${entryId}`;
      if (tenantId) {
        url += `?tenantId=${tenantId}`;
      }
      
      const response = await axios.put(url, entryData, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      // Return updated journal entry
      if (response.data && response.data.success) {
        return response.data.data;
      } else {
        return response.data;
      }
    } catch (error) {
      console.error(`Error updating journal entry ${entryId}:`, error);
      throw error;
    }
  }
  
  /**
   * Delete a journal entry
   * @param {string} entryId - ID of the journal entry to delete
   * @returns {Promise} Promise with the deletion result
   */
  async deleteJournalEntry(entryId) {
    try {
      // Get authentication token
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      // Get tenant ID if available
      const tenantStr = localStorage.getItem('tenant');
      const tenantId = tenantStr ? JSON.parse(tenantStr)._id : null;
      
      // Build URL with tenant ID if available
      let url = `/api/journal/${entryId}`;
      if (tenantId) {
        url += `?tenantId=${tenantId}`;
      }
      
      const response = await axios.delete(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      // Return deletion result
      if (response.data && response.data.success) {
        return response.data;
      } else {
        return response.data;
      }
    } catch (error) {
      console.error(`Error deleting journal entry ${entryId}:`, error);
      throw error;
    }
  }
}

// eslint-disable-next-line import/no-anonymous-default-export
export default new JournalService();