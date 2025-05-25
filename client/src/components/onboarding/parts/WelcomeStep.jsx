import React, { useState } from 'react';
import ProfilePicture from '../../others/ProfilePicture';
import logoutIcon from '../../../assets/icons/Logout_button.svg';
import logo from '../../../assets/images/Neurolex_Logo_Gradient.png';
import authService from '../../../services/authService'; // Import auth service

const LogoutModal = ({ isOpen, onClose, onConfirm, userData }) => {
  if (!isOpen) return null;
  
  // Use a safe display of user info to avoid "Default" name appearing
  const displayName = userData?.firstName !== 'Default' 
    ? `${userData.firstName} ${userData.lastName || ''}` 
    : (userData?.email ? userData.email.split('@')[0] : 'your account');
  
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <img src={logo} alt="Neurolex Logo" className="modal-logo" />
          <p className="logout-confirmation-label">
            LOGOUT CONFIRMATION
          </p>
        </div>
        
        <div className="user-info-container">
          <h3>{displayName}</h3>
          <p>{userData?.email || ''}</p>
        </div>
        
        <p className="logout-message">
          You will be signed out of your account and will need to log in again to continue.
        </p>
        
        <div className="modal-actions">
          <button className="cancel-button" onClick={onClose}>Cancel</button>
          <button className="logout-button" onClick={onConfirm}>Logout</button>
        </div>
      </div>
    </div>
  );
};

const WelcomeStep = ({ userData, handleNext, handleSkip }) => {
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  
  // Handle cases where userData is missing or contains default values
  const safeUserData = {
    ...userData
  };
  
  // Get safe display name - avoid showing "Default"
  const getDisplayName = () => {
    // Check if firstName exists and is not "Default"
    if (userData?.firstName && userData.firstName !== 'Default') {
      return userData.firstName;
    }
    // Try to extract name from email
    else if (userData?.email) {
      const namePart = userData.email.split('@')[0];
      // Capitalize first letter
      return namePart.charAt(0).toUpperCase() + namePart.slice(1);
    }
    // Fallback
    return 'User';
  };
  
  const getDisplayLastName = () => {
    return (userData?.lastName && userData.lastName !== 'User') ? userData.lastName : '';
  };
  
  const displayName = getDisplayName();
  const displayLastName = getDisplayLastName();
  
  const handleLogout = () => {
    // Open the confirmation modal
    setShowLogoutModal(true);
  };
  
  const confirmLogout = () => {
    // Call the logout method from authService
    authService.logout();
    // Note: The authService.logout() method already handles:
    // 1. Removing the token from localStorage
    // 2. Redirecting to the login page
  };
  
  return (
    <div className="step-container welcome-step">
      <h2 className='Welcome-h2'>Welcome to Neurolex!</h2>
      <div className="user-profile">
        <div className="profile-pic">
          <ProfilePicture userData={safeUserData} />
        </div>
        <div className="user-name">
          <h3>{displayName} {displayLastName}</h3>
        </div>
        <div className="user-email">
          <p>({userData?.email || ''})</p>
        </div>
        <div className="logout-container">
          <button className="logout-icon-button" onClick={handleLogout}>
            <div className="logout-icon-wrapper">
              <img src={logoutIcon} alt="Logout" className="logout-svg" />
            </div>
          </button>
        </div>
      </div>
      
      <div className="welcome-message">
        <div className="message-block">
          <p>Thank you for signing up to Neurolex! </p>
          <p>This is the start of a hopeful recovery journey.</p>
          <p>We're here to support you every step of the way. 🌱</p>
        </div>
        <div className="message-block">
          <p>To help us understand your current state better and offer personalized support, we'd like to ask you a few questions.</p>
          <p>Don't worry — if you're not ready to answer them now, you can skip this and complete it later in your profile settings. You're in control. 💚</p>
        </div>
      </div>
    
      <div className="button-container">
        <button className="primary-button" onClick={handleNext}>Get Started</button>
        <button className="secondary-button" onClick={handleSkip}>Skip for Now</button>
      </div>
      
      {/* Logout confirmation modal */}
      <LogoutModal 
        isOpen={showLogoutModal} 
        onClose={() => setShowLogoutModal(false)} 
        onConfirm={confirmLogout}
        userData={safeUserData}
      />
    </div>
  );
};

export default WelcomeStep;