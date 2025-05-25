// client/src/components/doctors/auth/DoctorAuthLayout.jsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import { DoctorAuthProvider } from '../../context/AuthContext';
import '../../styles/components/doctor/doctor_auth_layout.css';

// Import logo
import logoImage from '../../assets/images/Neurolex_Logo_New.png';

const DoctorAuthLayout = ({ children }) => {
  return (
    <DoctorAuthProvider>
      <div className="doctor-auth-layout">
        {/* Left Side - Form Container */}
        <div className="doctor-auth-form-container">
          {children || <Outlet />}
        </div>
        
        {/* Right Side - Description, App Name and Logo */}
        <div className="doctor-auth-info-container">
          <div className="doctor-auth-info-content">
            <img src={logoImage} alt="Neurolex Logo" className="doctor-auth-logo" />
            
            <h1 className="doctor-auth-title">Neurolex for Healthcare Professionals</h1>
            
            <div className="doctor-auth-description">
              <p>Welcome to Neurolex - the platform designed specifically for mental health professionals.</p>
              <p>Our secure system helps you manage patient care, track journal entries, and provide better mental health support.</p>
            </div>
            
            <div className="doctor-auth-features">
              <div className="doctor-auth-feature">
                <div className="doctor-auth-feature-icon">📊</div>
                <div className="doctor-auth-feature-text">
                  <h3>Track Patient Progress</h3>
                  <p>Monitor mood patterns and journal entries to better understand your patients' mental health journey.</p>
                </div>
              </div>
              
              <div className="doctor-auth-feature">
                <div className="doctor-auth-feature-icon">📝</div>
                <div className="doctor-auth-feature-text">
                  <h3>Customized Templates</h3>
                  <p>Create and assign tailored journal templates to guide your patients' reflections.</p>
                </div>
              </div>
              
              <div className="doctor-auth-feature">
                <div className="doctor-auth-feature-icon">🔒</div>
                <div className="doctor-auth-feature-text">
                  <h3>Secure Communication</h3>
                  <p>Communicate with your patients through our HIPAA-compliant messaging system.</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="doctor-auth-footer">
            <p>© 2025 Neurolex. All rights reserved.</p>
          </div>
        </div>
      </div>
    </DoctorAuthProvider>
  );
};

export default DoctorAuthLayout;