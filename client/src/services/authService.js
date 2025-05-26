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

// Service functions for authentication
const authService = {
  // Register new user with email and password
  register: async (userData) => {
    try {
      console.log('authService.register called with:', userData);
      // Changed from '/' to '/auth/register' to match server endpoint
      const response = await api.post('/auth/register', userData);
      console.log('authService.register response:', response.data);
      return response.data;
    } catch (error) {
      console.error('authService.register error:', error);
      throw error;
    }
  },
  
  // Login with email and password
  login: async (userData) => {
    try {
      console.log('authService.login called for email:', userData.email);
      const response = await api.post('/auth/login', userData);
      console.log('authService.login response:', response.data);
      
      // Handle token storage and redirection
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        
        // Store user data including role
        if (response.data.user) {
          localStorage.setItem('user', JSON.stringify(response.data.user));
        }
        
        // Store tenant data if provided (new)
        if (response.data.tenant) {
          localStorage.setItem('tenant', JSON.stringify(response.data.tenant));
        }
        
        // Check if user has completed onboarding
        if (response.data.user && !response.data.user.onboardingCompleted) {
          // Redirect to onboarding
          window.location.href = '/onboarding';
        }
      }
      
      return response.data;
    } catch (error) {
      console.error('authService.login error:', error);
      throw error;
    }
  },
  
  // Authenticate with Google
  googleAuth: async (googleData) => {
    try {
      // googleData could be just the credential, or an object with credential and tenantId
      const credential = googleData.credential || googleData;
      const payload = typeof googleData === 'object' && googleData.tenantId
        ? { idToken: credential, tenantId: googleData.tenantId }
        : { idToken: credential };
        
      console.log('authService.googleAuth called with payload:', payload);
      const response = await api.post('/auth/google-auth', payload);
      console.log('authService.googleAuth response:', response.data);
      
      // Handle token storage and redirection
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        
        // Store user data for mood tracker and other user-specific services
        if (response.data.user) {
          localStorage.setItem('user', JSON.stringify(response.data.user));
        }
        
        // Store tenant data if provided (new)
        if (response.data.tenant) {
          localStorage.setItem('tenant', JSON.stringify(response.data.tenant));
        }
        
        // Check if user has completed onboarding
        if (response.data.user && !response.data.user.onboardingCompleted) {
          // Redirect to onboarding
          window.location.href = '/onboarding';
        }
      }
      
      return response.data;
    } catch (error) {
      console.error('authService.googleAuth error:', error);
      throw error;
    }
  },
  
  // Verify email with verification code - UPDATED to fix Default User issue
  verifyEmail: async (email, code, tenantId) => {
    try {
      console.log('authService.verifyEmail called with email and code');
      
      // Create payload with or without tenantId
      const payload = tenantId
        ? { email, code, tenantId }
        : { email, code };
        
      const response = await api.post('/auth/verify-email', payload);
      console.log('authService.verifyEmail response:', response.data);
      
      // Handle token storage and redirection
      if (response.data.token) {
        // Save token to localStorage
        localStorage.setItem('token', response.data.token);
        
        // Store user data - Make sure user data is complete
        if (response.data.user) {
          // Make sure all required fields are present
          const user = {
            ...response.data.user,
            // Ensure these fields exist with fallback values
            _id: response.data.user._id,
            firstName: response.data.user.firstName || email.split('@')[0],
            lastName: response.data.user.lastName || '',
            email: response.data.user.email || email,
            role: response.data.user.role || 'patient'
          };
          
          console.log('Saving complete user data to localStorage:', user);
          localStorage.setItem('user', JSON.stringify(user));
        } else {
          console.error('No user data in verification response');
          // Try to get user data from JWT token
          try {
            const tokenPayload = JSON.parse(atob(response.data.token.split('.')[1]));
            if (tokenPayload.id) {
              const defaultUser = {
                _id: tokenPayload.id,
                firstName: email.split('@')[0],
                lastName: '',
                email: email,
                role: tokenPayload.role || 'patient',
                onboardingCompleted: false
              };
              console.log('Created user data from token:', defaultUser);
              localStorage.setItem('user', JSON.stringify(defaultUser));
            }
          } catch (e) {
            console.error('Error extracting user data from token:', e);
          }
        }
        
        // Store tenant data if provided
        if (response.data.tenant) {
          localStorage.setItem('tenant', JSON.stringify(response.data.tenant));
        }
        
        console.log('Token saved to localStorage:', response.data.token.substring(0, 10) + '...');
        
        // Verify the data was saved correctly
        const savedUser = localStorage.getItem('user');
        console.log('User data in localStorage:', savedUser ? JSON.parse(savedUser) : 'No user data');
        
        // Check if we need to fetch more user data
        if (!savedUser || JSON.parse(savedUser)._id === '00000000000000000000000') {
          console.log('User data is missing or default, fetching full profile...');
          try {
            const userResponse = await api.get('/users/me');
            if (userResponse.data && userResponse.data.user) {
              localStorage.setItem('user', JSON.stringify(userResponse.data.user));
              console.log('Updated user data from profile:', userResponse.data.user);
            }
          } catch (profileError) {
            console.error('Error fetching user profile:', profileError);
          }
        }
        
        // Delay redirect to ensure token is saved
        return new Promise((resolve) => {
          setTimeout(() => {
            // Check if token was saved correctly
            const savedToken = localStorage.getItem('token');
            console.log('Token in localStorage before redirect:', savedToken ? savedToken.substring(0, 10) + '...' : 'No token');
            
            // After email verification, redirect to onboarding
            window.location.href = '/onboarding';
            resolve(response.data);
          }, 1000); // Small delay to ensure localStorage is updated
        });
      }
      
      return response.data;
    } catch (error) {
      console.error('authService.verifyEmail error:', error);
      throw error;
    }
  },
  
  // Resend verification code - updated for multi-tenant support
  resendVerificationCode: async (data) => {
    try {
      // Handle both formats: string email or {email, tenantId} object
      const payload = typeof data === 'string' 
        ? { email: data }
        : data;
      
      console.log('authService.resendVerificationCode called with:', payload);
      const response = await api.post('/auth/resend-verification', payload);
      console.log('authService.resendVerificationCode response:', response.data);
      return response.data;
    } catch (error) {
      console.error('authService.resendVerificationCode error:', error);
      throw error;
    }
  },
  
  // Forgot password - request reset code
  forgotPassword: async (email, tenantId) => {
    try {
      console.log('authService.forgotPassword called for email:', email);
      
      // Create payload with or without tenantId
      const payload = tenantId
        ? { email, tenantId }
        : { email };
      
      const response = await api.post('/auth/forgot-password', payload);
      console.log('authService.forgotPassword response:', response.data);
      return response.data;
    } catch (error) {
      console.error('authService.forgotPassword error:', error);
      throw error;
    }
  },
  
  // Get tenant data from storage
  getTenant: () => {
    try {
      const tenant = localStorage.getItem('tenant') || sessionStorage.getItem('tenant');
      return tenant ? JSON.parse(tenant) : null;
    } catch (error) {
      console.error('Error getting tenant data:', error);
      return null;
    }
  },
  
  // Verify reset code
  verifyResetCode: async (email, code) => {
    try {
      console.log('authService.verifyResetCode called for email:', email);
      const response = await api.post('/auth/verify-reset-code', { email, code });
      console.log('authService.verifyResetCode response:', response.data);
      return response.data;
    } catch (error) {
      console.error('authService.verifyResetCode error:', error);
      throw error;
    }
  },
  
  // Reset password with code
  resetPassword: async (email, code, newPassword, confirmPassword) => {
    try {
      console.log('authService.resetPassword called for email:', email);
      const response = await api.post('/auth/reset-password', { 
        email, 
        code, 
        newPassword, 
        confirmPassword 
      });
      console.log('authService.resetPassword response:', response.data);
      return response.data;
    } catch (error) {
      console.error('authService.resetPassword error:', error);
      throw error;
    }
  },
  
  // Get current user profile - UPDATED to improve error handling and data saving
  getCurrentUser: async () => {
  try {
    console.log('authService.getCurrentUser called');
    const token = localStorage.getItem('token');
    
    if (!token) {
      console.log('No token found in localStorage');
      throw new Error('No authentication token found');
    }
    
    // Try to determine user type from token
    let userRole = null;
    let userId = null;
    
    try {
      // Parse JWT token to get user info
      const tokenPayload = JSON.parse(atob(token.split('.')[1]));
      userRole = tokenPayload.role;
      userId = tokenPayload.id || tokenPayload._id;
      console.log('Token info - Role:', userRole, 'ID:', userId);
    } catch (e) {
      console.log('Could not parse token payload:', e);
    }
    
    // Handle default admin case (from environment variables)
    if (userId === 'admin_default' || userRole === 'admin') {
      console.log('Admin user detected');
      
      // Try admin profile endpoint first
      try {
        const response = await api.get('/admin/profile');
        console.log('Admin profile response:', response.data);
        
        if (response.data) {
          const adminUser = {
            _id: response.data.id || userId || 'admin_default',
            firstName: response.data.firstName || 'System',
            lastName: response.data.lastName || 'Administrator',
            email: response.data.email || 'admin@neurolex.com',
            role: 'admin',
            name: response.data.name || 'System Administrator'
          };
          
          localStorage.setItem('user', JSON.stringify(adminUser));
          return { success: true, user: adminUser };
        }
      } catch (adminError) {
        console.log('Admin profile endpoint not available, using default admin data');
        
        // Fallback to default admin data
        const defaultAdmin = {
          _id: userId || 'admin_default',
          firstName: 'System',
          lastName: 'Administrator',
          email: 'admin@neurolex.com',
          role: 'admin',
          name: 'System Administrator'
        };
        
        localStorage.setItem('user', JSON.stringify(defaultAdmin));
        return { success: true, user: defaultAdmin };
      }
    }
    
    // For all other users (patients, professionals, etc.) - use standard endpoint
    console.log('Making request to /users/me for user role:', userRole);
    
    try {
      const response = await api.get('/users/me');
      console.log('getCurrentUser response:', response.data);
      
      // Update user data in localStorage
      if (response.data && response.data.user) {
        const existingUserStr = localStorage.getItem('user');
        let existingUser = {};
        
        // Merge with existing data if available
        if (existingUserStr) {
          try {
            existingUser = JSON.parse(existingUserStr);
          } catch (e) {
            console.error('Error parsing existing user data:', e);
          }
        }
        
        // Create complete user object
        const updatedUser = {
          ...existingUser,
          ...response.data.user,
          // Ensure critical fields exist
          _id: response.data.user._id || existingUser._id,
          firstName: response.data.user.firstName || existingUser.firstName || 'User',
          lastName: response.data.user.lastName || existingUser.lastName || '',
          email: response.data.user.email || existingUser.email || '',
          role: response.data.user.role || existingUser.role || 'patient'
        };
        
        console.log('Saving updated user data to localStorage:', updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        // Return the complete user object
        return {
          ...response.data,
          user: updatedUser
        };
      }
      
      return response.data;
    } catch (userError) {
      console.error('Error fetching user profile:', userError);
      
      // If /users/me fails, try to create user data from token
      if (userRole && userId) {
        console.log('Creating user data from token due to API failure');
        
        const tokenBasedUser = {
          _id: userId,
          firstName: userRole === 'admin' ? 'System' : 'User',
          lastName: userRole === 'admin' ? 'Administrator' : '',
          email: 'user@example.com', // Fallback email
          role: userRole,
          name: userRole === 'admin' ? 'System Administrator' : 'User'
        };
        
        localStorage.setItem('user', JSON.stringify(tokenBasedUser));
        return { success: true, user: tokenBasedUser };
      }
      
      throw userError;
    }
  } catch (error) {
    console.error('authService.getCurrentUser error:', error);
    throw error;
  }
},
  
  // Get a specific tenant by ID
  getTenantById: async (tenantId) => {
    try {
      const response = await api.get(`/tenants/${tenantId}`);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching tenant details:', error);
      throw error;
    }
  },
  
  // Get public tenant information by ID (no authentication required)
  getPublicTenantById: async (tenantId) => {
    try {
      // Use public endpoint that doesn't require authentication
      const response = await axios.get(`${API_URL}/tenants/${tenantId}/public`);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching public tenant details:', error);
      throw error;
    }
  },
  
  // Get all available tenants
getTenants: async () => {
  console.log('getTenants called - using fetchTenants internally');
  return await authService.fetchTenants();
},

  
  // Get the current tenant information from storage
  getCurrentTenant: () => {
    try {
      // Try localStorage first, then sessionStorage
      const tenantStr = localStorage.getItem('tenant') || sessionStorage.getItem('tenant');
      return tenantStr ? JSON.parse(tenantStr) : null;
    } catch (error) {
      console.error('Error getting current tenant:', error);
      return null;
    }
  },
  
  // Check if the app is running in multi-tenant mode
  isMultiTenantEnabled: () => {
    return process.env.REACT_APP_ENABLE_MULTI_TENANT === 'true';
  },
  
  // Clear tenant information from storage (used during logout)
  clearTenantInfo: () => {
    localStorage.removeItem('tenant');
    sessionStorage.removeItem('tenant');
  },
  
  // Set tenant information in the same storage as the token
  setTenantInfo: (tenant, rememberMe = true) => {
    if (!tenant) return;
    
    if (rememberMe) {
      localStorage.setItem('tenant', JSON.stringify(tenant));
    } else {
      sessionStorage.setItem('tenant', JSON.stringify(tenant));
    }
  },
  
  // NEW: Debug function to help troubleshoot auth issues
  debugAuthState: () => {
    try {
      console.group('Auth State Debug');
      // Check token
      const token = localStorage.getItem('token');
      console.log('Token exists:', !!token);
      if (token) {
        // Parse JWT (if it's a JWT token)
        try {
          const tokenPayload = JSON.parse(atob(token.split('.')[1]));
          console.log('Token payload:', tokenPayload);
        } catch (e) {
          console.log('Token is not in JWT format or is invalid');
        }
      }
      
      // Check user data
      const userStr = localStorage.getItem('user');
      console.log('User data exists:', !!userStr);
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          console.log('User data:', user);
          console.log('User ID:', user._id);
          console.log('User name:', `${user.firstName} ${user.lastName}`);
          console.log('Is default user:', user._id === '00000000000000000000000' || user.firstName === 'Default');
        } catch (e) {
          console.log('Error parsing user data:', e);
        }
      }
      
      // Check tenant data
      const tenantStr = localStorage.getItem('tenant');
      console.log('Tenant data exists:', !!tenantStr);
      if (tenantStr) {
        try {
          const tenant = JSON.parse(tenantStr);
          console.log('Tenant data:', tenant);
        } catch (e) {
          console.log('Error parsing tenant data:', e);
        }
      }
      console.groupEnd();
      
      return {
        hasToken: !!token,
        hasUser: !!userStr,
        hasTenant: !!tenantStr
      };
    } catch (error) {
      console.error('Error in debugAuthState:', error);
      return {
        hasToken: false,
        hasUser: false,
        hasTenant: false,
        error: error.message
      };
    }
  },
  
  // NEW: Function to fix user data if needed
  fixUserData: async () => {
    try {
      console.log('Attempting to fix user data');
      
      const userStr = localStorage.getItem('user');
      const token = localStorage.getItem('token');
      
      // Check if we have invalid or default user data
      let needsFixing = false;
      
      if (!userStr) {
        console.log('No user data found, fixing needed');
        needsFixing = true;
      } else {
        try {
          const userData = JSON.parse(userStr);
          if (!userData._id || userData._id === '00000000000000000000000' || userData.firstName === 'Default') {
            console.log('Found default or invalid user data, fixing needed');
            needsFixing = true;
          }
        } catch (e) {
          console.error('Error parsing user data:', e);
          needsFixing = true;
        }
      }
      
      if (needsFixing && token) {
        console.log('Fetching user profile to fix data');
        try {
          const response = await api.get('/users/me');
          
          if (response.data && response.data.user) {
            console.log('User profile fetched successfully, updating localStorage');
            localStorage.setItem('user', JSON.stringify(response.data.user));
            return {
              success: true,
              message: 'User data fixed successfully',
              user: response.data.user
            };
          }
        } catch (error) {
          console.error('Error fetching user profile to fix data:', error);
        }
      }
      
      return {
        success: !needsFixing,
        message: needsFixing ? 'User data needs fixing but could not be fixed' : 'User data is valid'
      };
    } catch (error) {
      console.error('Error in fixUserData:', error);
      return {
        success: false,
        message: 'Error fixing user data',
        error: error.message
      };
    }
  }
};

export default authService;







