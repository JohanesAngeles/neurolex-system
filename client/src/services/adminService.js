// client/src/services/adminService.js - SIMPLE FIX
import axios from 'axios';

// ✅ FIXED: Remove /api from API_URL since routes already include /admin
const API_URL = process.env.REACT_APP_API_URL || '';

// Create axios instance with common configuration
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add request interceptor to include ADMIN authentication token
api.interceptors.request.use(
  (config) => {
    // Use adminToken instead of regular token
    const adminToken = localStorage.getItem('adminToken');
    if (adminToken) {
      config.headers['Authorization'] = `Bearer ${adminToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor for logging and handling auth errors
api.interceptors.response.use(
  (response) => {
    console.log(`API Success [${response.config.method?.toUpperCase()}] ${response.config.url}:`, response.data);
    return response;
  },
  (error) => {
    console.error('API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    
    // Handle authentication errors
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      // Check if the error is related to admin routes
      if (error.config.url.includes('/admin')) {
        console.log('Admin authentication error, redirecting to admin login');
        // Redirect to admin login
        window.location.href = '/admin/login';
      }
    }
    
    return Promise.reject(error);
  }
);

// Service functions for admin
const adminService = {
  // ===== DASHBOARD METHODS =====
  
  // Get dashboard data
  getDashboardData: async () => {
  try {
    console.log('adminService.getDashboardData called');
    // ✅ FIXED: Use correct endpoint from adminController.js
    const response = await api.get('/admin/dashboard');
    console.log('getDashboardData response:', response.data);
    return response.data;
  } catch (error) {
    console.error('adminService.getDashboardData error:', error);
    // Return mock data for development if API fails
    if (process.env.NODE_ENV === 'development') {
      console.log('Returning mock dashboard data for development');
      return {
        success: true,
        totalUsers: 120,
        totalProfessionals: 15,
        pendingVerifications: 5,
        recentUsers: [
          { _id: '1', name: 'John Doe', email: 'john@example.com', createdAt: new Date().toISOString() },
          { _id: '2', name: 'Jane Smith', email: 'jane@example.com', createdAt: new Date().toISOString() }
        ]
      };
    }
    throw error;
  }
},
  
  // ===== USER MANAGEMENT METHODS =====
  
  // Get all users with filtering, sorting, and pagination
  getUsers: async (params = {}) => {
    try {
      console.log('adminService.getUsers called with params:', params);
      
      // Convert params to query string
      const queryParams = new URLSearchParams();
      
      // Add pagination params
      if (params.page) queryParams.append('page', params.page);
      if (params.limit) queryParams.append('limit', params.limit);
      
      // Add filter params
      if (params.role) queryParams.append('role', params.role);
      if (params.status) queryParams.append('status', params.status);
      if (params.gender) queryParams.append('gender', params.gender);
      if (params.search) queryParams.append('search', params.search);
      
      // Add sorting params
      if (params.sortBy) queryParams.append('sortBy', params.sortBy);
      if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);
      
      const response = await api.get(`/api/users?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  },
  
  // Get user by ID
  getUserById: async (userId) => {
    try {
      console.log(`adminService.getUserById called for ID: ${userId}`);
      const response = await api.get(`/api/users/${userId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching user ${userId}:`, error);
      throw error;
    }
  },
  
  // Create new user
  createUser: async (userData) => {
    try {
      console.log('adminService.createUser called with data:', userData);
      const response = await api.post('/api/users', userData);
      return response.data;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  },
  
  // Update user
  updateUser: async (userId, userData) => {
    try {
      console.log(`adminService.updateUser called for ID: ${userId} with data:`, userData);
      const response = await api.put(`/api/users/${userId}`, userData);
      return response.data;
    } catch (error) {
      console.error(`Error updating user ${userId}:`, error);
      throw error;
    }
  },
  
  // Delete user
  deleteUser: async (userId) => {
    try {
      console.log(`adminService.deleteUser called for ID: ${userId}`);
      const response = await api.delete(`/api/users/${userId}`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting user ${userId}:`, error);
      throw error;
    }
  },
  
  // Update user status (active/banned/suspended)
  updateUserStatus: async (userId, status, reason = '') => {
    try {
      console.log(`adminService.updateUserStatus called for user ${userId} to status ${status}`);
      const response = await api.put(`/admin/users/${userId}/status`, { status, reason });
      console.log('updateUserStatus response:', response.data);
      return response.data;
    } catch (error) {
      console.error('adminService.updateUserStatus error:', error);
      throw error;
    }
  },
  
  // Get user's journal entries
  getUserJournalEntries: async (userId) => {
    try {
      console.log(`adminService.getUserJournalEntries called for user ${userId}`);
      const response = await api.get(`/api/users/${userId}/journal-entries`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching journal entries for user ${userId}:`, error);
      throw error;
    }
  },
  
  // Get user's appointments
  getUserAppointments: async (userId) => {
    try {
      console.log(`adminService.getUserAppointments called for user ${userId}`);
      const response = await api.get(`/api/users/${userId}/appointments`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching appointments for user ${userId}:`, error);
      throw error;
    }
  },
  
  // Assign doctor to patient
  assignDoctorToPatient: async (patientId, doctorId) => {
    try {
      console.log(`adminService.assignDoctorToPatient - Patient: ${patientId}, Doctor: ${doctorId}`);
      const response = await api.post(`/api/users/${patientId}/assign-doctor`, { doctorId });
      return response.data;
    } catch (error) {
      console.error(`Error assigning doctor ${doctorId} to patient ${patientId}:`, error);
      throw error;
    }
  },
  
  // Export users to PDF
  exportUsersToPdf: async (filters = {}) => {
    try {
      console.log('adminService.exportUsersToPdf called with filters:', filters);
      const response = await api.get('/admin/users/export-pdf', {
        params: filters,
        responseType: 'blob'
      });
      
      // Create a blob URL and trigger download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `users-export-${new Date().toISOString().slice(0, 10)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      return { success: true };
    } catch (error) {
      console.error('Error exporting users to PDF:', error);
      throw error;
    }
  },
  
  // ===== PATIENT MANAGEMENT METHODS (NEW) =====
  
  // Get all patients across all tenants
  getAllPatients: async (filters = {}) => {
    try {
      console.log('adminService.getAllPatients called with filters:', filters);
      const response = await api.get('/admin/patients', {
        params: filters
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching patients:', error);
      throw error;
    }
  },
  
  // Get tenants for filtering
  getTenants: async () => {
    try {
      console.log('adminService.getTenants called');
      const response = await api.get('/admin/tenants');
      return response.data;
    } catch (error) {
      console.error('Error fetching tenants:', error);
      throw error;
    }
  },
  
  // Delete a patient 
  deletePatient: async (patientId, tenantId) => {
    try {
      console.log(`adminService.deletePatient called for ID: ${patientId}, Tenant ID: ${tenantId || 'not specified'}`);
      const response = await api.delete(`/admin/patients/${patientId}`, {
        params: { tenantId }
      });
      return response.data;
    } catch (error) {
      console.error('Error deleting patient:', error);
      throw error;
    }
  },
  
  // Export patients to PDF
  exportPatientsToPdf: async (filters = {}) => {
    try {
      console.log('adminService.exportPatientsToPdf called with filters:', filters);
      // Make a request that returns a blob
      const response = await api.get('/admin/patients/export/pdf', {
        params: filters,
        responseType: 'blob' // Important for file downloads
      });
      
      // Create a download link and trigger it
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      // Generate a filename with current date
      const date = new Date().toISOString().slice(0, 10);
      link.setAttribute('download', `patients-report-${date}.pdf`);
      
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      return { success: true };
    } catch (error) {
      console.error('Error exporting patients to PDF:', error);
      throw error;
    }
  },
  
  // ===== DOCTOR VERIFICATION METHODS =====

  // Get professional verifications
  getVerifications: async (page = 1, limit = 10, status = 'pending') => {
    try {
      console.log('adminService.getVerifications called');
      const response = await api.get(`/admin/verifications?page=${page}&limit=${limit}&status=${status}`);
      console.log('getVerifications response:', response.data);
      return response.data;
    } catch (error) {
      console.error('adminService.getVerifications error:', error);
      throw error;
    }
  },
  
  // Approve professional verification
  approveVerification: async (verificationId) => {
    try {
      console.log('adminService.approveVerification called for ID:', verificationId);
      const response = await api.post(`/admin/verifications/${verificationId}/approve`);
      console.log('approveVerification response:', response.data);
      return response.data;
    } catch (error) {
      console.error('adminService.approveVerification error:', error);
      throw error;
    }
  },
  
  // Reject professional verification
  rejectVerification: async (verificationId, reason) => {
    try {
      console.log('adminService.rejectVerification called for ID:', verificationId);
      const response = await api.post(`/admin/verifications/${verificationId}/reject`, { reason });
      console.log('rejectVerification response:', response.data);
      return response.data;
    } catch (error) {
      console.error('adminService.rejectVerification error:', error);
      throw error;
    }
  },
  
  // Get doctor verification stats
  getDoctorVerificationStats: async () => {
  try {
    console.log('adminService.getDoctorVerificationStats called');
    // ✅ FIXED: Use correct endpoint from adminController.js
    const response = await api.get('/admin/doctor-verification-stats');
    console.log('getDoctorVerificationStats response:', response.data);
    return response.data;
  } catch (error) {
    console.error('adminService.getDoctorVerificationStats error:', error);
    throw error;
  }
},

  // Get pending doctors
  getPendingDoctors: async (params = {}) => {
  try {
    console.log('adminService.getPendingDoctors called with params:', params);
    // ✅ FIXED: Use correct endpoint from adminController.js
    const response = await api.get('/admin/doctors/pending', { params });
    console.log('getPendingDoctors response:', response.data);
    return response.data;
  } catch (error) {
    console.error('adminService.getPendingDoctors error:', error);
    throw error;
  }
},

  // Get approved doctors
  getApprovedDoctors: async (params = {}) => {
  try {
    console.log('adminService.getApprovedDoctors called with params:', params);
    // ✅ FIXED: Use correct endpoint from adminController.js
    const response = await api.get('/admin/doctors/approved', { params });
    console.log('getApprovedDoctors response:', response.data);
    return response.data;
  } catch (error) {
    console.error('adminService.getApprovedDoctors error:', error);
    throw error;
  }
},


  // Get rejected doctors
  getRejectedDoctors: async (params = {}) => {
  try {
    console.log('adminService.getRejectedDoctors called with params:', params);
    // ✅ FIXED: Use correct endpoint from adminController.js  
    const response = await api.get('/admin/doctors/rejected', { params });
    console.log('getRejectedDoctors response:', response.data);
    return response.data;
  } catch (error) {
    console.error('adminService.getRejectedDoctors error:', error);
    throw error;
  }
},


  // Get doctor details
  getDoctorDetails: async (doctorId, tenantId = null) => {
  try {
    console.log(`adminService.getDoctorDetails called for ID: ${doctorId}, Tenant ID: ${tenantId || 'not specified'}`);
    
    // Prepare query parameters
    const params = {};
    
    // Only add tenantId if it's provided and not null/undefined/empty
    if (tenantId) {
      params.tenantId = tenantId;
      console.log(`Using specific tenant ID: ${tenantId}`);
    } else {
      console.log('No tenant ID provided, will search across all tenants');
    }
    
    // ✅ FIXED: Use correct endpoint from adminController.js
    const response = await api.get(`/admin/doctors/${doctorId}`, { 
      params 
    });
    
    console.log('getDoctorDetails response:', response.data);
    return response.data;
  } catch (error) {
    console.error('adminService.getDoctorDetails error:', error);
    throw error;
  }
},

  // Verify doctor
  verifyDoctor: async (doctorId, verificationData, tenantId = null) => {
  try {
    console.log(`adminService.verifyDoctor called for ID: ${doctorId}, Tenant ID: ${tenantId || 'not specified'}`);
    console.log('Verification data:', verificationData);
    
    // Prepare query parameters
    const params = {};
    
    if (tenantId) {
      params.tenantId = tenantId;
      console.log(`Using specific tenant ID: ${tenantId}`);
    } else {
      console.log('No tenant ID provided, will search across all tenants');
    }
    
    // ✅ FIXED: Correct URL structure to match adminRoutes.js
    const response = await api.post(
      `/admin/doctors/${doctorId}/verify`, // Changed from /verify/${doctorId}
      verificationData,
      { params }
    );
    
    console.log('verifyDoctor response:', response.data);
    return response.data;
  } catch (error) {
    console.error('adminService.verifyDoctor error:', error);
    throw error;
  }
},

  
  // ===== SYSTEM SETTINGS AND ANALYTICS =====
  
  // Get system metrics (for advanced reports and analytics)
  getSystemMetrics: async (period = 'month') => {
    try {
      console.log('adminService.getSystemMetrics called for period:', period);
      const response = await api.get(`/admin/metrics?period=${period}`);
      console.log('getSystemMetrics response:', response.data);
      return response.data;
    } catch (error) {
      console.error('adminService.getSystemMetrics error:', error);
      throw error;
    }
  },
  
  // Update system settings
  updateSettings: async (settings) => {
    try {
      console.log('adminService.updateSettings called with:', settings);
      const response = await api.put('/admin/settings', settings);
      console.log('updateSettings response:', response.data);
      return response.data;
    } catch (error) {
      console.error('adminService.updateSettings error:', error);
      throw error;
    }
  },
  
  // ===== CONTENT MODERATION =====
  
  // Get content moderation queue
  getModerationQueue: async (page = 1, limit = 10) => {
    try {
      console.log('adminService.getModerationQueue called');
      const response = await api.get(`/admin/moderation?page=${page}&limit=${limit}`);
      console.log('getModerationQueue response:', response.data);
      return response.data;
    } catch (error) {
      console.error('adminService.getModerationQueue error:', error);
      throw error;
    }
  },
  
  // ===== BACKUP AND RESTORATION =====
  
  // Backup system data
  createBackup: async () => {
    try {
      console.log('adminService.createBackup called');
      const response = await api.post('/admin/backup');
      console.log('createBackup response:', response.data);
      return response.data;
    } catch (error) {
      console.error('adminService.createBackup error:', error);
      throw error;
    }
  },
  
  // Get backup history
  getBackupHistory: async () => {
    try {
      console.log('adminService.getBackupHistory called');
      const response = await api.get('/admin/backup/history');
      console.log('getBackupHistory response:', response.data);
      return response.data;
    } catch (error) {
      console.error('adminService.getBackupHistory error:', error);
      throw error;
    }
  },

// Get tenant settings
getTenantSettings: async (tenantId) => {
  try {
    console.log(`adminService.getTenantSettings called for tenant: ${tenantId}`);
    const response = await api.get(`/admin/tenant-settings/${tenantId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching tenant settings:', error);
    throw error;
  }
},

// Update tenant settings (full update)
updateTenantSettings: async (tenantId, settings) => {
  try {
    console.log(`adminService.updateTenantSettings called for tenant: ${tenantId}`);
    const response = await api.put(`/admin/tenant-settings/${tenantId}`, settings);
    return response.data;
  } catch (error) {
    console.error('Error updating tenant settings:', error);
    throw error;
  }
},

// Update individual tenant setting (partial update)
updateIndividualSetting: async (tenantId, settingData) => {
  try {
    console.log(`adminService.updateIndividualSetting called for tenant: ${tenantId}`);
    const response = await api.patch(`/admin/tenant-settings/${tenantId}`, settingData);
    return response.data;
  } catch (error) {
    console.error('Error updating individual setting:', error);
    throw error;
  }
},

// Upload logo/asset
uploadTenantAsset: async (formData) => {
  try {
    console.log('adminService.uploadTenantAsset called');
    
    // Create a new axios instance without Content-Type header for FormData
    const uploadApi = axios.create({
      baseURL: API_URL,
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      }
    });
    
    const response = await uploadApi.post('/admin/upload-logo', formData);
    return response.data;
  } catch (error) {
    console.error('Error uploading tenant asset:', error);
    throw error;
  }
},

};

export default adminService;
