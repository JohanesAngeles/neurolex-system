import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import AuthLayout from '../../layouts/auth/authLayout';
import doctorAuthService from '../../services/doctorAuthService';
import '../../styles/components/auth/auth_forms.css';
import '../../styles/components/doctor/doctor_auth.css';

const DoctorResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  
  const [formData, setFormData] = useState({
    email: query.get('email') || '',
    code: query.get('code') || '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [isCodeVerified, setIsCodeVerified] = useState(false);
  
  useEffect(() => {
    // Verify the reset code if email and code are provided in URL
    const verifyCode = async () => {
      if (formData.email && formData.code) {
        setIsLoading(true);
        try {
          await doctorAuthService.verifyResetCode(formData.email, formData.code);
          setIsCodeVerified(true);
        } catch (error) {
          console.error('Code verification error:', error);
          
          let errorMsg = 'Invalid or expired reset code.';
          if (error.response?.data?.message) {
            errorMsg = error.response.data.message;
          }
          
          setErrors({ code: errorMsg });
          toast.error(errorMsg);
        } finally {
          setIsLoading(false);
        }
      }
    };
    
    verifyCode();
  }, [formData.email, formData.code]);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    
    // Clear error when user types
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: ''
      });
    }
  };
  
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (formData.newPassword.length < 8) {
      newErrors.newPassword = 'Password must be at least 8 characters';
    } else if (!/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*])/.test(formData.newPassword)) {
      newErrors.newPassword = 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character';
    }
    
    if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    
    try {
      const response = await doctorAuthService.resetPassword(
        formData.email,
        formData.code,
        formData.newPassword,
        formData.confirmPassword
      );
      
      toast.success('Password reset successful! You can now log in with your new password.');
      navigate('/doctor/login');
      
    } catch (error) {
      console.error('Password reset error:', error);
      
      let errorMsg = 'Failed to reset password. Please try again.';
      
      if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!formData.email || !formData.code) {
    return (
      <AuthLayout>
        <div className="doctor-auth-form-container">
          <div className="doctor-auth-form">
            <h2 className="doctor-form-title">Invalid Reset Link</h2>
            <p className="doctor-form-subtitle">
              The password reset link is invalid or expired. Please try requesting a new password reset.
            </p>
            <button
              className="doctor-auth-button"
              onClick={() => navigate('/doctor/forgot-password')}
            >
              Return to Forgot Password
            </button>
          </div>
        </div>
      </AuthLayout>
    );
  }
  
  if (!isCodeVerified && !errors.code) {
    return (
      <AuthLayout>
        <div className="doctor-auth-form-container">
          <div className="doctor-auth-form">
            <h2 className="doctor-form-title">Verifying Reset Code</h2>
            <p className="doctor-form-subtitle">
              Please wait while we verify your reset code...
            </p>
            <div className="doctor-loading-spinner"></div>
          </div>
        </div>
      </AuthLayout>
    );
  }
  
  return (
    <AuthLayout>
      <div className="doctor-auth-form-container">
        <form onSubmit={handleSubmit} className="doctor-auth-form">
          <h2 className="doctor-form-title">Reset Your Password</h2>
          <p className="doctor-form-subtitle">
            Enter your new password below
          </p>
          
          {errors.code && (
            <div className="doctor-error-alert">{errors.code}</div>
          )}
          
          <div className="doctor-form-group">
            <label htmlFor="newPassword">New Password</label>
            <input
              type="password"
              id="newPassword"
              name="newPassword"
              value={formData.newPassword}
              onChange={handleChange}
              placeholder="Enter new password"
              className={errors.newPassword ? 'doctor-input-error' : 'doctor-input'}
              disabled={isLoading}
            />
            {errors.newPassword && <div className="doctor-error-message">{errors.newPassword}</div>}
            
            {/* Password strength indicator */}
            {formData.newPassword && (
              <div className="doctor-password-strength">
                <div className={`doctor-strength-bar ${
                  formData.newPassword.length >= 8 && 
                  /[A-Z]/.test(formData.newPassword) && 
                  /[a-z]/.test(formData.newPassword) && 
                  /[0-9]/.test(formData.newPassword) && 
                  /[^A-Za-z0-9]/.test(formData.newPassword) 
                    ? 'doctor-strong' 
                    : formData.newPassword.length >= 6 ? 'doctor-medium' : 'doctor-weak'
                }`}></div>
                <span>{
                  formData.newPassword.length >= 8 && 
                  /[A-Z]/.test(formData.newPassword) && 
                  /[a-z]/.test(formData.newPassword) && 
                  /[0-9]/.test(formData.newPassword) && 
                  /[^A-Za-z0-9]/.test(formData.newPassword) 
                    ? 'Strong' 
                    : formData.newPassword.length >= 6 ? 'Medium' : 'Weak'
                }</span>
              </div>
            )}
          </div>
          
          <div className="doctor-form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Confirm new password"
              className={errors.confirmPassword ? 'doctor-input-error' : 'doctor-input'}
              disabled={isLoading}
            />
            {errors.confirmPassword && <div className="doctor-error-message">{errors.confirmPassword}</div>}
          </div>
          
          <button
            type="submit"
            className="doctor-auth-button"
            disabled={isLoading}
          >
            {isLoading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      </div>
    </AuthLayout>
  );
};

export default DoctorResetPassword;