import React from 'react';
import { useLocation } from 'react-router-dom';
import '../../styles/components/auth/auth_layout.css';
import logo from '../../assets/images/Neurolex_Logo_Gradient.png';
import logo2 from '../../assets/images/NeurolexLogo_White.png';

const AuthLayout = ({ children }) => {
  const location = useLocation();
  const path = location.pathname;
  
  // Dynamic content based on current path
  const getHeaderContent = () => {
    switch (path) {
      case '/login':
        return {
          indicator: 'SIGN IN',
          title: 'WELCOME BACK!',
          subtitle: 'Monitor your progress, understand your emotions, and improve your well-being with personalized mental health insights through AI.'
        };
      case '/register':
        return {
          indicator: 'SIGN UP',
          title: 'WELCOME',
          subtitle: 'Monitor your progress, understand your emotions, and improve your well-being with personalized mental health insights through AI.'
        };
      case '/verify-email':
        const email = location.state?.email || 'your email';
        return {
          indicator: 'OTP',
          title: 'ENTER VERIFICATION CODE',
          subtitle: `Please check your inbox at ${email} and enter the 6-digit code below to verify your account.`
        };
      
        case '/forgot-password':
          return {
            indicator: 'FORGOT PASSWORD',
            title: 'RESET YOUR PASSWORD',
            subtitle: 'Enter your email address to receive a verification code and reset your password.'
          };
      default:
        return {
          indicator: '',
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
          <div className="auths-form-container">  {/* i made this auths for a reason of inherting the other design */}
            <div className="auth-header">
              <img src={logo} alt="App Logo" className="auth-logo" />
              <div className="auth-indicator">{headerContent.indicator}</div>
            </div>
            
            <div className="auth-titles">
              <h1 className="auth-title">{headerContent.title}</h1>
              <p className="auth-subtitle">{headerContent.subtitle}</p>
            </div>
            
            {/* Dynamic form content passed as children */}
            {children}
          </div>
        </div>
        
        {/* Right column - Decorative content */}
  
        <div className="auth-decorative-column">
        <img src={logo2} alt="App Logo" className="auth-logo2" />
          <h1 className="header-neurolex">NEUROLEX</h1>
          <p className="abt-neurolex">
            Neurolex is an AI-powered system that uses Natural Language Processing (NLP) 
            to analyze your journal entries and track your emotional well-being. 
            It provides insights into your mental state, helping you understand your 
            thoughts and feelings over time. With continuous monitoring, Neurolex supports 
            your journey toward self-awareness, emotional growth, and overall well-being.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;