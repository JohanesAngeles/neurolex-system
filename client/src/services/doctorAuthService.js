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
    const token = localStorage.getItem('doctor_token');
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
    console.error('API Error:', {
      url: error.config?.url,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    return Promise.reject(error);
  }
);

// Doctor-specific auth service
const doctorAuthService = {
  // Register new doctor
  register: async (doctorData) => {
    try {
      console.log('doctorAuthService.register called with:', doctorData);
      const response = await api.post('/doctors/register', doctorData);
      console.log('doctorAuthService.register response:', response.data);
      return response.data;
    } catch (error) {
      console.error('doctorAuthService.register error:', error);
      throw error;
    }
  },
  
  // Login with email and password
  login: async (credentials) => {
    try {
      console.log('doctorAuthService.login called for email:', credentials.email);
      const response = await api.post('/doctors/login', credentials);
      console.log('doctorAuthService.login response:', response.data);
      
      // Handle token storage
      if (response.data.token) {
        localStorage.setItem('doctor_token', response.data.token);
        
        // Store doctor data
        if (response.data.doctor) {
          localStorage.setItem('doctor', JSON.stringify(response.data.doctor));
        }
      }
      
      return response.data;
    } catch (error) {
      console.error('doctorAuthService.login error:', error);
      throw error;
    }
  },
  
  // Verify email with verification code
  verifyEmail: async (email, code) => {
    try {
      console.log('doctorAuthService.verifyEmail called with email and code');
      const response = await api.post('/doctors/verify-email', { email, code });
      console.log('doctorAuthService.verifyEmail response:', response.data);
      
      // Handle token storage
      if (response.data.token) {
        localStorage.setItem('doctor_token', response.data.token);
        
        // Store doctor data
        if (response.data.doctor) {
          localStorage.setItem('doctor', JSON.stringify(response.data.doctor));
        }
      }
      
      return response.data;
    } catch (error) {
      console.error('doctorAuthService.verifyEmail error:', error);
      throw error;
    }
  },
  
  // Resend verification code
  resendVerificationCode: async (email) => {
    try {
      console.log('doctorAuthService.resendVerificationCode called for email:', email);
      const response = await api.post('/doctors/resend-verification', { email });
      console.log('doctorAuthService.resendVerificationCode response:', response.data);
      return response.data;
    } catch (error) {
      console.error('doctorAuthService.resendVerificationCode error:', error);
      throw error;
    }
  },
  
  // Forgot password - request reset code
  forgotPassword: async (email) => {
    try {
      console.log('doctorAuthService.forgotPassword called for email:', email);
      const response = await api.post('/doctors/forgot-password', { email });
      console.log('doctorAuthService.forgotPassword response:', response.data);
      return response.data;
    } catch (error) {
      console.error('doctorAuthService.forgotPassword error:', error);
      throw error;
    }
  },
  
  // Verify reset code
  verifyResetCode: async (email, code) => {
    try {
      console.log('doctorAuthService.verifyResetCode called for email:', email);
      const response = await api.post('/doctors/verify-reset-code', { email, code });
      console.log('doctorAuthService.verifyResetCode response:', response.data);
      return response.data;
    } catch (error) {
      console.error('doctorAuthService.verifyResetCode error:', error);
      throw error;
    }
  },
  
  // Reset password with code
  resetPassword: async (email, code, newPassword, confirmPassword) => {
    try {
      console.log('doctorAuthService.resetPassword called for email:', email);
      const response = await api.post('/doctors/reset-password', { 
        email, 
        code, 
        newPassword, 
        confirmPassword 
      });
      console.log('doctorAuthService.resetPassword response:', response.data);
      return response.data;
    } catch (error) {
      console.error('doctorAuthService.resetPassword error:', error);
      throw error;
    }
  },
  
  // Get current doctor profile
  getCurrentDoctor: async () => {
    try {
      console.log('doctorAuthService.getCurrentDoctor called');
      const token = localStorage.getItem('doctor_token');
      
      if (!token) {
        console.log('No token found in localStorage');
        throw new Error('No authentication token found');
      }
      
      const response = await api.get('/doctors/me');
      console.log('getCurrentDoctor response:', response.data);
      
      // Update doctor data in localStorage
      if (response.data && response.data.doctor) {
        localStorage.setItem('doctor', JSON.stringify(response.data.doctor));
      }
      
      return response.data;
    } catch (error) {
      console.error('doctorAuthService.getCurrentDoctor error:', error);
      throw error;
    }
  },
  
  // Update doctor profile
  updateProfile: async (profileData) => {
    try {
      console.log('doctorAuthService.updateProfile called');
      const response = await api.put('/doctors/profile', profileData);
      console.log('updateProfile response:', response.data);
      
      // Update doctor data in localStorage
      if (response.data && response.data.doctor) {
        localStorage.setItem('doctor', JSON.stringify(response.data.doctor));
      }
      
      return response.data;
    } catch (error) {
      console.error('Error updating doctor profile:', error);
      throw error;
    }
  },
  
  // Check if doctor is authenticated
  isAuthenticated: () => {
    const token = localStorage.getItem('doctor_token');
    return !!token;
  },
  
  // Log out doctor
  logout: () => {
    localStorage.removeItem('doctor_token');
    localStorage.removeItem('doctor');
    
    // Redirect to doctor login page
    window.location.href = '/doctor/login';
  }
};

export default doctorAuthService;