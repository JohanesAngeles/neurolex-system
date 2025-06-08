import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { GoogleLogin } from '@react-oauth/google';
import authService from '../../services/authService';
import '../../styles/components/auth/auth_forms.css';
import AuthLayout from '../../layouts/auth/authLayout';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '/api';

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
    tenantId: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [tenants, setTenants] = useState([]);
  const [isLoadingTenants, setIsLoadingTenants] = useState(false);
  const [multiTenantEnabled, setMultiTenantEnabled] = useState(false);

  useEffect(() => {
    const fetchTenants = async () => {
      const isEnabled = process.env.REACT_APP_ENABLE_MULTI_TENANT === 'true';
      setMultiTenantEnabled(isEnabled);
      
      if (isEnabled) {
        try {
          setIsLoadingTenants(true);
          const response = await axios.get(`${API_URL}/tenants/public`);
          
          let tenantsData = [];
          if (response.data && response.data.data) {
            tenantsData = response.data.data;
          } else if (Array.isArray(response.data)) {
            tenantsData = response.data;
          } else if (response.data && response.data.success && Array.isArray(response.data.data)) {
            tenantsData = response.data.data;
          }
          
          if (Array.isArray(tenantsData) && tenantsData.length > 0) {
            setTenants(tenantsData);
            
            if (tenantsData.length === 1) {
              setFormData(prev => ({
                ...prev,
                tenantId: tenantsData[0]._id
              }));
            }
          } else {
            toast.warning('No clinics available. Please contact support.');
          }
        } catch (error) {
          toast.error('Failed to load clinics. Please refresh the page.');
        } finally {
          setIsLoadingTenants(false);
        }
      }
    };
    
    fetchTenants();
  }, []);

  const handleChange = (e) => {
    const { name, value, checked, type } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
    
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
    
    if (multiTenantEnabled && tenants.length > 0 && !formData.tenantId) {
      newErrors.tenantId = 'Please select a clinic';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    
    try {
      const loginPayload = multiTenantEnabled
        ? { ...formData }
        : { email: formData.email, password: formData.password, rememberMe: formData.rememberMe };
      
      const loginResponse = await axios.post(`${API_URL}/auth/login`, loginPayload);
      const response = loginResponse.data;
      
      if (formData.rememberMe) {
        localStorage.setItem('token', response.token);
        if (response.tenant) {
          localStorage.setItem('tenant', JSON.stringify(response.tenant));
        }
        if (response.user) {
          localStorage.setItem('user', JSON.stringify(response.user));
        }
      } else {
        sessionStorage.setItem('token', response.token);
        if (response.tenant) {
          sessionStorage.setItem('tenant', JSON.stringify(response.tenant));
        }
        if (response.user) {
          sessionStorage.setItem('user', JSON.stringify(response.user));
        }
      }
      
      toast.success('Login successful!');
      
      if (response.user && response.user.role) {
        if (response.user.role === 'doctor') {
          navigate('/doctor');
        } else if (response.user.role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/dashboard');
        }
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      let errorMsg = 'Login failed. Please try again.';
      
      if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      toast.error(errorMsg);
      
      if (error.response?.data?.notVerified) {
        navigate('/verify-email', { 
          state: multiTenantEnabled
            ? { email: formData.email, tenantId: formData.tenantId }
            : { email: formData.email }
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async (credentialResponse) => {
    try {
      setIsLoading(true);
      
      const payload = multiTenantEnabled && formData.tenantId
        ? { credential: credentialResponse.credential, tenantId: formData.tenantId }
        : credentialResponse.credential;
      
      const response = await authService.googleAuth(payload);
      
      localStorage.setItem('token', response.token);
      
      if (response.tenant) {
        localStorage.setItem('tenant', JSON.stringify(response.tenant));
      }
      
      toast.success('Google login successful!');
      navigate('/dashboard');
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Google login failed. Please try again.';
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const showTenantSelector = multiTenantEnabled && tenants.length > 0;

  return (
    <AuthLayout showProfessionalSection={true}>
      <form onSubmit={handleSubmit} className="auth-form">
        {showTenantSelector && (
          <div className="form-group">
            <label htmlFor="tenantId">Select Clinic</label>
            <select
              id="tenantId"
              name="tenantId"
              value={formData.tenantId}
              onChange={handleChange}
              className={errors.tenantId ? 'error' : ''}
              disabled={isLoading || isLoadingTenants}
            >
              <option value="">-- Select Clinic --</option>
              {tenants.map(tenant => (
                <option key={tenant._id} value={tenant._id}>
                  {tenant.name}
                </option>
              ))}
            </select>
            {errors.tenantId && <div className="error-message">{errors.tenantId}</div>}
            {isLoadingTenants && <div className="loading-message">Loading clinics...</div>}
          </div>
        )}
        
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Enter your email"
            className={errors.email ? 'error' : ''}
            disabled={isLoading}
          />
          {errors.email && <div className="error-message">{errors.email}</div>}
        </div>
        
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Enter your password"
            className={errors.password ? 'error' : ''}
            disabled={isLoading}
          />
          {errors.password && <div className="error-message">{errors.password}</div>}
        </div>
        
        <div className="form-options">
          <div className="form-group checkbox">
            <input
              type="checkbox"
              id="rememberMe"
              name="rememberMe"
              checked={formData.rememberMe}
              onChange={handleChange}
              disabled={isLoading}
            />
            <label className='remeberMe-label' htmlFor="rememberMe">Remember me</label>
          </div>
          <div className="forgot-link">
            <Link to="/forgot-password" className="link">Forgot password?</Link>
          </div>
        </div>
        
        <button
          type="submit"
          className="auth-button"
          disabled={isLoading}
        >
          {isLoading ? 'Signing in...' : 'Sign In'}
        </button>
        
        <div className="auth-link">
          <p>Don't have an account? <Link to="/register">Sign Up</Link></p>
        </div>
      </form>
    </AuthLayout>
  );
};

export default Login;