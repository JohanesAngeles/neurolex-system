import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import AuthLayout from '../../layouts/auth/authLayout';
import doctorAuthService from '../../services/doctorAuthService';
import '../../styles/components/auth/auth_forms.css';
import '../../styles/components/doctor/doctor_auth.css';

const DoctorForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email) {
      setError('Email is required');
      return;
    }
    
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    setError('');
    setIsLoading(true);
    
    try {
      const response = await doctorAuthService.forgotPassword(email);
      
      setSuccess(true);
      toast.success('Password reset instructions sent to your email!');
    } catch (error) {
      console.error('Forgot password error:', error);
      
      let errorMsg = 'Failed to process your request. Please try again.';
      
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
        <form onSubmit={handleSubmit} className="doctor-auth-form">
          <h2 className="doctor-form-title">Reset Your Password</h2>
          
          {!success ? (
            <>
              <p className="doctor-form-subtitle">
                Enter your email address and we'll send you instructions to reset your password.
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
                  disabled={isLoading}
                />
              </div>
              
              <button
                type="submit"
                className="doctor-auth-button"
                disabled={isLoading}
              >
                {isLoading ? 'Sending...' : 'Send Reset Instructions'}
              </button>
            </>
          ) : (
            <div className="doctor-success-message">
              <div className="doctor-success-icon">✓</div>
              <p>We've sent password reset instructions to {email}.</p>
              <p>Please check your email inbox and follow the instructions.</p>
            </div>
          )}
          
          <div className="doctor-auth-link">
            <p>Remember your password? <Link to="/doctor/login" className="doctor-link">Back to Login</Link></p>
          </div>
        </form>
      </div>
    </AuthLayout>
  );
};

export default DoctorForgotPassword;