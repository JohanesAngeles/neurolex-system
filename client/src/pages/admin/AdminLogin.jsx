// client/src/pages/admin/AdminLogin.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import AdminAuthLayout from '../../components/admin/layout/AdminAuthLayout';
import '../../styles/components/admin/AdminAuth.css';
import neuroLexLogo from '../../assets/images/Neurolex_Logo_New.png';

// Icons (SVG icons directly embedded)
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

const AdminLogin = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [formErrors, setFormErrors] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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

  const handleRememberMe = (e) => {
    setRememberMe(e.target.checked);
  };

  // Validate email format
  const validateEmail = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) return "Email is required";
    if (!regex.test(email)) return "Please enter a valid email address";
    return "";
  };

  // Validate password
  const validatePassword = (password) => {
    if (!password) return "Password is required";
    return "";
  };

  // Validate form before submission
  const validateForm = () => {
    const errors = {
      email: validateEmail(formData.email),
      password: validatePassword(formData.password)
    };
    
    setFormErrors(errors);
    return !errors.email && !errors.password;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form inputs
    if (!validateForm()) return;
    
    setIsLoading(true);
    setError('');

    try {
      console.log('🔧 Attempting admin login with:', { email: formData.email });
      
      // 🔧 FIX 1: Use the admin-specific endpoint from your authController
      const response = await axios.post('/api/auth/admin-login', formData);
      
      console.log('🔧 Login response:', response.data);
      
      if (response.data.success) {
        const { token, user } = response.data;
        
        // 🔧 FIX 2: Store using the same keys your auth system expects
        localStorage.setItem('token', token); // Use 'token', not 'adminToken'
        localStorage.setItem('user', JSON.stringify(user)); // Use 'user', not 'adminUser'
        
        // Set token expiry
        if (rememberMe) {
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + 30); // 30 days
          localStorage.setItem('tokenExpiry', expiryDate.toISOString());
        } else {
          const expiryDate = new Date();
          expiryDate.setHours(expiryDate.getHours() + 12); // 12 hours
          localStorage.setItem('tokenExpiry', expiryDate.toISOString());
        }
        
        // 🔧 FIX 3: Set up axios default header for future requests
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        console.log('🔧 Token and user stored successfully');
        console.log('🔧 User role:', user.role);
        
        // 🔧 FIX 4: Add small delay before navigation to ensure auth state is set
        setTimeout(() => {
          if (user.role === 'admin') {
            console.log('🔧 Navigating to admin dashboard');
            navigate('/admin', { replace: true });
          } else {
            console.log('🔧 User is not admin, role:', user.role);
            setError('Access denied. Admin privileges required.');
          }
        }, 100);
        
      } else {
        console.log('❌ Login failed:', response.data.message);
        setError(response.data.message || 'Login failed');
      }
    } catch (error) {
      console.error('❌ Admin login error:', error);
      
      // Better error handling
      if (error.response) {
        const errorMessage = error.response.data?.message || 'Login failed';
        console.log('❌ Server error:', errorMessage);
        setError(errorMessage);
      } else if (error.request) {
        console.log('❌ Network error');
        setError('Network error. Please check your connection.');
      } else {
        console.log('❌ Unexpected error:', error.message);
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 🔧 TEMPORARILY DISABLED: Auto-redirect check to fix loop
  // React.useEffect(() => {
  //   const checkExistingAuth = () => {
  //     const token = localStorage.getItem('token');
  //     const userStr = localStorage.getItem('user');
  //     
  //     if (token && userStr) {
  //       try {
  //         const user = JSON.parse(userStr);
  //         if (user.role === 'admin') {
  //           console.log('🔧 Admin already logged in, redirecting to dashboard');
  //           navigate('/admin', { replace: true });
  //         }
  //       } catch (err) {
  //         console.log('❌ Error parsing stored user data:', err);
  //         // Clear invalid data
  //         localStorage.removeItem('token');
  //         localStorage.removeItem('user');
  //       }
  //     }
  //   };
  //   
  //   checkExistingAuth();
  // }, [navigate]);

  // Login form content
  const loginForm = (
    <div className="form-container">
      <div className="form-content-container"> 
      <img 
        src= {neuroLexLogo}
        alt="Neurolex" 
        className="app-logo-small" 
      />
      
      <h1 className="form-title">WELCOME BACK</h1>
      
      <p className="form-subtitle">
        Monitor your progress, understand your emotions, and improve your
        well-being with personalized mental health insights through AI
      </p>
      
      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="admin-form-group">
          <label htmlFor="email" className="admin-form-label">Email Address</label>
          <input
            type="email"
            id="email"
            name="email"
            placeholder="Enter Email Address"
            value={formData.email}
            onChange={handleChange}
            className={`admin-form-input ${formErrors.email ? 'input-error' : ''}`}
          />
          {formErrors.email && <div className="error-message">{formErrors.email}</div>}
        </div>
        
        <div className="admin-form-group">
          <label htmlFor="password" className="admin-form-label">Password</label>
          <div className="password-input-container">
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              name="password"
              placeholder="Enter Password"
              value={formData.password}
              onChange={handleChange}
              className={`admin-form-input ${formErrors.password ? 'input-error' : ''}`}
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
        
        <div className="remember-forgot-container">
         <div className="checkbox-container">
          <input
            type="checkbox"
            id="rememberMe"
            checked={rememberMe}
            onChange={handleRememberMe}
            className="checkbox-input"
          />
          <span className="custom-checkbox"></span>
          <label htmlFor="rememberMe" className="checkbox-label">Remember me</label>
        </div>
          
          <Link to="/admin/forgot-password" className="forgot-password-link">
            Forgot Password?
          </Link>
        </div>
        
        <button 
          type="submit" 
          className="admin-form-button" 
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="loading-spinner"></span>
          ) : (
            'Sign In'
          )}
        </button>
        
        {/* Only add this section if admins can register themselves or if superadmins can navigate to register page */}
        <div className="account-link-container">
          <span className="account-link-text">Don't have an account?</span>
          <Link to="/admin/register" className="account-link">Sign Up</Link>
        </div>
      </form>
      </div>
    </div>
  );

  return (
    <AdminAuthLayout>
      {loginForm}
    </AdminAuthLayout>
  );
};

export default AdminLogin;