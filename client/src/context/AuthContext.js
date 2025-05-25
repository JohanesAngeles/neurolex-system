import React, { createContext, useState, useEffect, useContext } from 'react';
import authService from '../services/doctorAuthService';

// Create context
const DoctorAuthContext = createContext();

// Custom hook to use the auth context
export const useDoctorAuth = () => useContext(DoctorAuthContext);

// Provider component
export const DoctorAuthProvider = ({ children }) => {
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Initialize auth state on mount
  useEffect(() => {
    const initAuthState = async () => {
      try {
        // Check if token exists
        if (authService.isAuthenticated()) {
          // Get current doctor profile
          const response = await authService.getCurrentDoctor();
          if (response && response.doctor) {
            setDoctor(response.doctor);
            setIsAuthenticated(true);
          }
        }
      } catch (error) {
        console.error('Error initializing auth state:', error);
        // Clear invalid auth data
        authService.logout();
      } finally {
        setLoading(false);
      }
    };

    initAuthState();
  }, []);

  // Login function
  const login = async (credentials) => {
    try {
      const response = await authService.login(credentials);
      setDoctor(response.doctor);
      setIsAuthenticated(true);
      return response;
    } catch (error) {
      throw error;
    }
  };

  // Logout function
  const logout = () => {
    authService.logout();
    setDoctor(null);
    setIsAuthenticated(false);
  };

  // Register function
  const register = async (doctorData) => {
    try {
      const response = await authService.register(doctorData);
      return response;
    } catch (error) {
      throw error;
    }
  };

  // Verify email function
  const verifyEmail = async (email, code) => {
    try {
      const response = await authService.verifyEmail(email, code);
      setDoctor(response.doctor);
      setIsAuthenticated(true);
      return response;
    } catch (error) {
      throw error;
    }
  };

  // Update doctor profile
  const updateProfile = async (profileData) => {
    try {
      const response = await authService.updateProfile(profileData);
      setDoctor(response.doctor);
      return response;
    } catch (error) {
      throw error;
    }
  };

  // Context value
  const value = {
    doctor,
    loading,
    isAuthenticated,
    login,
    logout,
    register,
    verifyEmail,
    updateProfile
  };

  return (
    <DoctorAuthContext.Provider value={value}>
      {children}
    </DoctorAuthContext.Provider>
  );
};

export default DoctorAuthContext;