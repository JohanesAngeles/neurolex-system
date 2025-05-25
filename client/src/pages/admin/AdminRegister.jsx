// client/src/pages/admin/AdminRegister.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import AdminAuthLayout from '../../layouts/AdminAuthLayout';
import '../../styles/components/admin/AdminAuth.css';

// Icons (you can use any icon library or SVGs)
const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  </svg>
);

const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
    <line x1="1" y1="1" x2="23" y2="23"></line>
  </svg>
);

const ArrowLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"></line>
    <polyline points="12 19 5 12 12 5"></polyline>
  </svg>
);

const AdminRegister = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'admin' // Default role
  });
  
  const [formErrors, setFormErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Check if the current user is authorized to create admin accounts
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('adminToken');
        if (!token) {
          setError('You must be logged in as an admin to register new admin accounts');
          return;
        }

        const response = await axios.get('/api/admin/check-auth', {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.data.success && response.data.isAdmin) {
          setIsAuthorized(true);
        } else {
          setError('You do not have permission to register new admin accounts');
        }
      } catch (error) {
        console.error('Auth check error:', error);
        setError('Authentication error. Please log in again.');
      }
    };

    checkAuth();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    
    // Clear error when typing
    if (formErrors[name]) {
      setFormErrors({
        ...formErrors,
        [name]: ''
      });
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  // Validate form inputs
  const validateForm = () => {
    const errors = {};
    
    // Validate name
    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }
    
    // Validate email
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    // Validate password
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    } else if (!/[A-Z]/.test(formData.password)) {
      errors.password = 'Password must contain at least one uppercase letter';
    } else if (!/[a-z]/.test(formData.password)) {
      errors.password = 'Password must contain at least one lowercase letter';
    } else if (!/[0-9]/.test(formData.password)) {
      errors.password = 'Password must contain at least one number';
    } else if (!/[^A-Za-z0-9]/.test(formData.password)) {
      errors.password = 'Password must contain at least one special character';
    }
    
    // Validate confirm password
    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check authorization
    if (!isAuthorized) {
      setError('You do not have permission to register new admin accounts');
      return;
    }
    
    // Validate form inputs
    if (!validateForm()) return;
    
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('adminToken');
      
      // Register new admin
      const response = await axios.post('/api/admin/accounts', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setSuccess('Admin account created successfully!');
        // Reset form
        setFormData({
          name: '',
          email: '',
          password: '',
          confirmPassword: '',
          role: 'admin'
        });
        
        // Redirect after 2 seconds
        setTimeout(() => {
          navigate('/admin/accounts');
        }, 2000);
      }
    } catch (error) {
      console.error('Admin registration error:', error);
      setError(error.response?.data?.message || 'Failed to create admin account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Register form content
  const registerForm = (
    <div className="form-container">
      <Link to="/admin/login" className="back-button">
        <ArrowLeftIcon /> Back to Login
      </Link>
      
      <h1 className="form-title">Register Admin Account</h1>
      
      <p className="form-subtitle">
        Create a new administrator account for the Neurolex platform
      </p>
      
      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}
      
      {success && (
        <div className="alert alert-success">
          {success}
        </div>
      )}
      
      {!isAuthorized ? (
        <div className="alert alert-warning">
          You must be logged in as an admin with appropriate permissions to register new admin accounts.
          <Link to="/admin/login" className="alert-link">Go to Login</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name" className="form-label">Full Name</label>
            <input
              type="text"
              id="name"
              name="name"
              placeholder="Enter Full Name"
              value={formData.name}
              onChange={handleChange}
              className={`form-input ${formErrors.name ? 'input-error' : ''}`}
            />
            {formErrors.name && <div className="error-message">{formErrors.name}</div>}
          </div>
          
          <div className="form-group">
            <label htmlFor="email" className="form-label">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              placeholder="Enter Email Address"
              value={formData.email}
              onChange={handleChange}
              className={`form-input ${formErrors.email ? 'input-error' : ''}`}
            />
            {formErrors.email && <div className="error-message">{formErrors.email}</div>}
          </div>
          
          <div className="form-group">
            <label htmlFor="password" className="form-label">Password</label>
            <div className="password-input-container">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                placeholder="Enter Password"
                value={formData.password}
                onChange={handleChange}
                className={`form-input ${formErrors.password ? 'input-error' : ''}`}
              />
              <button 
                type="button" 
                className="password-toggle-button"
                onClick={togglePasswordVisibility}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {formErrors.password && <div className="error-message">{formErrors.password}</div>}
          </div>
          
          <div className="form-group">
            <label htmlFor="confirmPassword" className="form-label">Confirm Password</label>
            <div className="password-input-container">
              <input
                type={showConfirmPassword ? "text" : "password"}
                id="confirmPassword"
                name="confirmPassword"
                placeholder="Confirm Password"
                value={formData.confirmPassword}
                onChange={handleChange}
                className={`form-input ${formErrors.confirmPassword ? 'input-error' : ''}`}
              />
              <button 
                type="button" 
                className="password-toggle-button"
                onClick={toggleConfirmPasswordVisibility}
              >
                {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {formErrors.confirmPassword && <div className="error-message">{formErrors.confirmPassword}</div>}
          </div>
          
          <div className="form-group">
            <label htmlFor="role" className="form-label">Admin Role</label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              className={`form-input ${formErrors.role ? 'input-error' : ''}`}
            >
              <option value="admin">Admin</option>
              <option value="superadmin">Super Admin</option>
            </select>
            <div className="form-help-text">
              Super Admins have elevated permissions including managing other admin accounts
            </div>
            {formErrors.role && <div className="error-message">{formErrors.role}</div>}
          </div>
          
          <button 
            type="submit" 
            className="form-button" 
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="loading-spinner"></span>
            ) : (
              'Create Admin Account'
            )}
          </button>
        </form>
      )}
    </div>
  );

  return (
    <AdminAuthLayout>
      {registerForm}
    </AdminAuthLayout>
  );
};

export default AdminRegister;