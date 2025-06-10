import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../../styles/components/auth/auth_layout.css';
import logo from '../../assets/images/Neurolex_Logo_New.png';
import logo2 from '../../assets/images/NeurolexLogo_White.png';

const AuthLayout = ({ children, showProfessionalSection = false }) => {
  const location = useLocation();
  const path = location.pathname;
  
  // Dynamic content based on current path
  const getHeaderContent = () => {
    switch (path) {
      case '/login':
        return {
          title: 'WELCOME BACK!',
          subtitle: 'Monitor your progress, understand your emotions, and improve your well-being with personalized mental health insights through AI.'
        };
      case '/register':
        return {
          title: 'WELCOME',
          subtitle: 'Monitor your progress, understand your emotions, and improve your well-being with personalized mental health insights through AI.'
        };
      case '/verify-email':
        const email = location.state?.email || 'your email';
        return {
          title: 'ENTER VERIFICATION CODE',
          subtitle: `Please check your inbox at ${email} and enter the 6-digit code below to verify your account.`
        };
      case '/forgot-password':
        return {
          title: 'RESET YOUR PASSWORD',
          subtitle: 'Enter your email address to receive a verification code and reset your password.'
        };
      default:
        return {
          title: '',
          subtitle: ''
        };
    }
  };
  
  const headerContent = getHeaderContent();

  return (
    <div className="auth-layout">
      <div className="auth-columns">
        {/* Left column - Form content */}
        <div className="auth-form-column">
          {/* Main content container - header, titles, and form */}
          <div className="auth-content">
            <div className="auth-header">
              <img src={logo} alt="App Logo" className="auth-logo" />
            </div>
            
            <div className="auth-titles">
              <h1 className="auth-title">{headerContent.title}</h1>
              <p className="auth-subtitle">{headerContent.subtitle}</p>
            </div>
            
            {/* Dynamic form content passed as children */}
            {children}
          </div>
          
          {/* Auth link at the bottom - only show on login and register pages */}
          {(path === '/login' || path === '/register') && (
            <div className="auth-link">
              {path === '/login' ? (
                <p>Don't have an account? <Link to="/register">Sign Up</Link></p>
              ) : (
                <p>Already have an account? <Link to="/login">Sign In</Link></p>
              )}
            </div>
          )}
        </div>
        
        {/* Right column - Decorative content */}
        <div className="auth-decorative-column">
          <img src={logo2} alt="App Logo" className="auth-logo2" />
          <h1 className="header-neurolex">NEUROLEX</h1>
          <p className="abt-neurolex">
            Neurolex is an <span className='abt-neurolex-span'>AI-powered</span>  system that helps you monitor and understand your patients’ emotional well-being. Using Natural Language Processing (NLP), it analyzes journal entries to detect emotional patterns and mental health trends, enabling early intervention and more informed, personalized care.
          </p>
          
          {/* Professional Registration Section - only show on login page */}
          {showProfessionalSection && (
            <div className="professional-registration-right">
              <div className="professional-info-right">
                <Link to="/doctor-register" className="professional-link-right">
                  Register as a Professional
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;