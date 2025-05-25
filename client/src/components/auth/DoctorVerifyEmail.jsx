import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import AuthLayout from '../../layouts/auth/authLayout';
import doctorAuthService from '../../services/doctorAuthService';
import '../../styles/components/auth/auth_forms.css';
import '../../styles/components/doctor/doctor_auth.css';

const DoctorVerifyEmail = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendDisabled, setResendDisabled] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    // Get email from location state
    if (location.state && location.state.email) {
      setEmail(location.state.email);
    }
  }, [location]);

  useEffect(() => {
    // Countdown for resend button
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && resendDisabled) {
      setResendDisabled(false);
    }
  }, [countdown, resendDisabled]);

  const handleVerify = async (e) => {
    e.preventDefault();
    
    if (!email) {
      setError('Email is required');
      return;
    }
    
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit verification code');
      return;
    }
    
    setError('');
    setIsLoading(true);
    
    try {
      const response = await doctorAuthService.verifyEmail(email, verificationCode);
      
      toast.success('Email verification successful!');
      
      // Redirect to doctor dashboard or profile completion
      navigate('/doctor/dashboard');
    } catch (error) {
      console.error('Verification error:', error);
      
      let errorMsg = 'Verification failed. Please try again.';
      
      if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!email) {
      setError('Email is required');
      // Continuing DoctorVerifyEmail.jsx
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      const response = await doctorAuthService.resendVerificationCode(email);
      
      toast.success('Verification code resent successfully!');
      
      // Disable resend button for 60 seconds
      setResendDisabled(true);
      setCountdown(60);
    } catch (error) {
      console.error('Resend code error:', error);
      
      let errorMsg = 'Failed to resend verification code. Please try again.';
      
      if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="doctor-auth-form-container">
        <form onSubmit={handleVerify} className="doctor-auth-form">
          <h2 className="doctor-form-title">Verify Your Email</h2>
          <p className="doctor-form-subtitle">
            A verification code has been sent to your email. 
            Please enter the 6-digit code below to verify your account.
          </p>
          
          {error && <div className="doctor-error-alert">{error}</div>}
          
          <div className="doctor-form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="doctor-input"
              disabled={isLoading || location.state?.email}
            />
          </div>
          
          <div className="doctor-form-group">
            <label htmlFor="verificationCode">Verification Code</label>
            <input
              type="text"
              id="verificationCode"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder="Enter 6-digit code"
              className="doctor-input"
              maxLength={6}
              disabled={isLoading}
            />
          </div>
          
          <button
            type="submit"
            className="doctor-auth-button"
            disabled={isLoading}
          >
            {isLoading ? 'Verifying...' : 'Verify Email'}
          </button>
          
          <div className="doctor-resend-container">
            <p>Didn't receive the code?</p>
            <button
              type="button"
              className="doctor-resend-button"
              onClick={handleResendCode}
              disabled={isLoading || resendDisabled}
            >
              {resendDisabled
                ? `Resend Code (${countdown}s)`
                : 'Resend Code'}
            </button>
          </div>
        </form>
      </div>
    </AuthLayout>
  );
};

export default DoctorVerifyEmail;