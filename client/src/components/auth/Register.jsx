import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import authService from '../../services/authService';
import AuthLayout from '../../layouts/auth/authLayout';
import '../../styles/components/auth/auth_forms.css';

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    termsAccepted: false,
    role: 'patient', // Fixed as patient - doctor registration removed
    // Multi-tenant support
    tenantId: ''
  });
  
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  // Added for multi-tenant support
  const [tenants, setTenants] = useState([]);
  const [isLoadingTenants, setIsLoadingTenants] = useState(false);
  
  const { 
    firstName, lastName, email, password, confirmPassword, termsAccepted, tenantId
  } = formData;
  
  // Fetch available tenants (clinics) on component mount - Updated to use fetchActiveTenants
  useEffect(() => {
    const fetchClinics = async () => {
      // Only fetch tenants if multi-tenant is enabled
      if (process.env.REACT_APP_ENABLE_MULTI_TENANT === 'true') {
        try {
          setIsLoadingTenants(true);
          // Use the new fetchActiveTenants method instead of getTenants
          const activeTenants = await authService.fetchActiveTenants();
          setTenants(activeTenants || []);
          
          // Auto-select first tenant if only one exists
          if (activeTenants && activeTenants.length === 1) {
            setFormData(prev => ({
              ...prev,
              tenantId: activeTenants[0]._id
            }));
          }
        } catch (error) {
          console.error('Error fetching clinics:', error);
          // We don't show an alert here to avoid disrupting the UX
        } finally {
          setIsLoadingTenants(false);
        }
      }
    };
    
    fetchClinics();
  }, []);
  
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
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
    
    if (!firstName.trim()) {
      newErrors.firstName = 'First name is required';
    } else if (firstName.trim().length < 2) {
      newErrors.firstName = 'First name must be at least 2 characters';
    }
    
    if (!lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    } else if (lastName.trim().length < 2) {
      newErrors.lastName = 'Last name must be at least 2 characters';
    }
    
    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*])/.test(password)) {
      newErrors.password = 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character';
    }
    
    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    if (!termsAccepted) {
      newErrors.termsAccepted = 'You must accept the terms and conditions';
    }
    
    // Validate tenant selection if multi-tenant is enabled
    if (process.env.REACT_APP_ENABLE_MULTI_TENANT === 'true' && tenants.length > 0 && !tenantId) {
      newErrors.tenantId = 'Please select a clinic';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    try {
      setLoading(true);
      
      // Create the registration data to send to the server
      const registrationData = {
        firstName,
        lastName,
        email,
        password,
        termsAccepted,
        role: 'patient' // Always set to patient
      };
      
      // Add tenant ID if multi-tenant is enabled
      if (process.env.REACT_APP_ENABLE_MULTI_TENANT === 'true' && tenantId) {
        registrationData.tenantId = tenantId;
      }
      
      const response = await authService.register(registrationData);
      
      if (response.token) {
        localStorage.setItem('token', response.token);
      }
      
      // For patients, continue with the regular verification flow
      navigate('/verify-email', { 
        state: process.env.REACT_APP_ENABLE_MULTI_TENANT === 'true'
          ? { email: formData.email, tenantId: tenantId }
          : { email: formData.email }
      });
      
    } catch (error) {
      console.error('Registration error:', error);
      
      if (error.response && error.response.data && error.response.data.errors) {
        const serverErrors = {};
        error.response.data.errors.forEach(err => {
          serverErrors[err.field] = err.message;
        });
        setErrors(serverErrors);
      } else {
        alert(error.response?.data?.message || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      setLoading(true);
      
      if (!credentialResponse.credential) {
        throw new Error('No credential received from Google');
      }
      
      // Include tenantId for Google auth if multi-tenant is enabled
      const payload = process.env.REACT_APP_ENABLE_MULTI_TENANT === 'true' && tenantId
        ? { credential: credentialResponse.credential, tenantId }
        : credentialResponse.credential;
      
      const response = await authService.googleAuth(payload);
      
      localStorage.setItem('token', response.token);
      
      // Store tenant info if provided
      if (response.tenant) {
        localStorage.setItem('tenant', JSON.stringify(response.tenant));
      }
      
      navigate('/dashboard');
      
    } catch (error) {
      console.error('Google auth error:', error);
      alert(error.response?.data?.message || 'Google authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleGoogleFailure = (error) => {
    console.error('Google sign-in error:', error);
    alert('Google sign-in was unsuccessful. Please try again.');
  };
  
  const toggleTermsModal = () => {
    setShowTermsModal(!showTermsModal);
  };
  
  const togglePrivacyModal = () => {
    setShowPrivacyModal(!showPrivacyModal);
  };
  
  // Check if multi-tenant is enabled and we have tenants
  const showTenantSelector = process.env.REACT_APP_ENABLE_MULTI_TENANT === 'true' && tenants.length > 0;
  
  return (
    <AuthLayout>
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2 className="form-title">Create Your Account</h2>
        <p className="form-subtitle">Sign up to start your mental health journey</p>
        
        {/* Clinic selection dropdown - only show if multi-tenant is enabled */}
        {showTenantSelector && (
          <div className="form-group">
            <label htmlFor="tenantId">Select Clinic</label>
            <select
              id="tenantId"
              name="tenantId"
              value={tenantId}
              onChange={handleChange}
              className={errors.tenantId ? 'error' : ''}
              disabled={loading || isLoadingTenants}
            >
              <option value="">-- Select Clinic --</option>
              {tenants.map(tenant => (
                <option key={tenant._id} value={tenant._id}>
                  {tenant.name}
                </option>
              ))}
            </select>
            {errors.tenantId && <span className="error-message">{errors.tenantId}</span>}
          </div>
        )}
        
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="firstName">First Name</label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              placeholder="Enter First Name"
              value={firstName}
              onChange={handleChange}
              className={errors.firstName ? 'error' : ''}
            />
            {errors.firstName && <span className="error-message">{errors.firstName}</span>}
          </div>
          
          <div className="form-group">
            <label htmlFor="lastName">Last Name</label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              placeholder="Enter Last Name"
              value={lastName}
              onChange={handleChange}
              className={errors.lastName ? 'error' : ''}
            />
            {errors.lastName && <span className="error-message">{errors.lastName}</span>}
          </div>
        </div>
        
        <div className="form-group">
          <label htmlFor="email">Email Address</label>
          <input
            type="email"
            id="email"
            name="email"
            placeholder="Enter Email Address"
            value={email}
            onChange={handleChange}
            className={errors.email ? 'error' : ''}
          />
          {errors.email && <span className="error-message">{errors.email}</span>}
        </div>
        
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            placeholder="Enter Password"
            value={password}
            onChange={handleChange}
            className={errors.password ? 'error' : ''}
          />
          {errors.password && <span className="error-message">{errors.password}</span>}
          
          {/* Password strength indicator */}
          {password && (
            <div className="password-strength">
              <div className={`strength-bar ${
                password.length >= 8 && 
                /[A-Z]/.test(password) && 
                /[a-z]/.test(password) && 
                /[0-9]/.test(password) && 
                /[^A-Za-z0-9]/.test(password) 
                  ? 'strong' 
                  : password.length >= 6 ? 'medium' : 'weak'
              }`}></div>
              <span>{
                password.length >= 8 && 
                /[A-Z]/.test(password) && 
                /[a-z]/.test(password) && 
                /[0-9]/.test(password) && 
                /[^A-Za-z0-9]/.test(password) 
                  ? 'Strong' 
                  : password.length >= 6 ? 'Medium' : 'Weak'
              }</span>
            </div>
          )}
        </div>
        
        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm Password</label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={handleChange}
            className={errors.confirmPassword ? 'error' : ''}
          />
          {errors.confirmPassword && <span className="error-message">{errors.confirmPassword}</span>}
        </div>
        
        <div className="form-group checkbox-group">
          <input
            type="checkbox"
            id="termsAccepted"
            name="termsAccepted"
            checked={termsAccepted}
            onChange={handleChange}
          />
          <label htmlFor="termsAccepted">
            I accept the <span className="link" onClick={toggleTermsModal}>Terms of Use</span> and <span className="link" onClick={togglePrivacyModal}>Privacy Policy</span>
          </label>
          {errors.termsAccepted && <span className="error-message">{errors.termsAccepted}</span>}
        </div>
        
        <button type="submit" className="auth-button" disabled={loading}>
          {loading ? 'Signing Up...' : 'Sign Up'}
        </button>
        
        {/* Google Authentication */}
        <div className="divider">
          <span>OR</span>
        </div>
        
        <div className="google-auth">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleFailure}
            type="icon" 
          />
          <span>Sign up with Google</span>
        </div>

        <div className="auth-link">
          Already have an account? <Link to="/login">Sign In</Link>
        </div>
        
        {/* Professional Registration Link */}
        <div className="professional-registration">
          <div className="divider">
            <span>For Healthcare Professionals</span>
          </div>
          <div className="professional-info">
            <p>Are you a mental health professional looking to join our network?</p>
            <Link to="/doctor-register" className="professional-link">
              Register as a Professional
            </Link>
          </div>
        </div>
      </form>
      
      {/* Terms of Use Modal */}
      {showTermsModal && (
        <div className="modal">
          <div className="modal-content">
            <span className="close" onClick={toggleTermsModal}>&times;</span>
            <h2>Terms of Use</h2>
            <div className="modal-body">
              <p>These Terms of Use constitute a legally binding agreement made between you and our company.</p>
              <p>By creating an account, you agree to abide by these Terms of Use.</p>
            </div>
            <button onClick={toggleTermsModal}>Close</button>
          </div>
        </div>
      )}
      
      {/* Privacy Policy Modal */}
      {showPrivacyModal && (
        <div className="modal">
          <div className="modal-content">
            <span className="close" onClick={togglePrivacyModal}>&times;</span>
            <h2>Privacy Policy</h2>
            <div className="modal-body">
              <p>Your privacy is important to us. This Privacy Policy explains how we collect, use, and protect your personal information.</p>
            </div>
            <button onClick={togglePrivacyModal}>Close</button>
          </div>
        </div>
      )}
    </AuthLayout>
  );
};

export default Register;