// src/layouts/AdminAuthLayout.jsx
import React from 'react';
import { useLocation } from 'react-router-dom';
// Import the logo as an image source, not as a component
import NeuroLexLogo from '../../../assets/images/Neurolex_Logo_New.png';

/**
 * AdminAuthLayout - Shared layout for admin authentication pages
 * This creates a consistent side-by-side layout with a form on the left
 * and branding/info on the right side
 */
const AdminAuthLayout = ({ children }) => {
  const location = useLocation();
  const isRegisterPage = location.pathname.includes('/admin/register');
  
  return (
    <div className="auth-container">
      {/* Left side - Form content provided by children */}
      <div className="auth-form-container">
        {children}
      </div>
      
      {/* Right side - Branding and information */}
      <div className="auth-info-container">
        <div className="auth-info-content">
          {/* Logo - Use img tag with the imported image as src */}
          <div className="auth-logo">
            <img src={NeuroLexLogo} alt="Neurolex Logo" />
          </div>
          
          {/* App name */}
          <h1 className="auth-app-name">NEUROLEX</h1>
          
          {/* Description - Different content based on current page */}
          {isRegisterPage ? (
            <div className="auth-description">
              <h2 className="auth-section-title">Admin Management</h2>
              
              <p className="auth-description-text">
                This section is reserved for authorized administrators only. As an administrator, 
                you have access to powerful tools to manage the Neurolex platform, including:
              </p>
              
              <ul className="auth-feature-list">
                <li>User account management</li>
                <li>Professional verification</li>
                <li>Content moderation</li>
                <li>System settings</li>
                <li>Report generation</li>
              </ul>
              
              <p className="auth-description-text">
                Please ensure you follow all security protocols and respect user privacy when
                performing administrative tasks.
              </p>
            </div>
          ) : (
            <div className="auth-description">
              <p className="auth-description-title">
                Neurolex is an <strong>AI-powered</strong> system that uses Natural Language Processing (NLP) 
                to analyze your journal entries and track your emotional well-being.
              </p>
              
              <p className="auth-description-text">
                It provides insights into your mental state, helping you understand your thoughts
                and feelings over time. With continuous monitoring, Neurolex supports your
                journey toward self-awareness, emotional growth, and overall well-being.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminAuthLayout;