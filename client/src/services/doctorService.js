import axios from 'axios';

// Setup base URL for API requests
// Update this line in your doctorService.js
const API_URL = `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/doctor`;

// Create axios instance with auth token
const doctorApi = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// ✅ CRITICAL FIX: Add auth token AND tenant header to requests
doctorApi.interceptors.request.use(
  (config) => {
    // Add authentication token
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    // ✅ NEW: Add tenant header (this was missing!)
    const tenant = localStorage.getItem('tenant');
    if (tenant) {
      try {
        const tenantData = JSON.parse(tenant);
        if (tenantData && tenantData._id) {
          config.headers['X-Tenant-ID'] = tenantData._id;
          console.log(`🏢 Adding tenant header: ${tenantData._id}`);
        }
      } catch (error) {
        console.error('Error parsing tenant data:', error);
      }
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Define doctorService methods
const doctorService = {
  // ✅ NEW: Add appointment methods for DoctorAppointments.jsx
  
  // Get all appointments for the logged-in doctor
  getAppointments: async () => {
    try {
      console.log('🔍 Fetching appointments via doctorService...');
      const response = await doctorApi.get('/appointments');
      console.log('✅ Appointments fetched successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching appointments:', error);
      throw error;
    }
  },
  
  // Get appointments by status
  getAppointmentsByStatus: async (status) => {
    try {
      console.log(`🔍 Fetching ${status} appointments...`);
      const response = await doctorApi.get(`/appointments/status/${status}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching ${status} appointments:`, error);
      throw error;
    }
  },
  
  // Get pending appointments
  getPendingAppointments: async () => {
    try {
      console.log('🔍 Fetching pending appointments...');
      const response = await doctorApi.get('/appointments/pending');
      return response.data;
    } catch (error) {
      console.error('Error fetching pending appointments:', error);
      throw error;
    }
  },
  
  // Accept appointment
  acceptAppointment: async (appointmentId, responseMessage = '') => {
  try {
    console.log(`✅ Accepting appointment: ${appointmentId}`);
    console.log(`🌐 Full URL will be: ${API_URL}/accept/${appointmentId}`);
    
    const response = await doctorApi.put(`/accept/${appointmentId}`, {
      responseMessage
    });
    return response.data;
  } catch (error) {
    console.error('Error accepting appointment:', error);
    throw error;
  }
},
  
  // Decline appointment
  declineAppointment: async (appointmentId, responseMessage = '') => {
  try {
    console.log(`❌ Declining appointment: ${appointmentId}`);
    console.log(`🌐 Full URL will be: ${API_URL}/decline/${appointmentId}`);
    
    const response = await doctorApi.put(`/decline/${appointmentId}`, {
      responseMessage
    });
    return response.data;
  } catch (error) {
    console.error('Error declining appointment:', error);
    throw error;
  }
},
  
  // Update appointment status
  updateAppointmentStatus: async (appointmentId, status) => {
    try {
      console.log(`🔄 Updating appointment ${appointmentId} status to: ${status}`);
      const response = await doctorApi.put(`/appointments/${appointmentId}/status`, {
        status
      });
      return response.data;
    } catch (error) {
      console.error('Error updating appointment status:', error);
      throw error;
    }
  },
  
  // Reschedule appointment
  rescheduleAppointment: async (appointmentId, appointmentDate) => {
    try {
      console.log(`📅 Rescheduling appointment ${appointmentId} to: ${appointmentDate}`);
      const response = await doctorApi.put(`/appointments/${appointmentId}/reschedule`, {
        appointmentDate
      });
      return response.data;
    } catch (error) {
      console.error('Error rescheduling appointment:', error);
      throw error;
    }
  },

  // Dashboard statistics
  getDashboardStats: async () => {
    try {
      const response = await doctorApi.get('/dashboard/stats');
      return response.data;
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
  },
  
  // Form Templates
  getTemplates: async () => {
    try {
      const response = await doctorApi.get('/templates');
      return response.data;
    } catch (error) {
      console.error('Error fetching templates:', error);
      throw error;
    }
  },
  
  getTemplate: async (id) => {
    try {
      const response = await doctorApi.get(`/templates/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching template ${id}:`, error);
      throw error;
    }
  },
  
  createTemplate: async (templateData) => {
  try {
    console.log('Creating template with data:', templateData);
    
    // Try to get the user info from localStorage
    let userId = null;
    
    // First try to get user object from localStorage
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        userId = user._id || user.id;
        console.log('Found user ID in localStorage:', userId);
      } catch (e) {
        console.error('Error parsing user data from localStorage:', e);
      }
    }
    
    // If we still don't have a userId, try to decode it from the token
    if (!userId) {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          // Split the token and get the payload
          const parts = token.split('.');
          if (parts.length === 3) {
            // Decode the payload
            const payload = JSON.parse(atob(parts[1]));
            userId = payload.id || payload._id;
            console.log('Extracted user ID from token:', userId);
          }
        } catch (e) {
          console.error('Error extracting user ID from token:', e);
        }
      }
    }
    
    // Include the user ID in the template data
    const dataWithCreator = {
      ...templateData,
      createdBy: userId
    };
    
    console.log('Sending template with createdBy:', dataWithCreator);
    
    // Make the API request
    const response = await doctorApi.post('/templates', dataWithCreator);
    
    console.log('Template created successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error creating template:', error);
    
    if (error.response) {
      console.error('Server response:', error.response.data);
      throw new Error(`Server error: ${error.response.data.message || 'Error creating template'}`);
    } else {
      throw new Error(`Failed to save template: ${error.message}`);
    }
  }
},
  
  updateTemplate: async (id, templateData) => {
    try {
      const response = await doctorApi.put(`/templates/${id}`, templateData);
      return response.data;
    } catch (error) {
      console.error(`Error updating template ${id}:`, error);
      throw error;
    }
  },
  
  deleteTemplate: async (id) => {
    try {
      const response = await doctorApi.delete(`/templates/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting template ${id}:`, error);
      throw error;
    }
  },
  
  assignTemplate: async (id, assignmentData) => {
    try {
      const response = await doctorApi.post(`/templates/${id}/assign`, assignmentData);
      return response.data;
    } catch (error) {
      console.error(`Error assigning template ${id}:`, error);
      throw error;
    }
  },
  
  // Journal Entries
  getJournalEntries: async (filters = {}) => {
  try {
    console.log('🩺 DOCTOR SERVICE: Starting journal entries fetch...');
    console.log('🔍 Filters:', filters);
    
    // Get authentication token
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('❌ No authentication token found');
      throw new Error('Authentication required');
    }
    console.log('✅ Token found:', token.substring(0, 20) + '...');
    
    // Get tenant info
    const tenantStr = localStorage.getItem('tenant');
    let tenantId = null;
    if (tenantStr) {
      const tenant = JSON.parse(tenantStr);
      tenantId = tenant._id;
      console.log('🏢 Tenant info:', {
        id: tenantId,
        name: tenant.name || 'Unknown'
      });
    } else {
      console.log('⚠️ No tenant found in localStorage');
    }
    
    // Build query parameters
    const params = new URLSearchParams();
    
    // Add filters to params
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== 'all') {
        params.append(key, value);
        console.log(`📋 Added filter: ${key} = ${value}`);
      }
    });
    
    // 🔥 CRITICAL FIX: Use the correct API URL structure
    // Don't use the doctorApi instance, use direct axios call
    const baseURL = process.env.REACT_APP_API_URL || 'https://neurolex-platform-9b4c40c0e2da.herokuapp.com/api';
    const url = `${baseURL}/journal/doctor?${params.toString()}`;
    console.log('🌐 Final URL:', url);
    
    // Set up headers
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    // Add tenant ID to headers (multiple formats for compatibility)
    if (tenantId) {
      headers['x-tenant-id'] = tenantId;
      headers['X-Tenant-ID'] = tenantId;  // Try both cases
      console.log('🏢 Added tenant headers');
    }
    
    console.log('📡 Request headers:', headers);
    
    // 🔥 CRITICAL FIX: Use axios directly instead of doctorApi
    const response = await axios.get(url, { 
      headers,
      timeout: 15000  // 15 second timeout
    });
    
    console.log('📊 Response status:', response.status);
    console.log('📊 Response data:', response.data);
    
    // Check response structure
    if (response.data && response.data.success) {
      const entries = response.data.data || [];
      console.log(`✅ SUCCESS: Fetched ${entries.length} journal entries`);
      
      return {
        success: true,
        data: entries,
        pagination: response.data.pagination || { total: entries.length }
      };
    } else if (Array.isArray(response.data)) {
      console.log(`✅ SUCCESS: Fetched ${response.data.length} journal entries (array format)`);
      return {
        success: true,
        data: response.data,
        pagination: { total: response.data.length }
      };
    } else {
      console.warn('⚠️ Unexpected response format:', response.data);
      return {
        success: false,
        data: [],
        pagination: { total: 0 },
        message: 'Unexpected response format'
      };
    }
    
  } catch (error) {
    console.error('❌ DOCTOR SERVICE ERROR:', error.message);
    
    if (error.response) {
      console.error('❌ Server responded with:');
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
      console.error('   URL:', error.config?.url);
    } else if (error.request) {
      console.error('❌ No response received:');
      console.error('   Request URL:', error.config?.url);
    } else {
      console.error('❌ Request setup error:', error.message);
    }
    
    // Return empty result to prevent UI crash
    return {
      success: false,
      data: [],
      pagination: { total: 0 },
      error: error.message,
      details: error.response?.data
    };
  }
},
  
  getJournalEntry: async (id) => {
    try {
      const response = await doctorApi.get(`/journal-entries/${id}`);
      
      // Ensure we handle the nested data structure correctly
      return response.data.success && response.data.data 
        ? response.data.data 
        : response.data;
    } catch (error) {
      console.error(`Error fetching journal entry ${id}:`, error);
      throw error;
    }
  },

  // Get doctor profile
getProfile: async () => {
  try {
    console.log('🔍 Fetching doctor profile...');
    const response = await doctorApi.get('/profile');
    console.log('✅ Doctor profile fetched:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error fetching doctor profile:', error);
    throw error;
  }
},

// Update doctor profile
updateProfile: async (profileData) => {
  try {
    console.log('🔄 Updating doctor profile...');
    const response = await doctorApi.put('/profile', profileData);
    console.log('✅ Doctor profile updated:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error updating doctor profile:', error);
    throw error;
  }
},
  
  // Enhanced version of analyzeJournalEntry with better error handling and debugging
  // Modify your analyzeJournalEntry method in doctorService.js
analyzeJournalEntry: async (id, analysis = {}) => {
  try {
    console.log(`Starting enhanced AI analysis for journal entry ${id}`);
    console.log('Analysis data:', analysis);
    
    // Add timestamp to help with debugging
    const requestData = {
      ...analysis,
      timestamp: new Date().toISOString()
    };
    
    try {
      // Make the API request with proper configuration
      const response = await doctorApi.post(`/journal-entries/${id}/analyze`, requestData, {
        timeout: 30000 // 30 second timeout for AI processing
      });
      
      console.log('AI analysis response received:', response.data);
      
      return response.data.success && response.data.data 
        ? response.data 
        : response.data;
    } catch (error) {
      // If we get a 404, try with the direct URL including http://localhost:5000
      if (error.response && error.response.status === 404) {
        console.log('Endpoint not found, trying direct URL...');
        const token = localStorage.getItem('token');
        
        if (!token) {
          throw new Error('Authentication token not found');
        }
        
        // Try with explicit URL to port 5000
        const directResponse = await axios.post(
          `http://localhost:5000/api/doctor/journal-entries/${id}/analyze`,
          requestData,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            timeout: 30000
          }
        );
        
        return directResponse.data;
      }
      
      throw error;
    }
  } catch (error) {
    console.error(`Error analyzing journal entry ${id}:`, error);
    
    // Provide more detailed error information
    if (error.response) {
      console.error('Server responded with:', {
        status: error.response.status,
        data: error.response.data
      });
    } else if (error.request) {
      console.error('No response received. Request details:', {
        method: 'POST',
        url: `/journal-entries/${id}/analyze`,
        timeout: error.request.timeout || 'default'
      });
    }
    
    // If in development mode, provide mock data
    if (process.env.NODE_ENV === 'development') {
      console.log('Using mock data in development mode');
      return {
        success: true,
        aiAnalysis: {
          sentiment: { type: 'neutral', score: 65 },
          emotions: [
            { name: 'calm', score: 0.7 },
            { name: 'thoughtful', score: 0.5 },
            { name: 'neutral', score: 0.3 }
          ]
        },
        message: 'Mock analysis data (API call failed)'
      };
    }
    
    throw error;
  }
},
  
  // Direct API version - alternative implementation that bypasses the interceptors
  // Can be useful for debugging API issues
  analyzeJournalEntryDirect: async (id, analysisData) => {
    try {
      console.log(`Starting direct API analysis for journal entry ${id}`);
      
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      // Direct axios call instead of using the doctorApi instance
      const response = await axios.post(
        `${API_URL}/journal-entries/${id}/analyze`,
        analysisData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          timeout: 30000
        }
      );
      
      console.log('Direct API analysis response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Direct API analysis error:', error);
      throw error;
    }
  },
  
  // PDF Export function for journal entries
  exportJournalEntriesToPDF: async (filters = {}) => {
    try {
      console.log('Starting PDF export with filters:', filters);
      
      // Convert filters to query string
      const params = new URLSearchParams();
      
      if (filters.patient) params.append('patient', filters.patient);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      if (filters.sentiment) params.append('sentiment', filters.sentiment);
      if (filters.mood) params.append('mood', filters.mood);
      if (filters.analyzed !== 'all') params.append('analyzed', filters.analyzed);
      
      // Make request with responseType blob to handle PDF binary data
      try {
        const response = await doctorApi.get(`/journal-entries/export/pdf?${params.toString()}`, {
          responseType: 'blob',
          headers: {
            'Accept': 'application/pdf'
          }
        });
        
        return response;
      } catch (apiError) {
        console.warn('PDF export endpoint error:', apiError);
        throw new Error('PDF endpoint not available');
      }
    } catch (error) {
      console.error('Error exporting journal entries to PDF:', error);
      
      // If the API endpoint doesn't exist or returns an error, 
      // generate a simple HTML file that can be printed to PDF
      try {
        console.log('Using print-friendly HTML export as fallback');
        
        // Fetch entries
        const entriesParams = new URLSearchParams();
        if (filters.patient) entriesParams.append('patient', filters.patient);
        if (filters.dateFrom) entriesParams.append('dateFrom', filters.dateFrom);
        if (filters.dateTo) entriesParams.append('dateTo', filters.dateTo);
        if (filters.sentiment) entriesParams.append('sentiment', filters.sentiment);
        if (filters.mood) entriesParams.append('mood', filters.mood);
        if (filters.analyzed !== 'all') entriesParams.append('analyzed', filters.analyzed);
        
        const entriesResponse = await doctorApi.get(`/journal-entries?${entriesParams.toString()}`);
        const entries = entriesResponse.data.data || entriesResponse.data || [];
        
        // Create HTML content
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Neurolex - Patient Journal Entries</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              h1 { color: #3a7355; text-align: center; }
              .info { text-align: center; margin-bottom: 20px; color: #666; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th { background-color: #f2f2f2; padding: 8px; text-align: left; border-bottom: 2px solid #ddd; }
              td { padding: 8px; border-bottom: 1px solid #ddd; }
              .print-button { display: block; margin: 20px auto; padding: 10px 20px; background-color: #3a7355; 
                             color: white; border: none; border-radius: 4px; cursor: pointer; }
              @media print {
                .print-button { display: none; }
                body { margin: 0; }
              }
            </style>
          </head>
          <body>
            <h1>Neurolex - Patient Journal Entries</h1>
            <div class="info">Generated on: ${new Date().toLocaleDateString()}</div>
            
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Patient</th>
                  <th>Entry Title</th>
                  <th>Mood</th>
                  <th>Sentiment</th>
                </tr>
              </thead>
              <tbody>
                ${entries.map(entry => `
                  <tr>
                    <td>${new Date(entry.date).toLocaleDateString()}</td>
                    <td>${entry.patientName || 'Unknown'}</td>
                    <td>${entry.title || entry.templateName || 'Journal Entry'}</td>
                    <td>${entry.mood?.label || '-'}</td>
                    <td>${entry.sentiment?.type ? 
                      entry.sentiment.type.charAt(0).toUpperCase() + entry.sentiment.type.slice(1) : 
                      'Not analyzed'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <button class="print-button" onclick="window.print()">Print to PDF</button>
            
            <script>
              // Auto-print on load if in print mode
              if (window.location.search.includes('autoprint=true')) {
                window.print();
              }
            </script>
          </body>
          </html>
        `;
        
        // Create a blob from the HTML content
        const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
        
        // Return a response-like object
        return { 
          data: htmlBlob,
          status: 200,
          statusText: 'OK (HTML Export)',
          headers: { 'content-type': 'text/html' },
          isHtml: true  // Flag to indicate this is HTML, not PDF
        };
      } catch (htmlError) {
        console.error('Error generating HTML export:', htmlError);
        throw htmlError;
      }
    }
  },
  
  addNoteToJournalEntry: async (id, note) => {
    try {
      const response = await doctorApi.post(`/journal-entries/${id}/notes`, { note });
      return response.data;
    } catch (error) {
      console.error(`Error adding note to journal entry ${id}:`, error);
      throw error;
    }
  },
  
  deleteJournalEntry: async (id) => {
    try {
      const response = await doctorApi.delete(`/journal-entries/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting journal entry ${id}:`, error);
      throw error;
    }
  },
  
  // Patients
  getPatients: async () => {
    try {
      const response = await doctorApi.get('/patients');
      return response.data;
    } catch (error) {
      console.error('Error fetching patients:', error);
      throw error;
    }
  },
  
  getPatient: async (id) => {
    try {
      const response = await doctorApi.get(`/patients/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching patient ${id}:`, error);
      throw error;
    }
  },
  
  getPatientJournals: async (patientId) => {
  try {
    console.log(`🔍 Fetching journals for patient: ${patientId}`);
    
    // Get authentication token
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Authentication required');
    }
    
    // Get tenant info
    const tenantStr = localStorage.getItem('tenant');
    let tenantId = null;
    if (tenantStr) {
      const tenant = JSON.parse(tenantStr);
      tenantId = tenant._id;
    }
    
    // Build query parameters to filter by patient
    const params = new URLSearchParams();
    params.append('patient', patientId); // Filter by specific patient
    
    // Use the existing journal endpoint with patient filter
    const baseURL = process.env.REACT_APP_API_URL || 'https://neurolex-platform-9b4c40c0e2da.herokuapp.com/api';
    const url = `${baseURL}/journal/doctor?${params.toString()}`;
    
    console.log('🌐 API URL:', url);
    
    // Set up headers
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    // Add tenant ID to headers
    if (tenantId) {
      headers['x-tenant-id'] = tenantId;
      headers['X-Tenant-ID'] = tenantId;
    }
    
    // Make the API request using axios directly
    const response = await axios.get(url, { 
      headers,
      timeout: 15000
    });
    
    console.log('✅ Patient journals response:', response.data);
    
    // Handle the response structure
    if (response.data && response.data.success) {
      const entries = response.data.data || [];
      console.log(`✅ Found ${entries.length} journal entries for patient ${patientId}`);
      
      return {
        success: true,
        data: entries,
        pagination: response.data.pagination || { total: entries.length }
      };
    } else if (Array.isArray(response.data)) {
      console.log(`✅ Found ${response.data.length} journal entries (array format)`);
      return {
        success: true,
        data: response.data,
        pagination: { total: response.data.length }
      };
    } else {
      console.warn('⚠️ Unexpected response format:', response.data);
      return {
        success: false,
        data: [],
        pagination: { total: 0 }
      };
    }
    
  } catch (error) {
    console.error(`❌ Error fetching journals for patient ${patientId}:`, error);
    
    if (error.response) {
      console.error('❌ Server error details:');
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
      console.error('   URL:', error.config?.url);
    }
    
    // Return empty result instead of throwing to prevent UI crash
    return {
      success: false,
      data: [],
      pagination: { total: 0 },
      error: error.message
    };
  }
},


  getIndividualPatientMoodAnalytics: async (patientId, days = 7) => {
    try {
      console.log(`🔍 Fetching INDIVIDUAL mood analytics for specific patient: ${patientId} (${days} days)`);
      
      // Get authentication token and tenant info
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }
      
      const tenantStr = localStorage.getItem('tenant');
      let tenantId = null;
      if (tenantStr) {
        const tenant = JSON.parse(tenantStr);
        tenantId = tenant._id;
      }
      
      // Use the EXISTING mood user endpoint to get raw mood data
      const baseURL = process.env.REACT_APP_API_URL || 'https://neurolex-platform-9b4c40c0e2da.herokuapp.com/api';
      const url = `${baseURL}/mood/user/${patientId}?days=${days}`;
      
      console.log('🌐 Individual Patient Mood API URL:', url);
      
      // Set up headers
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
      
      // Add tenant ID to headers
      if (tenantId) {
        headers['x-tenant-id'] = tenantId;
        headers['X-Tenant-ID'] = tenantId;
      }
      
      // Make the API request using axios directly
      const response = await axios.get(url, { 
        headers,
        timeout: 15000
      });
      
      console.log('✅ Individual patient mood response:', response.data);
      
      // Process the raw mood data into analytics format
      let moodEntries = [];
      
      if (response.data && response.data.success && Array.isArray(response.data.data)) {
        moodEntries = response.data.data;
      } else if (Array.isArray(response.data)) {
        moodEntries = response.data;
      }
      
      console.log('📊 Processing mood entries:', moodEntries.length, 'entries found');
      
      // INLINE PROCESSING FUNCTION - moved inside to fix the scope issue
      const processMoodDataToAnalytics = (moodEntries, days) => {
        if (!Array.isArray(moodEntries) || moodEntries.length === 0) {
          return {
            keyMetrics: {
              totalLogs: 0,
              averageLogsPerDay: 0,
              averageMoodScore: 0,
              topEmotionalTrends: []
            },
            dailyOverview: [],
            moodDistribution: {},
            moodHistory: []
          };
        }

        // Calculate key metrics
        const totalLogs = moodEntries.length;
        const averageLogsPerDay = (totalLogs / days).toFixed(1);
        const averageRating = moodEntries.reduce((sum, entry) => sum + (entry.moodRating || 0), 0) / totalLogs;
        const averageMoodScore = averageRating.toFixed(1);

        // Calculate mood distribution
        const moodCounts = {};
        moodEntries.forEach(entry => {
          const moodKey = entry.moodKey || 'unknown';
          moodCounts[moodKey] = (moodCounts[moodKey] || 0) + 1;
        });

        const moodDistribution = {};
        Object.entries(moodCounts).forEach(([mood, count]) => {
          moodDistribution[mood] = {
            count,
            percentage: ((count / totalLogs) * 100).toFixed(1)
          };
        });

        // Find most frequent mood
        const topMood = Object.entries(moodCounts).reduce((a, b) => 
          moodCounts[a[0]] > moodCounts[b[0]] ? a : b
        );

        const topEmotionalTrends = topMood ? [{
          mood: topMood[0].charAt(0).toUpperCase() + topMood[0].slice(1),
          count: topMood[1]
        }] : [];

        // Create daily overview
        const dailyOverview = [];
        for (let i = days - 1; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          
          const dayEntries = moodEntries.filter(entry => {
            const entryDate = new Date(entry.timestamp).toISOString().split('T')[0];
            return entryDate === dateStr;
          });

          if (dayEntries.length > 0) {
            const avgRating = dayEntries.reduce((sum, entry) => sum + (entry.moodRating || 0), 0) / dayEntries.length;
            const mostFrequentMood = dayEntries.reduce((prev, current) => 
              dayEntries.filter(e => e.moodKey === current.moodKey).length > 
              dayEntries.filter(e => e.moodKey === prev.moodKey).length ? current : prev
            ).moodKey;

            dailyOverview.push({
              date: dateStr,
              dateFormatted: date.getDate().toString(),
              totalEntries: dayEntries.length,
              averageMoodScore: avgRating.toFixed(1),
              mostFrequentMood: mostFrequentMood
            });
          }
        }

        return {
          keyMetrics: {
            totalLogs,
            averageLogsPerDay: parseFloat(averageLogsPerDay),
            averageMoodScore: parseFloat(averageMoodScore),
            topEmotionalTrends
          },
          dailyOverview,
          moodDistribution,
          moodHistory: moodEntries.slice(0, 20) // Latest 20 entries
        };
      };
      
      // Transform raw mood data into analytics format
      const analyticsData = processMoodDataToAnalytics(moodEntries, days);
      
      console.log('📈 Analytics data generated:', analyticsData);
      
      return {
        success: true,
        data: analyticsData
      };
      
    } catch (error) {
      console.error(`❌ Error fetching individual mood analytics for patient ${patientId}:`, error);
      
      if (error.response) {
        console.error('❌ Server error details:');
        console.error('   Status:', error.response.status);
        console.error('   Data:', error.response.data);
        console.error('   URL:', error.config?.url);
      }
      
      // Return empty result instead of throwing to prevent UI crash
      return {
        success: false,
        data: null,
        error: error.message
      };
    }
  },

  getIndividualPatientJournals: async (patientId, filters = {}) => {
    try {
      console.log(`🔍 Fetching INDIVIDUAL journals for specific patient: ${patientId}`);
      
      // Get authentication token and tenant info
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }
      
      const tenantStr = localStorage.getItem('tenant');
      let tenantId = null;
      if (tenantStr) {
        const tenant = JSON.parse(tenantStr);
        tenantId = tenant._id;
      }
      
      // Build query parameters
      const params = new URLSearchParams();
      params.append('userId', patientId); // Use userId parameter for individual patient
      
      // Add any additional filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') {
          params.append(key, value);
        }
      });
      
      // Use the journal user endpoint directly
      const baseURL = process.env.REACT_APP_API_URL || 'https://neurolex-platform-9b4c40c0e2da.herokuapp.com/api';
      const url = `${baseURL}/journal/users/${patientId}/journal-entries?${params.toString()}`;
      
      console.log('🌐 Individual Patient Journals API URL:', url);
      
      // Set up headers
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
      
      // Add tenant ID to headers
      if (tenantId) {
        headers['x-tenant-id'] = tenantId;
        headers['X-Tenant-ID'] = tenantId;
      }
      
      // Make the API request using axios directly
      const response = await axios.get(url, { 
        headers,
        timeout: 15000
      });
      
      console.log('✅ Individual patient journals response:', response.data);
      console.log('🔍 Response structure check:', {
        hasSuccess: !!response.data?.success,
        hasData: !!response.data?.data,
        dataType: Array.isArray(response.data?.data) ? 'array' : typeof response.data?.data,
        dataLength: Array.isArray(response.data?.data) ? response.data.data.length : 'not array',
        responseKeys: Object.keys(response.data || {}),
        actualData: response.data?.data
      });
      
      // Handle the response structure
      if (response.data && response.data.success && Array.isArray(response.data.data)) {
        console.log(`✅ Found ${response.data.data.length} journal entries for patient ${patientId}`);
        return {
          success: true,
          data: response.data.data,
          pagination: response.data.pagination || { total: response.data.data.length }
        };
      } else if (Array.isArray(response.data)) {
        console.log(`✅ Found ${response.data.length} journal entries (array format)`);
        return {
          success: true,
          data: response.data,
          pagination: { total: response.data.length }
        };
      } else {
        console.warn('⚠️ Unexpected response format - checking if data exists but in different structure:', response.data);
        
        // Try to extract data from different possible structures
        let extractedData = [];
        if (response.data?.data && !Array.isArray(response.data.data)) {
          // Maybe data is an object with entries property
          if (response.data.data.entries) {
            extractedData = response.data.data.entries;
          } else if (response.data.data.journals) {
            extractedData = response.data.data.journals;
          }
        }
        
        if (extractedData.length > 0) {
          console.log(`✅ Found ${extractedData.length} journal entries in nested structure`);
          return {
            success: true,
            data: extractedData,
            pagination: { total: extractedData.length }
          };
        }
        
        // If no data found, return empty
        console.log('📝 No journal entries found for this patient');
        return {
          success: true,
          data: [],
          pagination: { total: 0 }
        };
      }
      
    } catch (error) {
      console.error(`❌ Error fetching individual journals for patient ${patientId}:`, error);
      
      if (error.response) {
        console.error('❌ Server error details:');
        console.error('   Status:', error.response.status);
        console.error('   Data:', error.response.data);
        console.error('   URL:', error.config?.url);
      }
      
      // Return empty result instead of throwing to prevent UI crash
      return {
        success: false,
        data: [],
        pagination: { total: 0 },
        error: error.message
      };
    }
  },

   endPatientCare: async (patientId) => {
    try {
      console.log('🔴 DoctorService: Ending care for patient:', patientId);
      console.log('🔍 Full URL being called:', `${API_URL}/patients/${patientId}/end-care`); // ADD THIS LINE

      const response = await doctorApi.delete(`/patients/${patientId}/end-care`);
      
      console.log('✅ Care ended successfully:', response.data);
      return response.data;
      
    } catch (error) {
      console.error('❌ Error ending patient care:', error);
      
      // Provide better error messages
      if (error.response) {
        const errorMessage = error.response.data?.message || `HTTP error! status: ${error.response.status}`;
        throw new Error(errorMessage);
      }
      
      throw error;
    }
  },
  
  // Patient Groups
  getPatientGroups: async () => {
    try {
      const response = await doctorApi.get('/patient-groups');
      return response.data;
    } catch (error) {
      console.error('Error fetching patient groups:', error);
      throw error;
    }
  },
  
  createPatientGroup: async (groupData) => {
    try {
      const response = await doctorApi.post('/patient-groups', groupData);
      return response.data;
    } catch (error) {
      console.error('Error creating patient group:', error);
      throw error;
    }
  },
  
  // Utility method to check API health/connectivity
  checkApiHealth: async () => {
    try {
      const response = await axios.get(`${API_URL.replace('/doctor', '')}/health`, {
        timeout: 5000
      });
      return {
        status: response.status,
        data: response.data,
        healthy: response.status === 200
      };
    } catch (error) {
      console.error('API health check failed:', error);
      return {
        status: error.response?.status || 0,
        error: error.message,
        healthy: false
      };
    }
  }
};

export default doctorService;