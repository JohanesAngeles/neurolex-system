// client/src/components/doctors/auth/DoctorLogin.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import DoctorAuthLayout from './DoctorAuthLayout';
import doctorAuthService from '../../services/doctorAuthService';
import '../../styles/components/doctor/doctor_auth.css';

const DoctorLogin = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value, checked, type } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
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
    
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    
    try {
      const response = await doctorAuthService.login(formData);
      
      toast.success('Login successful!');
      
      // Redirect to doctor dashboard
      navigate('/doctor/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      
      let errorMsg = 'Login failed. Please try again.';
      
      // Extract detailed error message if available
      if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      toast.error(errorMsg);
      
      // Handle specific error cases
      if (error.response?.data?.notVerified) {
        // If email not verified, navigate to verification page
        navigate('/doctor/verify-email', { 
          state: { email: formData.email }
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DoctorAuthLayout>
      <div className="doctor-auth-form-wrapper">
        <form onSubmit={handleSubmit} className="doctor-auth-form">
          <h2 className="doctor-form-title">Healthcare Professional Login</h2>
          <p className="doctor-form-subtitle">Welcome back! Please enter your credentials.</p>
          
          <div className="doctor-form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email"
              className={errors.email ? 'doctor-input-error' : 'doctor-input'}
              disabled={isLoading}
            />
            {errors.email && <div className="doctor-error-message">{errors.email}</div>}
          </div>
          
          <div className="doctor-form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              className={errors.password ? 'doctor-input-error' : 'doctor-input'}
              disabled={isLoading}
            />
            {errors.password && <div className="doctor-error-message">{errors.password}</div>}
          </div>
          
          <div className="doctor-form-options">
            <div className="doctor-form-group doctor-checkbox">
              <input
                type="checkbox"
                id="rememberMe"
                name="rememberMe"
                checked={formData.rememberMe}
                onChange={handleChange}
                disabled={isLoading}
              />
              <label className="doctor-remember-label" htmlFor="rememberMe">Remember me</label>
            </div>
            <div className="doctor-forgot-link">
              <Link to="/doctor/forgot-password" className="doctor-link">Forgot password?</Link>
            </div>
          </div>
          
          <button
            type="submit"
            className="doctor-auth-button"
            disabled={isLoading}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
          
          <div className="doctor-auth-link">
            <p>Don't have an account? <Link to="/doctor/register" className="doctor-link">Register as a Professional</Link></p>
          </div>
        </form>
      </div>
    </DoctorAuthLayout>
  );
};

export default DoctorLogin;