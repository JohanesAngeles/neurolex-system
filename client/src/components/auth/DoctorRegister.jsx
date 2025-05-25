import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import AuthLayout from '../../layouts/auth/authLayout';
import doctorAuthService from '../../services/doctorAuthService';
import '../../styles/components/auth/auth_forms.css';
import '../../styles/components/doctor/doctor_auth.css';

const DoctorRegister = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    specialization: '',
    licenseNumber: '',
    termsAccepted: false
  });
  
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  
  const { 
    firstName, lastName, email, password, confirmPassword, 
    specialization, licenseNumber, termsAccepted 
  } = formData;
  
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
    
    if (!specialization) {
      newErrors.specialization = 'Specialization is required';
    }
    
    if (!licenseNumber) {
      newErrors.licenseNumber = 'License number is required';
    }
    
    if (!termsAccepted) {
      newErrors.termsAccepted = 'You must accept the terms and conditions';
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
        specialization,
        licenseNumber,
        termsAccepted,
        role: 'doctor'
      };
      
      const response = await doctorAuthService.register(registrationData);
      
      toast.success('Registration successful! Please check your email for verification.');
      
      // Navigate to doctor verification page
      navigate('/doctor/verify-email', { state: { email: formData.email } });
      
    } catch (error) {
      console.error('Registration error:', error);
      
      let errorMsg = 'Registration failed. Please try again.';
      if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      }
      
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };
  
  const toggleTermsModal = () => {
    setShowTermsModal(!showTermsModal);
  };
  
  const togglePrivacyModal = () => {
    setShowPrivacyModal(!showPrivacyModal);
  };
  
  return (
    <AuthLayout>
      <form className="doctor-auth-form" onSubmit={handleSubmit}>
        <h2 className="doctor-form-title">Healthcare Professional Registration</h2>
        <p className="doctor-form-subtitle">Join our network of mental health professionals</p>
        
        <div className="doctor-form-row">
          <div className="doctor-form-group">
            <label htmlFor="firstName">First Name</label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              placeholder="Enter First Name"
              value={firstName}
              onChange={handleChange}
              className={errors.firstName ? 'doctor-input-error' : 'doctor-input'}
            />
            {errors.firstName && <span className="doctor-error-message">{errors.firstName}</span>}
          </div>
          
          <div className="doctor-form-group">
            <label htmlFor="lastName">Last Name</label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              placeholder="Enter Last Name"
              value={lastName}
              onChange={handleChange}
              className={errors.lastName ? 'doctor-input-error' : 'doctor-input'}
            />
            {errors.lastName && <span className="doctor-error-message">{errors.lastName}</span>}
          </div>
        </div>
        
        <div className="doctor-form-group">
          <label htmlFor="email">Email Address</label>
          <input
            type="email"
            id="email"
            name="email"
            placeholder="Enter Email Address"
            value={email}
            onChange={handleChange}
            className={errors.email ? 'doctor-input-error' : 'doctor-input'}
          />
          {errors.email && <span className="doctor-error-message">{errors.email}</span>}
        </div>
        
        <div className="doctor-form-group">
          <label htmlFor="specialization">Specialization</label>
          <select
            id="specialization"
            name="specialization"
            value={specialization}
            onChange={handleChange}
            className={errors.specialization ? 'doctor-input-error' : 'doctor-input'}
          >
            <option value="">Select Specialization</option>
            <option value="psychiatrist">Psychiatrist</option>
            <option value="psychologist">Psychologist</option>
            <option value="therapist">Therapist</option>
            <option value="counselor">Counselor</option>
            <option value="social_worker">Social Worker</option>
            <option value="other">Other</option>
          </select>
          {errors.specialization && <span className="doctor-error-message">{errors.specialization}</span>}
        </div>
        
        <div className="doctor-form-group">
          <label htmlFor="licenseNumber">License Number</label>
          <input
            type="text"
            id="licenseNumber"
            name="licenseNumber"
            placeholder="Enter License Number"
            value={licenseNumber}
            onChange={handleChange}
            className={errors.licenseNumber ? 'doctor-input-error' : 'doctor-input'}
          />
          {errors.licenseNumber && <span className="doctor-error-message">{errors.licenseNumber}</span>}
        </div>
        
        <div className="doctor-form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            placeholder="Enter Password"
            value={password}
            onChange={handleChange}
            className={errors.password ? 'doctor-input-error' : 'doctor-input'}
          />
          {errors.password && <span className="doctor-error-message">{errors.password}</span>}
          
          {/* Password strength indicator */}
          {password && (
            <div className="doctor-password-strength">
              <div className={`doctor-strength-bar ${
                password.length >= 8 && 
                /[A-Z]/.test(password) && 
                /[a-z]/.test(password) && 
                /[0-9]/.test(password) && 
                /[^A-Za-z0-9]/.test(password) 
                  ? 'doctor-strong' 
                  : password.length >= 6 ? 'doctor-medium' : 'doctor-weak'
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
        
        <div className="doctor-form-group">
          <label htmlFor="confirmPassword">Confirm Password</label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={handleChange}
            className={errors.confirmPassword ? 'doctor-input-error' : 'doctor-input'}
          />
          {errors.confirmPassword && <span className="doctor-error-message">{errors.confirmPassword}</span>}
        </div>
        
        <div className="doctor-form-group doctor-checkbox-group">
          <input
            type="checkbox"
            id="termsAccepted"
            name="termsAccepted"
            checked={termsAccepted}
            onChange={handleChange}
          />
          <label htmlFor="termsAccepted" className="doctor-checkbox-label">
            I accept the <span className="doctor-link" onClick={toggleTermsModal}>Terms of Use</span> and <span className="doctor-link" onClick={togglePrivacyModal}>Privacy Policy</span>
          </label>
          {errors.termsAccepted && <span className="doctor-error-message">{errors.termsAccepted}</span>}
        </div>
        
        <button type="submit" className="doctor-auth-button" disabled={loading}>
          {loading ? 'Registering...' : 'Register'}
        </button>

        <div className="doctor-auth-link">
          Already have an account? <Link to="/doctor/login" className="doctor-link">Sign In</Link>
        </div>
      </form>
      
      {/* Terms of Use Modal */}
      {showTermsModal && (
        <div className="doctor-modal">
          <div className="doctor-modal-content">
            <span className="doctor-close" onClick={toggleTermsModal}>&times;</span>
            <h2>Terms of Use for Healthcare Professionals</h2>
            <div className="doctor-modal-body">
              <p>These Terms of Use constitute a legally binding agreement made between you as a healthcare professional and our company.</p>
              <p>By creating an account, you agree to abide by these Terms of Use.</p>
            </div>
            <button className="doctor-modal-button" onClick={toggleTermsModal}>Close</button>
          </div>
        </div>
      )}
      
      {/* Privacy Policy Modal */}
      {showPrivacyModal && (
        <div className="doctor-modal">
          <div className="doctor-modal-content">
            <span className="doctor-close" onClick={togglePrivacyModal}>&times;</span>
            <h2>Privacy Policy for Healthcare Professionals</h2>
            <div className="doctor-modal-body">
              <p>Your privacy is important to us. This Privacy Policy explains how we collect, use, and protect your personal information as a healthcare professional.</p>
            </div>
            <button className="doctor-modal-button" onClick={togglePrivacyModal}>Close</button>
          </div>
        </div>
      )}
    </AuthLayout>
  );
};

export default DoctorRegister;