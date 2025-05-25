// Onboarding.jsx - Main container component
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../../services/authService';
import logo from '../../assets/images/NeurolexLogo_White.png';
import '../../styles/components/onboarding/Onboarding.css';

// Import step components
import WelcomeStep from './parts/WelcomeStep';
import PersonalInfoStep from './parts/PersonalInfoStep';
import MentalHealthStep from './parts/MentalHealthStep';
import DoctorCareStep from './parts/DoctorCareStep';
import LifestyleStep from './parts/LifestyleStep';
import EmergencyContactStep from './parts/EmergencyContactStep';

// Initial form state
const initialUserData = {
  // Personal Information
  firstName: '',
  lastName: '',
  email: '',
  middleName: '',
  nickname: '',
  birthdate: '',
  age: '',
  gender: '',
  pronouns: '',
  
  // Mental Health History
  diagnosis: '',
  treatmentHistory: '',
  symptomsFrequency: '',
  
  // Doctor and Care Options
  primaryDoctor: '',
  doctorContact: '',
  therapistName: '',
  therapistContact: '',
  psychiatristName: '',
  psychiatristContact: '',
  preferredHospital: '',
  insuranceProvider: '',
  insuranceNumber: '',
  
  // Daily Life and Lifestyle
  occupation: '',
  workStatus: '',
  livingArrangement: '',
  exerciseFrequency: '',
  dietaryPatterns: '',
  sleepPatterns: '',
  substanceUse: '',
  religiousBeliefs: '',
  hobbies: '',
  
  // Emergency Contact
  emergencyName: '',
  emergencyRelationship: '',
  emergencyPhone: '',
  emergencyEmail: '',
  emergencyAddress: '',
  emergencyAware: false
};

const Onboarding = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [userData, setUserData] = useState(initialUserData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch user data on component mount
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // Debug auth state - check if we have valid token and user data
        authService.debugAuthState();
        
        // Try to fix any user data issues before proceeding
        await authService.fixUserData();
        
        console.log('Getting current user for onboarding...');
        
        // First try to get user from localStorage (faster than API call)
        const userStr = localStorage.getItem('user');
        let userFromStorage = null;
        
        if (userStr) {
          try {
            userFromStorage = JSON.parse(userStr);
            
            // Check if we have a "Default" user - if so, we should fetch from API
            if (userFromStorage && userFromStorage.firstName !== 'Default' && 
                userFromStorage._id && userFromStorage._id !== '00000000000000000000000') {
              console.log('Using valid user data from localStorage');
              updateUserDataFromStoredUser(userFromStorage);
            } else {
              console.log('Found default user in localStorage, will fetch from API');
            }
          } catch (err) {
            console.error('Error parsing user data from localStorage:', err);
          }
        }
        
        // If we have valid user data from storage, we can skip API call
        if (userFromStorage && userFromStorage.firstName !== 'Default' && 
            userFromStorage._id && userFromStorage._id !== '00000000000000000000000') {
          setLoading(false);
          return;
        }
        
        // Try to get user from API
        const response = await authService.getCurrentUser();
        
        if (response && response.user) {
          const { user } = response;
          
          console.log('User data received from API:', user);
          
          // If the API returns a default user, try a second time
          if (user.firstName === 'Default' || user._id === '00000000000000000000000') {
            console.log('API returned default user, trying again...');
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 1000));
            const retryResponse = await authService.getCurrentUser();
            
            if (retryResponse && retryResponse.user && 
                retryResponse.user.firstName !== 'Default' && 
                retryResponse.user._id !== '00000000000000000000000') {
              console.log('Got valid user data on retry:', retryResponse.user);
              updateUserDataFromStoredUser(retryResponse.user);
            } else {
              console.error('Still getting default user after retry');
              
              // Extract email from token as fallback
              extractEmailFromToken();
            }
          } else {
            // Update user data with API response
            updateUserDataFromStoredUser(user);
          }
        } else {
          console.error('Invalid user data from API');
          
          // Extract email from token as fallback
          extractEmailFromToken();
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching user data:', err);
        setError('Failed to load user data. Please try again.');
        setLoading(false);
        
        // Extract email from token as fallback
        extractEmailFromToken();
      }
    };
    
    // Helper to update user data from stored user
    const updateUserDataFromStoredUser = (user) => {
      // Check if user has already completed onboarding
      if (user.onboardingCompleted) {
        navigate('/dashboard');
        return;
      }
      
      // Populate the form with existing user data
      setUserData(prevData => ({
        ...prevData,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        middleName: user.middleName || '',
        nickname: user.nickname || '',
        birthdate: user.birthdate ? new Date(user.birthdate).toISOString().split('T')[0] : '',
      }));
    };
    
    // Helper to extract email from token as fallback
    const extractEmailFromToken = () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const tokenPayload = JSON.parse(atob(token.split('.')[1]));
          if (tokenPayload.email) {
            console.log('Using email from token:', tokenPayload.email);
            setUserData(prevData => ({
              ...prevData,
              email: tokenPayload.email,
              firstName: tokenPayload.email.split('@')[0] || ''
            }));
          }
        }
      } catch (e) {
        console.error('Error extracting email from token:', e);
      }
    };

    fetchUserData();
  }, [navigate]);

  // Direct state update for better performance
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    
    setUserData(prev => {
      const updated = { ...prev };
      updated[name] = newValue;
      return updated;
    });
  };

  const handleNext = () => {
    setCurrentStep(prev => prev + 1);
    window.scrollTo(0, 0);
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
    window.scrollTo(0, 0);
  };

  const handleSkip = () => {
    authService.skipOnboarding()
      .then(() => {
        navigate('/dashboard');
      })
      .catch(err => {
        console.error('Error skipping onboarding:', err);
        navigate('/dashboard');
      });
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const response = await authService.saveOnboardingData(userData);
      
      if (response.success) {
        navigate('/dashboard');
      } else {
        setError('Failed to save your information. Please try again.');
      }
    } catch (err) {
      console.error('Error submitting onboarding data:', err);
      setError('Failed to save your information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Calculate total steps (excluding welcome screen)
  const totalSteps = 5;

  // Render the appropriate step component
  const renderStep = () => {
    if (loading) {
      return <div className="loading">Loading your profile...</div>;
    }
    
    if (error) {
      return (
        <div className="error-container">
          <div className="error-message">{error}</div>
          <button 
            onClick={() => navigate('/login')} 
            className="btn btn-primary"
          >
            Return to Login
          </button>
        </div>
      );
    }
    
    const commonProps = {
      userData,
      handleInputChange,
      handleNext,
      handleBack,
      handleSkip,
      handleSubmit
    };
    
    switch (currentStep) {
      case 0:
        return <WelcomeStep {...commonProps} />;
      case 1:
        return <PersonalInfoStep {...commonProps} />;
      case 2:
        return <MentalHealthStep {...commonProps} />;
      case 3:
        return <DoctorCareStep {...commonProps} />;
      case 4:
        return <LifestyleStep {...commonProps} />;
      case 5:
        return <EmergencyContactStep {...commonProps} />;
      default:
        return <WelcomeStep {...commonProps} />;
    }
  };

  return (
    <div className="page-wrapper">
      <div className="split-screen-container">
        {/* Left side - Logo */}
        <div className="logo-side">
          <div className="logo-content">
            <div className="app-logo">
              <img src={logo} alt="Neurolex Logo" />
            </div>
            <div className="logo-text">
            </div>
          </div>
        </div>
        
        {/* Right side - Form */}
        <div className="form-side">
          {currentStep > 0 && (
            <div className="progress-indicator">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                ></div>
              </div>
              <div className="step-counter">
                Part {currentStep} of {totalSteps}
              </div>
            </div>
          )}
          
          {renderStep()}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;