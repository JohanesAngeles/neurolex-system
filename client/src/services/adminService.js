// client/src/services/adminService.js - UPDATED WITH TENANT MANAGEMENT
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
  
  // Get tenants for filtering (keeping original method for compatibility)
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

  getPatientById: async (patientId, tenantId = null) => {
  try {
    console.log(`adminService.getPatientById called for ID: ${patientId}, Tenant ID: ${tenantId || 'not specified'}`);
    
    // Prepare query parameters
    const params = {};
    
    // Only add tenantId if it's provided and not null/undefined/empty
    if (tenantId) {
      params.tenantId = tenantId;
      console.log(`Using specific tenant ID: ${tenantId}`);
    } else {
      console.log('No tenant ID provided, will search across all tenants');
    }
    
    const response = await api.get(`/admin/patients/${patientId}`, { 
      params 
    });
    
    console.log('getPatientById response:', response.data);
    return response.data;
  } catch (error) {
    console.error('adminService.getPatientById error:', error);
    throw error;
  }
},

updatePatient: async (patientId, patientData, tenantId = null) => {
  try {
    console.log(`adminService.updatePatient called for ID: ${patientId}, Tenant ID: ${tenantId || 'not specified'}`);
    
    // Prepare query parameters
    const params = {};
    if (tenantId) {
      params.tenantId = tenantId;
    }
    
    const response = await api.put(`/admin/patients/${patientId}`, patientData, { 
      params 
    });
    
    console.log('updatePatient response:', response.data);
    return response.data;
  } catch (error) {
    console.error('adminService.updatePatient error:', error);
    throw error;
  }
},

  // ===== 🆕 TENANT MANAGEMENT METHODS =====
  
  // Get all tenants with filtering, sorting, and pagination
  getTenants: async (params = {}) => {
  try {
    console.log('adminService.getTenants called with params:', params);
    
    // Convert params to query string
    const queryParams = new URLSearchParams();
    
    // Add pagination params
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    
    // Add filter params
    if (params.search) queryParams.append('search', params.search);
    if (params.status && params.status !== 'all') queryParams.append('status', params.status);
    if (params.location && params.location !== 'all') queryParams.append('location', params.location);
    
    // Add sorting params
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);
    
    // 🔧 FIX: Use /admin/tenants instead of /api/tenants
    const response = await api.get(`/admin/tenants?${queryParams.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching tenants:', error);
    throw error;
  }
},

  
  // Get tenant by ID
  getTenantById: async (tenantId) => {
  try {
    console.log(`adminService.getTenantById called for ID: ${tenantId}`);
    // 🔧 FIX: Use /admin/tenants
    const response = await api.get(`/admin/tenants/${tenantId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching tenant ${tenantId}:`, error);
    throw error;
  }
},
  
  // Create new tenant
  createTenant: async (tenantData) => {
  try {
    console.log('adminService.createTenant called with data:', tenantData);
    
    // Transform the frontend form data to match backend expectations
    const apiData = {
      name: tenantData.name,
      adminEmail: tenantData.primaryEmail,
      location: tenantData.location,
      // Auto-generate database name from clinic name
      dbName: tenantData.name.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '') // Remove special characters
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .substring(0, 20), // Limit length
    };
    
    // 🔧 FIX: Use /admin/tenants
    const response = await api.post('/admin/tenants', apiData);
    return response.data;
  } catch (error) {
    console.error('Error creating tenant:', error);
    throw error;
  }
},
  
  // Update tenant
 updateTenant: async (tenantId, tenantData) => {
  try {
    console.log(`adminService.updateTenant called for ID: ${tenantId} with data:`, tenantData);
    
    // Transform the frontend form data to match backend expectations
    const apiData = {
      name: tenantData.name,
      adminEmail: tenantData.primaryEmail,
      location: tenantData.location,
    };
    
    // 🔧 FIX: Use /admin/tenants
    const response = await api.put(`/admin/tenants/${tenantId}`, apiData);
    return response.data;
  } catch (error) {
    console.error(`Error updating tenant ${tenantId}:`, error);
    throw error;
  }
},
  
  // Update tenant status (activate/deactivate)
  updateTenantStatus: async (tenantId, statusData) => {
  try {
    console.log(`adminService.updateTenantStatus called for tenant ${tenantId}:`, statusData);
    // 🔧 FIX: Use /admin/tenants
    const response = await api.patch(`/admin/tenants/${tenantId}/status`, statusData);
    return response.data;
  } catch (error) {
    console.error(`Error updating tenant ${tenantId} status:`, error);
    throw error;
  }
},
  
  // Delete tenant
  deleteTenant: async (tenantId) => {
  try {
    console.log(`adminService.deleteTenant called for ID: ${tenantId}`);
    // 🔧 FIX: Use /admin/tenants
    const response = await api.delete(`/admin/tenants/${tenantId}`);
    return response.data;
  } catch (error) {
    console.error(`Error deleting tenant ${tenantId}:`, error);
    throw error;
  }
},
  
  // Export tenants to PDF
  exportTenantsToPdf: async (filters = {}) => {
  try {
    console.log('adminService.exportTenantsToPdf called with filters:', filters);
    
    // 🔧 FIX: Use /admin/tenants
    const response = await api.get('/admin/tenants/export/pdf', {
      params: filters,
      responseType: 'blob'
    });
    
    // Create a download link and trigger it
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    
    // Generate filename with current date
    const date = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `tenants-report-${date}.pdf`);
    
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    return { success: true };
  } catch (error) {
    console.error('Error exporting tenants to PDF:', error);
    throw error;
  }
},
  
  // Get tenant statistics (doctor count, patient count)
  getTenantStats: async (tenantId) => {
  try {
    console.log(`adminService.getTenantStats called for tenant: ${tenantId}`);
    // 🔧 FIX: Use /admin/tenants
    const response = await api.get(`/admin/tenants/${tenantId}/stats`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching tenant ${tenantId} stats:`, error);
    throw error;
  }
},
  
  // Get tenant database status
  getTenantDatabaseStatus: async (tenantId) => {
    try {
      console.log(`adminService.getTenantDatabaseStatus called for tenant: ${tenantId}`);
      const response = await api.get(`/api/tenants/${tenantId}/database`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching tenant ${tenantId} database status:`, error);
      throw error;
    }
  },
  
  // Create tenant database
  createTenantDatabase: async (tenantId) => {
    try {
      console.log(`adminService.createTenantDatabase called for tenant: ${tenantId}`);
      const response = await api.post(`/api/tenants/${tenantId}/database`);
      return response.data;
    } catch (error) {
      console.error(`Error creating database for tenant ${tenantId}:`, error);
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
    // ✅ FIXED: Use /admin (will become /api/admin with base URL)
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
    // ✅ FIXED: Use /admin (will become /api/admin with base URL)
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
    // ✅ FIXED: Use /admin (will become /api/admin with base URL)
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
    // ✅ FIXED: Use /admin (will become /api/admin with base URL)
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
    
    // ✅ FIXED: Use /admin (will become /api/admin with base URL)
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
    
    // ✅ FIXED: Use /admin (will become /api/admin with base URL)
    const response = await api.post(
      `/admin/doctors/${doctorId}/verify`,
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

addDoctor: async (doctorData) => {
  try {
    console.log('adminService.addDoctor called with data:', doctorData);
    
    // Ensure the doctor is marked as admin-added and auto-approved
    const submissionData = {
  ...doctorData,
  role: 'doctor',
  verificationStatus: 'approved',
  verificationDate: new Date().toISOString(),
  isAdminAdded: true,
  verificationNotes: [{
    note: doctorData.verificationNotes || 'Added by admin - automatically approved',
    addedBy: 'admin',
    addedAt: new Date().toISOString()
  }]
};
    
    console.log('Submitting admin doctor data:', submissionData);
    
    // Use the admin endpoint for adding doctors
    const response = await api.post('/admin/doctors', submissionData);
    
    console.log('✅ Admin addDoctor response:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error adding doctor via admin:', error);
    throw error;
  }
},

// Update doctor (admin function)
updateDoctor: async (doctorId, doctorData, tenantId = null) => {
  try {
    console.log(`adminService.updateDoctor called for ID: ${doctorId}, Tenant ID: ${tenantId || 'not specified'}`);
    
    // Prepare query parameters
    const params = {};
    if (tenantId) {
      params.tenantId = tenantId;
    }
    
    const response = await api.put(`/admin/doctors/${doctorId}`, doctorData, { 
      params 
    });
    
    console.log('updateDoctor response:', response.data);
    return response.data;
  } catch (error) {
    console.error('adminService.updateDoctor error:', error);
    throw error;
  }
},

// Delete doctor (admin function)
deleteDoctor: async (doctorId, tenantId = null) => {
  try {
    console.log(`adminService.deleteDoctor called for ID: ${doctorId}, Tenant ID: ${tenantId || 'not specified'}`);
    
    // Prepare query parameters
    const params = {};
    if (tenantId) {
      params.tenantId = tenantId;
    }
    
    const response = await api.delete(`/admin/doctors/${doctorId}`, { 
      params 
    });
    
    console.log('deleteDoctor response:', response.data);
    return response.data;
  } catch (error) {
    console.error('adminService.deleteDoctor error:', error);
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

// ===== HIRS FEATURE MANAGEMENT METHODS =====

// 🆕 NEW: Toggle individual HIRS feature
toggleHirsFeature: async (tenantId, hirsId, isActive) => {
  try {
    console.log(`adminService.toggleHirsFeature called - Tenant: ${tenantId}, HIRS: ${hirsId}, Active: ${isActive}`);
    
    // 🚨 CRITICAL FIX: Use the correct endpoint that matches your backend route
    const response = await api.put(`/admin/tenant-settings/${tenantId}/hirs/${hirsId}/toggle`, { 
      isActive,
      lastUpdated: new Date().toLocaleDateString()
    });
    
    console.log('toggleHirsFeature response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error toggling HIRS feature:', error);
    
    // 🔧 IMPROVED: Better error handling
    if (error.response) {
      const errorMessage = error.response.data?.message || `HTTP ${error.response.status}: ${error.response.statusText}`;
      throw new Error(errorMessage);
    } else if (error.request) {
      throw new Error('Network error - please check your connection');
    } else {
      throw new Error(error.message || 'Unknown error occurred');
    }
  }
},

// 🆕 NEW: Get HIRS feature statistics
getHirsStats: async (tenantId) => {
  try {
    console.log(`adminService.getHirsStats called for tenant: ${tenantId}`);
    const response = await api.get(`/admin/tenant-settings/${tenantId}/hirs/stats`);
    return response.data;
  } catch (error) {
    console.error('Error getting HIRS stats:', error);
    throw error;
  }
},

// 🆕 NEW: Bulk update HIRS features
bulkUpdateHirs: async (tenantId, hirsUpdates) => {
  try {
    console.log(`adminService.bulkUpdateHirs called for tenant: ${tenantId}`);
    const response = await api.put(`/admin/tenant-settings/${tenantId}/hirs/bulk`, { 
      updates: hirsUpdates 
    });
    return response.data;
  } catch (error) {
    console.error('Error bulk updating HIRS:', error);
    throw error;
  }
},

// ===== TEMPLATE MANAGEMENT METHODS =====

// Get all templates
getTemplates: async () => {
  try {
    console.log('🔍 Fetching templates via adminService...');
    const response = await api.get('/admin/templates');
    console.log('✅ Templates fetched successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error fetching templates:', error);
    throw error;
  }
},

// Get template by ID
getTemplate: async (id) => {
  try {
    console.log(`🔍 Fetching template ${id} via adminService...`);
    const response = await api.get(`/admin/templates/${id}`);
    console.log('✅ Template fetched successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error(`❌ Error fetching template ${id}:`, error);
    throw error;
  }
},

// Create new template
createTemplate: async (templateData) => {
  try {
    console.log('🔍 Creating template with data:', templateData);
    
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
    
    // If we still don't have a userId, try to decode it from the admin token
    if (!userId) {
      const adminToken = localStorage.getItem('adminToken');
      if (adminToken) {
        try {
          // Split the token and get the payload
          const parts = adminToken.split('.');
          if (parts.length === 3) {
            // Decode the payload
            const payload = JSON.parse(atob(parts[1]));
            userId = payload.id || payload._id;
            console.log('Extracted user ID from admin token:', userId);
          }
        } catch (e) {
          console.error('Error extracting user ID from admin token:', e);
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
    const response = await api.post('/admin/templates', dataWithCreator);
    
    console.log('✅ Template created successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error creating template:', error);
    
    if (error.response) {
      console.error('Server response:', error.response.data);
      throw new Error(`Server error: ${error.response.data.message || 'Error creating template'}`);
    } else {
      throw new Error(`Failed to save template: ${error.message}`);
    }
  }
},

// Update template
updateTemplate: async (id, templateData) => {
  try {
    console.log(`🔍 Updating template ${id} via adminService...`);
    const response = await api.put(`/admin/templates/${id}`, templateData);
    console.log('✅ Template updated successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error(`❌ Error updating template ${id}:`, error);
    throw error;
  }
},

// Delete template
deleteTemplate: async (id) => {
  try {
    console.log(`🔍 Deleting template ${id} via adminService...`);
    const response = await api.delete(`/admin/templates/${id}`);
    console.log('✅ Template deleted successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error(`❌ Error deleting template ${id}:`, error);
    throw error;
  }
},

// Assign template to patients
assignTemplate: async (id, assignmentData) => {
  try {
    console.log(`🔍 Assigning template ${id} via adminService...`);
    const response = await api.post(`/admin/templates/${id}/assign`, assignmentData);
    console.log('✅ Template assigned successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error(`❌ Error assigning template ${id}:`, error);
    throw error;
  }
},

// Get template statistics
getTemplateStats: async () => {
  try {
    console.log('🔍 Fetching template statistics via adminService...');
    const response = await api.get('/admin/templates/stats');
    console.log('✅ Template stats fetched successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error fetching template stats:', error);
    throw error;
  }
},


// Replace the getIndividualPatientMoodAnalytics method in your adminService.js with this debug version:

getIndividualPatientMoodAnalytics: async (patientId, days = 7, tenantId = null) => {
  try {
    console.log(`🔍 ADMIN: Fetching mood analytics for patient: ${patientId} (${days} days) - ALL TENANTS`);
    
    // Get authentication token
    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) {
      throw new Error('Admin authentication required');
    }
    
    // ✅ Use the ADMIN endpoint that searches all tenants
    const response = await api.get(`/admin/mood/user/${patientId}`, {
      params: { 
        days: days,
        limit: 100
      },
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    console.log('✅ ADMIN mood response (all tenants):', response.data);
    console.log('📊 ADMIN mood entries count:', response.data?.data?.length || 0);
    console.log('🏢 ADMIN searched tenants:', response.data?.searchInfo?.searchedTenants);
    
    // Process the raw mood data into analytics format
    let moodEntries = [];
    
    if (response.data && response.data.success && Array.isArray(response.data.data)) {
      moodEntries = response.data.data;
      console.log('📝 ADMIN: Processing mood data from all tenants');
    } else if (Array.isArray(response.data)) {
      moodEntries = response.data;
    }
    
    console.log('📊 ADMIN processing mood entries:', moodEntries.length, 'entries found across all tenants');
    
    // Transform raw mood data into analytics format
    const analyticsData = processMoodDataToAnalytics(moodEntries, days);
    
    console.log('📈 ADMIN analytics data generated:', analyticsData);
    
    return {
      success: true,
      data: analyticsData
    };
    
  } catch (error) {
    console.error(`❌ ADMIN Error fetching mood analytics for patient ${patientId}:`, error);
    
    // Return empty result instead of throwing to prevent UI crash
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
},

getIndividualPatientJournalEntries: async (patientId, days = 30, tenantId = null) => {
  try {
    console.log(`🔍 ADMIN: Fetching journal entries for patient: ${patientId} (${days} days) - ALL TENANTS`);
    
    // Get authentication token
    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) {
      throw new Error('Admin authentication required');
    }
    
    // ✅ Use the ADMIN endpoint that searches all tenants
    const response = await api.get(`/admin/journal/user/${patientId}`, {
      params: { 
        days: days,
        limit: 100
      },
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    console.log('✅ ADMIN journal response (all tenants):', response.data);
    console.log('📊 ADMIN journal entries count:', response.data?.data?.length || 0);
    console.log('🏢 ADMIN searched sources:', response.data?.searchInfo?.searchedSources);
    
    // Process the raw journal data into structured format
    let journalEntries = [];
    
    if (response.data && response.data.success && Array.isArray(response.data.data)) {
      journalEntries = response.data.data;
      console.log('📝 ADMIN: Processing journal data from all tenants');
    } else if (Array.isArray(response.data)) {
      journalEntries = response.data;
    }
    
    console.log('📊 ADMIN processing journal entries:', journalEntries.length, 'entries found across all tenants');
    
    // Transform raw journal data into analytics format using the helper function
    const analyticsData = processJournalDataToAnalytics(journalEntries, days);
    
    console.log('📈 ADMIN journal analytics data generated:', analyticsData);
    
    return {
      success: true,
      data: analyticsData
    };
    
  } catch (error) {
    console.error(`❌ ADMIN Error fetching journal entries for patient ${patientId}:`, error);
    
    // Return empty result instead of throwing to prevent UI crash
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
},

// ===== JOURNAL MANAGEMENT METHODS FOR ADMIN =====

// Get all journal entries across all tenants with filtering, sorting, and pagination
getJournalEntries: async (params = {}) => {
  try {
    console.log('adminService.getJournalEntries called with params:', params);
    
    // Convert params to query string
    const queryParams = new URLSearchParams();
    
    // Add pagination params
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    
    // Add filter params
    if (params.patient) queryParams.append('patient', params.patient);
    if (params.doctor) queryParams.append('doctor', params.doctor);
    if (params.tenant) queryParams.append('tenant', params.tenant);
    if (params.dateFrom) queryParams.append('dateFrom', params.dateFrom);
    if (params.dateTo) queryParams.append('dateTo', params.dateTo);
    if (params.sentiment) queryParams.append('sentiment', params.sentiment);
    if (params.mood) queryParams.append('mood', params.mood);
    if (params.search) queryParams.append('search', params.search);
    
    // Add sorting params
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);
    
    const response = await api.get(`/admin/journal-entries?${queryParams.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching journal entries:', error);
    throw error;
  }
},

// Get journal entry by ID (admin can view any entry)
getJournalEntry: async (entryId) => {
  try {
    console.log(`adminService.getJournalEntry called for ID: ${entryId}`);
    const response = await api.get(`/admin/journal-entries/${entryId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching journal entry ${entryId}:`, error);
    throw error;
  }
},

// Delete journal entry (admin function)
deleteJournalEntry: async (entryId) => {
  try {
    console.log(`adminService.deleteJournalEntry called for ID: ${entryId}`);
    const response = await api.delete(`/admin/journal-entries/${entryId}`);
    return response.data;
  } catch (error) {
    console.error(`Error deleting journal entry ${entryId}:`, error);
    throw error;
  }
},

// Export journal entries to PDF
exportJournalEntriesToPDF: async (filters = {}) => {
  try {
    console.log('adminService.exportJournalEntriesToPDF called with filters:', filters);
    const response = await api.get('/admin/journal-entries/export/pdf', {
      params: filters,
      responseType: 'blob'
    });
    
    // Create a download link and trigger it
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    
    // Generate filename with current date
    const date = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `journal-entries-report-${date}.pdf`);
    
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    return { success: true };
  } catch (error) {
    console.error('Error exporting journal entries to PDF:', error);
    throw error;
  }
},

// Get journal statistics for admin dashboard
getJournalStats: async () => {
  try {
    console.log('adminService.getJournalStats called');
    const response = await api.get('/admin/journal-entries/stats');
    return response.data;
  } catch (error) {
    console.error('Error fetching journal stats:', error);
    throw error;
  }
},

// Get all patients for the journal filter dropdown (across all tenants)
getAllPatientsForFilter: async () => {
  try {
    console.log('adminService.getAllPatientsForFilter called');
    const response = await api.get('/admin/patients/list');
    return response.data;
  } catch (error) {
    console.error('Error fetching patients for filter:', error);
    throw error;
  }
},

// Get all doctors for the journal filter dropdown (across all tenants)
getAllDoctorsForFilter: async () => {
  try {
    console.log('adminService.getAllDoctorsForFilter called');
    const response = await api.get('/admin/doctors/list');
    return response.data;
  } catch (error) {
    console.error('Error fetching doctors for filter:', error);
    throw error;
  }
},


/**
 * Get system-wide mood analytics across all tenants
 * @param {number} days - Number of days to analyze (default: 7)
 * @param {Object} filters - Additional filters (tenantId, etc.)
 * @returns {Promise} API response with system-wide mood analytics
 */
getSystemWideMoodAnalytics: async (days = 7, filters = {}) => {
  try {
    console.log(`🔍 ADMIN: Fetching system-wide mood analytics for ${days} days`);
    
    // Get authentication token
    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) {
      throw new Error('Admin authentication required');
    }
    
    // Prepare query parameters
    const queryParams = new URLSearchParams();
    queryParams.append('days', days);
    
    // Add filters
    if (filters.tenantId) {
      queryParams.append('tenantId', filters.tenantId);
    }
    
    const response = await api.get(`/admin/mood/analytics?${queryParams.toString()}`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    console.log('✅ ADMIN system mood analytics response:', response.data);
    
    // Process the raw mood data into analytics format if needed
    if (response.data && response.data.success && response.data.data) {
      return {
        success: true,
        data: response.data.data
      };
    }
    
    return response.data;
    
  } catch (error) {
    console.error(`❌ ADMIN Error fetching system mood analytics:`, error);
    
    // Return mock data for development if API fails
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 Returning mock mood analytics data for development');
      return {
        success: true,
        data: {
          keyMetrics: {
            totalLogs: 145,
            averageLogsPerDay: 20.7,
            averageMoodScore: 3.2,
            topEmotionalTrends: [
              { mood: 'Good', count: 58 },
              { mood: 'Okay', count: 45 }
            ]
          },
          dailyOverview: Array.from({ length: days }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (days - 1 - i));
            return {
              date: date.toISOString(),
              dateFormatted: date.getDate().toString(),
              totalEntries: Math.floor(Math.random() * 30) + 10,
              averageMoodScore: (Math.random() * 2 + 2.5).toFixed(1),
              mostFrequentMood: ['great', 'good', 'okay', 'struggling', 'upset'][Math.floor(Math.random() * 5)]
            };
          }),
          moodDistribution: {
            great: { count: 28, percentage: '19.3' },
            good: { count: 58, percentage: '40.0' },
            okay: { count: 35, percentage: '24.1' },
            struggling: { count: 18, percentage: '12.4' },
            upset: { count: 6, percentage: '4.1' }
          }
        }
      };
    }
    
    throw error;
  }
},

/**
 * Get system-wide mood history across all tenants
 * @param {number} days - Number of days to analyze (default: 7)
 * @param {Object} filters - Additional filters (search, tenantId, sortBy)
 * @returns {Promise} API response with system-wide mood history
 */
getSystemWideMoodHistory: async (days = 7, filters = {}) => {
  try {
    console.log(`🔍 ADMIN: Fetching system-wide mood history for ${days} days`);
    
    // Get authentication token
    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) {
      throw new Error('Admin authentication required');
    }
    
    // Prepare query parameters
    const queryParams = new URLSearchParams();
    queryParams.append('days', days);
    queryParams.append('limit', 100);
    
    // Add filters
    if (filters.search) {
      queryParams.append('search', filters.search);
    }
    if (filters.tenantId) {
      queryParams.append('tenantId', filters.tenantId);
    }
    if (filters.sortBy) {
      queryParams.append('sortBy', filters.sortBy);
    }
    
    const response = await api.get(`/admin/mood/history?${queryParams.toString()}`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    console.log('✅ ADMIN system mood history response:', response.data);
    
    // Process the raw mood data if needed
    if (response.data && response.data.success && Array.isArray(response.data.data)) {
      return {
        success: true,
        data: response.data.data
      };
    } else if (Array.isArray(response.data)) {
      return {
        success: true,
        data: response.data
      };
    }
    
    return response.data;
    
  } catch (error) {
    console.error(`❌ ADMIN Error fetching system mood history:`, error);
    
    // Return mock data for development if API fails
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 Returning mock mood history data for development');
      return {
        success: true,
        data: Array.from({ length: 20 }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - i);
          return {
            date: date.toISOString(),
            patientId: `patient_${i + 1}`,
            patientName: `Patient ${i + 1}`,
            tenantId: `tenant_${Math.floor(Math.random() * 3) + 1}`,
            totalLogs: Math.floor(Math.random() * 8) + 1,
            averageRating: (Math.random() * 3 + 2).toFixed(1),
            lastMood: {
              moodKey: ['great', 'good', 'okay', 'struggling', 'upset'][Math.floor(Math.random() * 5)],
              moodLabel: ['Great', 'Good', 'Okay', 'Struggling', 'Upset'][Math.floor(Math.random() * 5)],
              moodRating: Math.floor(Math.random() * 5) + 1
            }
          };
        })
      };
    }
    
    throw error;
  }
},

/**
 * Export system-wide mood analytics as PDF
 * @param {Object} filters - Export filters (days, tenantId, search)
 * @returns {Promise} File download response
 */
exportSystemMoodAnalytics: async (filters = {}) => {
  try {
    console.log('🔍 ADMIN: Exporting system mood analytics with filters:', filters);
    
    // Get authentication token
    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) {
      throw new Error('Admin authentication required');
    }
    
    const response = await api.get('/admin/mood/export', {
      params: filters,
      headers: {
        'Authorization': `Bearer ${adminToken}`
      },
      responseType: 'blob', // Important for file downloads
      timeout: 30000 // Longer timeout for export
    });
    
    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    
    // Set filename based on filters
    const timestamp = new Date().toISOString().split('T')[0];
    const tenantSuffix = filters.tenantId ? '-filtered' : '-all-tenants';
    const filename = `system-mood-analytics-${timestamp}${tenantSuffix}.pdf`;
    link.setAttribute('download', filename);
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    
    console.log('✅ ADMIN mood analytics exported successfully');
    
    return {
      success: true,
      message: 'System mood analytics exported successfully',
      filename
    };
    
  } catch (error) {
    console.error('❌ ADMIN Error exporting mood analytics:', error);
    throw error;
  }
},

/**
 * Get mood analytics for a specific patient (admin access across all tenants)
 * @param {string} patientId - Patient ID
 * @param {number} days - Number of days to analyze
 * @returns {Promise} API response with patient mood analytics
 */
getPatientMoodAnalytics: async (patientId, days = 30) => {
  try {
    console.log(`🔍 ADMIN: Fetching mood analytics for patient ${patientId} (${days} days)`);
    
    // Get authentication token
    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) {
      throw new Error('Admin authentication required');
    }
    
    const response = await api.get(`/admin/mood/patient/${patientId}`, {
      params: { days },
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    console.log('✅ ADMIN patient mood analytics response:', response.data);
    return response.data;
    
  } catch (error) {
    console.error(`❌ ADMIN Error fetching patient mood analytics:`, error);
    throw error;
  }
},

/**
 * Get mood statistics summary for admin dashboard
 * @param {Object} filters - Statistics filters
 * @returns {Promise} API response with mood statistics
 */
getMoodStatsSummary: async (filters = {}) => {
  try {
    console.log('🔍 ADMIN: Fetching mood statistics summary');
    
    // Get authentication token
    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) {
      throw new Error('Admin authentication required');
    }
    
    const response = await api.get('/admin/mood/stats', {
      params: filters,
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    console.log('✅ ADMIN mood statistics response:', response.data);
    return response.data;
    
  } catch (error) {
    console.error('❌ ADMIN Error fetching mood statistics:', error);
    throw error;
  }
}

};


// Helper function to process mood data (same as doctor service)
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

const processJournalDataToAnalytics = (journalEntries, days) => {
  if (!Array.isArray(journalEntries) || journalEntries.length === 0) {
    return {
      entries: [],
      summary: {
        totalEntries: 0,
        averagePerWeek: 0,
        mostCommonSentiment: 'neutral',
        totalWords: 0
      }
    };
  }

  // Calculate summary metrics
  const totalEntries = journalEntries.length;
  const averagePerWeek = Math.round((totalEntries / days) * 7 * 10) / 10;
  
  // Calculate total words
  const totalWords = journalEntries.reduce((total, entry) => {
    const content = entry.content || entry.rawText || entry.text || '';
    return total + content.split(' ').length;
  }, 0);

  // Calculate most common sentiment
  const sentimentCounts = {};
  journalEntries.forEach(entry => {
    const sentiment = entry.sentiment?.type || entry.sentimentType || 'neutral';
    sentimentCounts[sentiment] = (sentimentCounts[sentiment] || 0) + 1;
  });

  const mostCommonSentiment = Object.entries(sentimentCounts).reduce((a, b) => 
    sentimentCounts[a[0]] > sentimentCounts[b[0]] ? a : b
  )?.[0] || 'neutral';

  // Sort entries by date (most recent first)
  const sortedEntries = journalEntries.sort((a, b) => 
    new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date)
  );

  return {
    entries: sortedEntries,
    summary: {
      totalEntries,
      averagePerWeek,
      mostCommonSentiment,
      totalWords
    }
  };
};




export default adminService;
