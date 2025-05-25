import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import AuthLayout from '../../layouts/auth/authLayout';
import '../../styles/components/auth/auth_forms.css';

const EmailVerification = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Get email from location state or query params
  const queryParams = new URLSearchParams(location.search);
  const emailFromQuery = queryParams.get('email');
  const tenantIdFromQuery = queryParams.get('tenantId');
  
  const email = location.state?.email || emailFromQuery;
  const tenantId = location.state?.tenantId || tenantIdFromQuery;
  
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resendDisabled, setResendDisabled] = useState(false);
  const [countdown, setCountdown] = useState(0);
  // Add tenant state for displaying clinic info
  const [tenant, setTenant] = useState(null);
  const [loadingTenant, setLoadingTenant] = useState(false);
  
  const inputRefs = useRef([]);

  useEffect(() => {
    console.log('Email verification component loaded with:', {
      email,
      tenantId,
      fromQuery: { emailFromQuery, tenantIdFromQuery },
      fromState: { emailFromState: location.state?.email, tenantIdFromState: location.state?.tenantId }
    });
    
    // Redirect if no email is available
    if (!email) {
      console.log('No email found, redirecting to register page');
      navigate('/register');
      return;
    }
    
    // Focus on first input when component mounts
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [email, tenantId, navigate, location, emailFromQuery, tenantIdFromQuery]);

  // Fetch tenant details using the public endpoint
  useEffect(() => {
    const fetchTenantDetails = async () => {
      // Only fetch if multi-tenant is enabled and tenantId is provided
      if (process.env.REACT_APP_ENABLE_MULTI_TENANT === 'true' && tenantId) {
        try {
          setLoadingTenant(true);
          
          // Get base URL from environment or use default
          const API_URL = process.env.REACT_APP_API_URL || '/api';
          
          console.log('Fetching tenant details from:', `${API_URL}/tenants/${tenantId}/public`);
          
          // Use the public endpoint instead of the protected one
          const response = await axios.get(`${API_URL}/tenants/${tenantId}/public`);
          
          console.log('Tenant details response:', response.data);
          
          if (response.data && response.data.data) {
            setTenant(response.data.data);
          }
        } catch (error) {
          console.error('Error fetching tenant details:', error);
          // Don't set error - non-critical functionality
        } finally {
          setLoadingTenant(false);
        }
      }
    };
    
    fetchTenantDetails();
  }, [tenantId]);

  useEffect(() => {
    // Handle countdown timer for resend button
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && resendDisabled) {
      setResendDisabled(false);
    }
  }, [countdown, resendDisabled]);

  const handleInputChange = (index, value) => {
    // Only allow numbers
    if (!/^\d*$/.test(value)) return;

    const newCode = [...verificationCode];
    newCode[index] = value;
    setVerificationCode(newCode);

    // Auto-focus next input if current input is filled
    if (value !== '' && index < 5) {
      inputRefs.current[index + 1].focus();
    }
    
    // Auto-submit if all fields are filled
    if (index === 5 && value !== '') {
      const allFilled = newCode.every(digit => digit !== '');
      if (allFilled) {
        setTimeout(() => handleVerify(), 500);
      }
    }
  };

  const handleKeyDown = (index, e) => {
    // Move to previous input on backspace when current input is empty
    if (e.key === 'Backspace' && verificationCode[index] === '' && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    
    // Check if pasted content is a 6-digit number
    if (/^\d{6}$/.test(pastedData)) {
      const digits = pastedData.split('');
      setVerificationCode(digits);
      
      // Focus on last input after paste
      inputRefs.current[5].focus();
      
      // Auto-submit after short delay
      setTimeout(() => handleVerify(), 500);
    }
  };

  const handleVerify = async () => {
    const code = verificationCode.join('');
    
    // Validate complete code
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }
  
    setLoading(true);
    setError('');
    
    try {
      // Get base URL from environment or use default
      const API_URL = process.env.REACT_APP_API_URL || '/api';
      
      console.log('Verifying email with:', {
        email,
        code,
        tenantId
      });
      
      // Create payload
      const payload = {
        email,
        code
      };
      
      // Add tenantId to payload if multi-tenant is enabled
      if (process.env.REACT_APP_ENABLE_MULTI_TENANT === 'true' && tenantId) {
        payload.tenantId = tenantId;
      }
      
      // Update the endpoint
      const response = await axios.post(`${API_URL}/auth/verify-email`, payload);
      
      console.log('Email verification response:', response.data);
      
      if (response.data.token) {
        console.log('Token received, saving to localStorage');
        localStorage.setItem('token', response.data.token);
        
        // Store user in localStorage
        if (response.data.user) {
          localStorage.setItem('user', JSON.stringify(response.data.user));
        }
        
        // Store tenant info if provided
        if (response.data.tenant) {
          localStorage.setItem('tenant', JSON.stringify(response.data.tenant));
        }
      } else {
        console.warn('No token received from verification response');
      }
      
      setSuccess(response.data.message || 'Email verification successful!');
      
      // Add a small delay to ensure token is saved before redirect
      setTimeout(() => {
        console.log('Redirecting to:', response.data.redirectTo || '/onboarding');
        navigate(response.data.redirectTo || '/onboarding');
      }, 1500);
    } catch (err) {
      console.error('Verification error:', err);
      console.error('Error response:', err.response?.data);
      
      // Check if we got a "new code sent" message
      if (err.response?.data?.newCodeSent) {
        setError('Code expired. A new verification code has been sent to your email.');
        // Reset verification code inputs
        setVerificationCode(['', '', '', '', '', '']);
        // Focus on first input
        inputRefs.current[0].focus();
      } else {
        setError(err.response?.data?.message || 'Verification failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResendDisabled(true);
    setCountdown(60); // 60 seconds cooldown
    setError('');
    
    try {
      // Get base URL from environment or use default
      const API_URL = process.env.REACT_APP_API_URL || '/api';
      
      console.log('Resending verification code to:', {
        email,
        tenantId
      });
      
      // Create payload
      const payload = { email };
      
      // Add tenantId to payload if multi-tenant is enabled
      if (process.env.REACT_APP_ENABLE_MULTI_TENANT === 'true' && tenantId) {
        payload.tenantId = tenantId;
      }
      
      const response = await axios.post(`${API_URL}/auth/resend-verification`, payload);
      
      console.log('Resend verification response:', response.data);
      
      setSuccess(response.data.message || 'New verification code sent. Please check your email.');
      
      // Reset verification code inputs
      setVerificationCode(['', '', '', '', '', '']);
      // Focus on first input
      inputRefs.current[0].focus();
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      console.error('Resend code error:', err);
      setError(err.response?.data?.message || 'Failed to resend code. Please try again later.');
    }
  };

  return (
    <AuthLayout>
      <div className="auth-form">
        <h2>Verify Your Email</h2>
        
        {/* Show tenant name if available */}
        {tenant && !loadingTenant && (
          <div className="tenant-info" style={{ 
            textAlign: 'center', 
            margin: '10px 0 20px',
            padding: '10px',
            borderRadius: '4px',
            backgroundColor: tenant.secondaryColor || '#f5f5f5',
            color: tenant.primaryColor || '#333'
          }}>
            <p>Verifying for: <strong>{tenant.name}</strong></p>
          </div>
        )}
        
        <p className="verification-subtitle">
          We've sent a 6-digit verification code to <strong>{email}</strong>
        </p>
        
        <div className="code-inputs">
          {verificationCode.map((digit, index) => (
            <input
              key={index}
              type="text"
              maxLength="1"
              value={digit}
              onChange={(e) => handleInputChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={index === 0 ? handlePaste : null}
              ref={(el) => (inputRefs.current[index] = el)}
              className="code-input"
              aria-label={`Digit ${index + 1}`}
            />
          ))}
        </div>
        
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}
        
        <button 
          className="auth-button" 
          onClick={handleVerify} 
          disabled={loading}
        >
          {loading ? 'Verifying...' : 'Verify Email'}
        </button>
        
        <div className="resend-section">
          <p>Didn't receive the code?</p>
          <button 
            className="resend-button" 
            onClick={handleResendCode}
            disabled={resendDisabled}
          >
            {resendDisabled 
              ? `Resend code (${countdown}s)` 
              : 'Resend verification code'}
          </button>
        </div>
      </div>
    </AuthLayout>
  );
};

export default EmailVerification;