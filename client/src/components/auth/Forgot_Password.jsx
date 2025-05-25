import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import AuthLayout from '../../layouts/auth/authLayout';
import authService from '../../services/authService';
import '../../styles/others/ForgotPassword.css';


const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSendCode = async (e) => {
    e.preventDefault();
    
    if (!email) {
      setError('Email is required');
      return;
    }
    
    setIsLoading(true);
    
    try {
      await authService.forgotPassword(email);
      setIsCodeSent(true);
      toast.success('Verification code sent to your email');
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Failed to send verification code';
      toast.error(errorMsg);
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    
    // Validate inputs
    if (!verificationCode) {
      setError('Verification code is required');
      return;
    }
    
    if (!newPassword) {
      setError('New password is required');
      return;
    }
    
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // First verify the code
      await authService.verifyResetCode(email, verificationCode);
      
      // Then reset the password
      await authService.resetPassword(email, verificationCode, newPassword, confirmPassword);
      
      toast.success('Password reset successfully');
      navigate('/login');
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Failed to reset password';
      toast.error(errorMsg);
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setIsLoading(true);
    try {
      await authService.forgotPassword(email);
      toast.success('Verification code resent to your email');
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Failed to resend verification code';
      toast.error(errorMsg);
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setIsCodeSent(false);
    setVerificationCode('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
  };

  return (
    <AuthLayout>
      <div className="forgot-password-container">
        <h2 className="auth-title">{isCodeSent ? '' : ''}</h2>
        <p className="auth-subtitle">
          {isCodeSent 
            ? '' 
            : ''}
        </p>
        
        {!isCodeSent ? (
          <form onSubmit={handleSendCode} className="forgot-password-form">
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                placeholder="Enter your email address"
                className="form-control"
                disabled={isLoading}
              />
              {error && <div className="error-message">{error}</div>}
            </div>
            
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
            >
              {isLoading ? 'Sending...' : 'Send Verification Code'}
            </button>
            
            <div className="auth-footer">
              <p>Remember your password? <Link to="/login">Sign In</Link></p>
            </div>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="reset-password-form">
            <div className="form-group">
              <label htmlFor="code">Verification Code</label>
              <input
                type="text"
                id="code"
                value={verificationCode}
                onChange={(e) => {
                  setVerificationCode(e.target.value);
                  setError('');
                }}
                placeholder="Enter verification code"
                className="form-control"
                disabled={isLoading}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="newPassword">New Password</label>
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setError('');
                }}
                placeholder="Enter new password"
                className="form-control"
                disabled={isLoading}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm New Password</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError('');
                }}
                placeholder="Confirm new password"
                className="form-control"
                disabled={isLoading}
              />
              {error && <div className="error-message">{error}</div>}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
            >
              {isLoading ? 'Resetting...' : 'Reset Password'}
            </button>
            
            <div className="auth-actions">
              <button 
                type="button" 
                className="btn btn-link" 
                onClick={handleResendCode}
                disabled={isLoading}
              >
                Resend Code
              </button>
              <button 
                type="button" 
                className="btn btn-link" 
                onClick={handleBack}
                disabled={isLoading}
              >
                Back
              </button>
            </div>
            
            <div className="auth-footer">
              <p>Remember your password? <Link to="/login">Sign In</Link></p>
            </div>
          </form>
        )}
      </div>
    </AuthLayout>
  );
};

export default ForgotPassword;