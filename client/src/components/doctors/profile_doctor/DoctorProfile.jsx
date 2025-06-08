// src/pages/doctors/DoctorProfile.jsx - COMPLETE FIXED VERSION
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import doctorService from '../../../services/doctorService';
import '../../../styles/components/doctor/DoctorProfile.css';

// Import icons
import editIcon from '../../../assets/icons/edit_icon.svg';
import settingsIcon from '../../../assets/icons/Settings_icon.svg';
import profileIcon from '../../../assets/icons/profile_icon.svg';
import keyIcon from '../../../assets/icons/pub_profile.svg';
import helpIcon from '../../../assets/icons/help_icon.svg';
import logoutIcon from '../../../assets/icons/logout_icon.svg';

const DoctorProfile = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('edit-profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Profile picture upload states
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  
  const [doctorProfile, setDoctorProfile] = useState({
    firstName: '',
    lastName: '',
    title: '',
    email: '',
    profilePicture: null
  });

  // Form state for editing - Only essential fields
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    title: ''
  });

  const [profileImagePreview, setProfileImagePreview] = useState(null);

  // 🆕 NEW: Change Email/Password states - moved to component level
  const [emailData, setEmailData] = useState({
    currentEmail: '',
    newEmail: '',
    password: ''
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
    emailPassword: false
  });

  const [changingEmail, setChangingEmail] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('email'); // 'email' or 'password'

  // Load doctor profile on component mount
  useEffect(() => {
    loadDoctorProfile();
  }, []);

  const loadDoctorProfile = async () => {
    try {
      setLoading(true);
      console.log('🔍 Loading doctor profile...');
      
      const response = await doctorService.getProfile();
      console.log('✅ Profile loaded:', response);
      
      let profileData = {};
      
      // Handle different response structures
      if (response.success && response.data) {
        profileData = response.data;
      } else if (response.data) {
        profileData = response.data;
      } else {
        profileData = response;
      }
      
      // Set default values if missing
      const processedProfile = {
        firstName: profileData.firstName || '',
        lastName: profileData.lastName || '',
        title: profileData.title || '',
        email: profileData.email || '',
        profilePicture: profileData.profilePicture || null
      };
      
      setDoctorProfile(processedProfile);
      setFormData({
        firstName: processedProfile.firstName,
        lastName: processedProfile.lastName,
        title: processedProfile.title
      });
      
      // 🆕 NEW: Set current email for change email form
      setEmailData(prev => ({
        ...prev,
        currentEmail: processedProfile.email || ''
      }));
      
      if (processedProfile.profilePicture) {
        setProfileImagePreview(processedProfile.profilePicture);
      }
      
    } catch (error) {
      console.error('❌ Error loading doctor profile:', error);
      toast.error('Failed to load profile information');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Profile picture change handler with automatic upload
  const handleProfileImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select a valid image file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB');
        return;
      }
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfileImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
      
      // Store the file for upload
      setSelectedFile(file);
      
      // Automatically upload the profile picture
      await uploadProfilePicture(file);
    }
  };

  // Upload profile picture function
  const uploadProfilePicture = async (file) => {
    try {
      setUploading(true);
      console.log('📤 Uploading profile picture...');
      
      // Create FormData
      const formData = new FormData();
      formData.append('profilePicture', file);
      
      // Upload to server
      const response = await doctorService.uploadProfilePicture(formData);
      console.log('✅ Profile picture uploaded:', response);
      
      if (response.success) {
        // Update the doctor profile state with new picture URL
        setDoctorProfile(prev => ({
          ...prev,
          profilePicture: response.data.profilePicture
        }));
        
        // Update preview with the actual uploaded URL
        setProfileImagePreview(response.data.profilePicture);
        
        // Dispatch custom event to update layout sidebar
        window.dispatchEvent(new CustomEvent('profilePictureUpdated', {
          detail: { profilePicture: response.data.profilePicture }
        }));
        
        toast.success('Profile picture updated successfully!');
      }
      
    } catch (error) {
      console.error('❌ Error uploading profile picture:', error);
      
      // Reset preview on error
      setProfileImagePreview(doctorProfile.profilePicture || null);
      setSelectedFile(null);
      
      const errorMessage = error.response?.data?.message || error.message || 'Failed to upload profile picture';
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  // Delete profile picture function
  const deleteProfilePicture = async () => {
    try {
      setUploading(true);
      console.log('🗑️ Deleting profile picture...');
      
      const response = await doctorService.deleteProfilePicture();
      console.log('✅ Profile picture deleted:', response);
      
      if (response.success) {
        // Clear the profile picture
        setDoctorProfile(prev => ({
          ...prev,
          profilePicture: null
        }));
        setProfileImagePreview(null);
        setSelectedFile(null);
        
        // Dispatch event to update layout sidebar
        window.dispatchEvent(new CustomEvent('profilePictureUpdated', {
          detail: { profilePicture: null }
        }));
        
        toast.success('Profile picture deleted successfully!');
      }
      
    } catch (error) {
      console.error('❌ Error deleting profile picture:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to delete profile picture';
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      console.log('💾 Saving doctor profile...');
      
      // Validate required fields - Only essential ones
      if (!formData.firstName || !formData.lastName) {
        toast.error('Please fill in all required fields (First Name and Last Name)');
        return;
      }
      
      // Prepare data for submission - Only essential fields
      const updateData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        title: formData.title || ''
      };
      
      console.log('📤 Sending update data:', updateData);
      
      const response = await doctorService.updateProfile(updateData);
      console.log('✅ Profile updated:', response);
      
      // Update local state
      setDoctorProfile(prev => ({
        ...prev,
        ...formData
      }));
      
      toast.success('Profile updated successfully!');
      
    } catch (error) {
      console.error('❌ Error updating profile:', error);
      
      // Show specific error message if available
      const errorMessage = error.response?.data?.message || error.message || 'Failed to update profile';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // Password validation function
  const validatePassword = (password) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    const errors = [];
    if (password.length < minLength) {
      errors.push(`Password must be at least ${minLength} characters long`);
    }
    if (!hasUpperCase) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!hasLowerCase) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!hasNumbers) {
      errors.push('Password must contain at least one number');
    }
    if (!hasSpecialChar) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  };

  // Email validation
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Handle email change
  const handleEmailChange = async (e) => {
  e.preventDefault();
  
  try {
    setChangingEmail(true);

    // Validate email format
    if (!validateEmail(emailData.newEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    // Check if new email is different
    if (emailData.newEmail === emailData.currentEmail) {
      toast.error('New email must be different from current email');
      return;
    }

    // Validate current password is provided
    if (!emailData.password) {
      toast.error('Please enter your current password to confirm the change');
      return;
    }

    console.log('🔄 Changing email...');
    
    // ✅ FIXED: Pass a single object instead of three separate parameters
    const response = await doctorService.changeEmail({
      currentEmail: emailData.currentEmail,
      newEmail: emailData.newEmail,
      password: emailData.password
    });

    if (response.success) {
      // Update local state
      setDoctorProfile(prev => ({
        ...prev,
        email: emailData.newEmail
      }));
      
      setEmailData(prev => ({
        ...prev,
        currentEmail: emailData.newEmail,
        newEmail: '',
        password: ''
      }));

      toast.success('Email address updated successfully!');
    }

  } catch (error) {
    console.error('❌ Error changing email:', error);
    const errorMessage = error.response?.data?.message || error.message || 'Failed to change email';
    toast.error(errorMessage);
  } finally {
    setChangingEmail(false);
  }
};

  // Handle password change
  const handlePasswordChange = async (e) => {
  e.preventDefault();
  
  try {
    setChangingPassword(true);

    // Validate current password is provided
    if (!passwordData.currentPassword) {
      toast.error('Please enter your current password');
      return;
    }

    // Validate new password
    const passwordValidation = validatePassword(passwordData.newPassword);
    if (!passwordValidation.isValid) {
      toast.error(passwordValidation.errors[0]);
      return;
    }

    // Check password confirmation
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    // Check if new password is different from current
    if (passwordData.currentPassword === passwordData.newPassword) {
      toast.error('New password must be different from current password');
      return;
    }

    console.log('🔄 Changing password...');
    
    // ✅ FIXED: Pass a single object instead of three separate parameters
    const response = await doctorService.changePassword({
      currentPassword: passwordData.currentPassword,
      newPassword: passwordData.newPassword,
      confirmPassword: passwordData.confirmPassword
    });

    if (response.success) {
      // Clear form
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });

      toast.success('Password updated successfully!');
    }

  } catch (error) {
    console.error('❌ Error changing password:', error);
    const errorMessage = error.response?.data?.message || error.message || 'Failed to change password';
    toast.error(errorMessage);
  } finally {
    setChangingPassword(false);
  }
};

  // 🆕 FIXED: Change Email or Password Component (no useState hooks)
  const renderChangeEmailPassword = () => {
    return (
      <div className="profile-content">
        <div className="content-header">
          <h2>Change Email or Password</h2>
          <div className="tools-section">
            <button className="tools-button">
              <img src={settingsIcon} alt="Tools" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="change-tabs">
          <button 
            className={`tab-button ${activeTab === 'email' ? 'active' : ''}`}
            onClick={() => setActiveTab('email')}
          >
            Change Email
          </button>
          <button 
            className={`tab-button ${activeTab === 'password' ? 'active' : ''}`}
            onClick={() => setActiveTab('password')}
          >
            Change Password
          </button>
        </div>

        {/* Email Change Form */}
        {activeTab === 'email' && (
          <form onSubmit={handleEmailChange} className="change-form">
            <div className="form-section">
              <h3>Change Email Address</h3>
              
              <div className="form-group">
                <label htmlFor="currentEmail">Current Email Address</label>
                <input
                  type="email"
                  id="currentEmail"
                  value={emailData.currentEmail}
                  readOnly
                  className="form-input readonly"
                />
              </div>

              <div className="form-group">
                <label htmlFor="newEmail">New Email Address *</label>
                <input
                  type="email"
                  id="newEmail"
                  value={emailData.newEmail}
                  onChange={(e) => setEmailData(prev => ({ ...prev, newEmail: e.target.value }))}
                  required
                  className="form-input"
                  placeholder="Enter your new email address"
                />
              </div>

              <div className="form-group">
                <label htmlFor="emailPassword">Current Password *</label>
                <div className="password-input-container">
                  <input
                    type={showPasswords.emailPassword ? 'text' : 'password'}
                    id="emailPassword"
                    value={emailData.password}
                    onChange={(e) => setEmailData(prev => ({ ...prev, password: e.target.value }))}
                    required
                    className="form-input"
                    placeholder="Enter your current password to confirm"
                  />
                  <button 
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPasswords(prev => ({ ...prev, emailPassword: !prev.emailPassword }))}
                  >
                    {showPasswords.emailPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              <div className="form-actions">
                <button 
                  type="submit" 
                  className="save-button"
                  disabled={changingEmail || !emailData.newEmail || !emailData.password}
                >
                  {changingEmail ? 'Updating Email...' : 'Update Email'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Password Change Form */}
        {activeTab === 'password' && (
          <form onSubmit={handlePasswordChange} className="change-form">
            <div className="form-section">
              <h3>Change Password</h3>
              
              <div className="form-group">
                <label htmlFor="currentPassword">Current Password *</label>
                <div className="password-input-container">
                  <input
                    type={showPasswords.current ? 'text' : 'password'}
                    id="currentPassword"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                    required
                    className="form-input"
                    placeholder="Enter your current password"
                  />
                  <button 
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                  >
                    {showPasswords.current ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="newPassword">New Password *</label>
                <div className="password-input-container">
                  <input
                    type={showPasswords.new ? 'text' : 'password'}
                    id="newPassword"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                    required
                    className="form-input"
                    placeholder="Enter your new password"
                  />
                  <button 
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                  >
                    {showPasswords.new ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
                {passwordData.newPassword && (
                  <div className="password-requirements">
                    <p className="requirements-title">Password Requirements:</p>
                    <ul className="requirements-list">
                      <li className={passwordData.newPassword.length >= 8 ? 'valid' : 'invalid'}>
                        At least 8 characters long
                      </li>
                      <li className={/[A-Z]/.test(passwordData.newPassword) ? 'valid' : 'invalid'}>
                        One uppercase letter
                      </li>
                      <li className={/[a-z]/.test(passwordData.newPassword) ? 'valid' : 'invalid'}>
                        One lowercase letter
                      </li>
                      <li className={/\d/.test(passwordData.newPassword) ? 'valid' : 'invalid'}>
                        One number
                      </li>
                      <li className={/[!@#$%^&*(),.?":{}|<>]/.test(passwordData.newPassword) ? 'valid' : 'invalid'}>
                        One special character
                      </li>
                    </ul>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm New Password *</label>
                <div className="password-input-container">
                  <input
                    type={showPasswords.confirm ? 'text' : 'password'}
                    id="confirmPassword"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    required
                    className="form-input"
                    placeholder="Confirm your new password"
                  />
                  <button 
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                  >
                    {showPasswords.confirm ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
                {passwordData.confirmPassword && passwordData.newPassword && (
                  <div className={`password-match ${passwordData.newPassword === passwordData.confirmPassword ? 'valid' : 'invalid'}`}>
                    {passwordData.newPassword === passwordData.confirmPassword ? 
                      '✓ Passwords match' : 
                      '✗ Passwords do not match'}
                  </div>
                )}
              </div>

              <div className="form-actions">
                <button 
                  type="submit" 
                  className="save-button"
                  disabled={
                    changingPassword || 
                    !passwordData.currentPassword || 
                    !passwordData.newPassword || 
                    !passwordData.confirmPassword ||
                    passwordData.newPassword !== passwordData.confirmPassword ||
                    !validatePassword(passwordData.newPassword).isValid
                  }
                >
                  {changingPassword ? 'Updating Password...' : 'Update Password'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Security Notice */}
        <div className="security-notice">
          <h4>🔒 Security Notice</h4>
          <p>For your security, you will be logged out after changing your email or password and will need to log in again with your new credentials.</p>
        </div>
      </div>
    );
  };

// 🆕 REPLACE THE ENTIRE renderDoctorApplication FUNCTION WITH THIS:
const renderDoctorApplication = () => {
  return (
    <div className="profile-content">
      <div className="content-header">
        <h2>My Doctor Application</h2>
        <div className="tools-section">
          <button className="tools-button">
            <img src={settingsIcon} alt="Tools" />
          </button>
        </div>
      </div>

      <div className="application-overview">
        {/* Application Status */}
        <div className="form-section">
          <h3>Application Status</h3>
          <div className="status-card">
            <div className="status-info">
              <span className={`status-badge ${
                doctorProfile.verificationStatus === 'approved' ? 'approved' :
                doctorProfile.verificationStatus === 'pending' ? 'pending' :
                doctorProfile.verificationStatus === 'rejected' ? 'rejected' : 'unknown'
              }`}>
                {doctorProfile.verificationStatus === 'approved' ? '✅ Approved' :
                 doctorProfile.verificationStatus === 'pending' ? '⏳ Pending Review' :
                 doctorProfile.verificationStatus === 'rejected' ? '❌ Rejected' : '❓ Unknown'}
              </span>
              <p className="status-description">
                {doctorProfile.verificationStatus === 'approved' ? 
                  'Your application has been approved and you can now provide services on our platform.' :
                 doctorProfile.verificationStatus === 'pending' ? 
                  'Your application is currently under review by our admin team.' :
                 doctorProfile.verificationStatus === 'rejected' ? 
                  'Your application was not approved. Please contact support.' :
                  'Application status is currently unknown.'}
              </p>
            </div>
          </div>
        </div>

        {/* Personal Information */}
        <div className="form-section">
          <h3>Personal Information</h3>
          <div className="info-grid">
            <div className="info-item">
              <label>Full Name</label>
              <span>{doctorProfile.title ? `${doctorProfile.title} ` : ''}{doctorProfile.firstName} {doctorProfile.lastName}</span>
            </div>
            <div className="info-item">
              <label>Email Address</label>
              <span>{doctorProfile.email}</span>
            </div>
            <div className="info-item">
              <label>Professional Title</label>
              <span>{doctorProfile.title || 'Not specified'}</span>
            </div>
            <div className="info-item">
              <label>Personal Contact</label>
              <span>{doctorProfile.personalContactNumber || 'Not provided'}</span>
            </div>
            <div className="info-item">
              <label>Clinic Contact</label>
              <span>{doctorProfile.clinicContactNumber || 'Not provided'}</span>
            </div>
            <div className="info-item">
              <label>Account Created</label>
              <span>{doctorProfile.createdAt ? new Date(doctorProfile.createdAt).toLocaleDateString() : 'Unknown'}</span>
            </div>
          </div>
        </div>

        {/* Professional Details */}
        <div className="form-section">
          <h3>Professional Details</h3>
          <div className="info-grid">
            <div className="info-item">
              <label>Specialization/Specialty</label>
              <span>{doctorProfile.specialty || 'Not specified'}</span>
            </div>
            <div className="info-item">
              <label>License Number</label>
              <span>{doctorProfile.licenseNumber || 'Not provided'}</span>
            </div>
            <div className="info-item">
              <label>License Issuing Authority</label>
              <span>{doctorProfile.licenseIssuingAuthority || 'Not specified'}</span>
            </div>
            <div className="info-item">
              <label>Years of Practice</label>
              <span>{doctorProfile.yearsOfPractice || 'Not specified'}</span>
            </div>
            <div className="info-item">
              <label>Experience</label>
              <span>{doctorProfile.experience || 'Not provided'}</span>
            </div>
            <div className="info-item">
              <label>Areas of Expertise</label>
              <span>{doctorProfile.areasOfExpertise || 'Not specified'}</span>
            </div>
            <div className="info-item">
              <label>Consultation Fee</label>
              <span>{doctorProfile.consultationFee ? `₱${doctorProfile.consultationFee}` : 'Not set'}</span>
            </div>
          </div>
        </div>

        {/* Clinic Information */}
        <div className="form-section">
          <h3>Clinic Information</h3>
          <div className="info-grid">
            <div className="info-item full-width">
              <label>Clinic Name</label>
              <span>{doctorProfile.clinicName || 'Not provided'}</span>
            </div>
            <div className="info-item full-width">
              <label>Clinic Address</label>
              <span>{doctorProfile.clinicAddress || 'Not provided'}</span>
            </div>
            <div className="info-item">
              <label>In-Person Consultations</label>
              <span>{doctorProfile.inPerson ? '✅ Available' : '❌ Not available'}</span>
            </div>
            <div className="info-item">
              <label>Telehealth Services</label>
              <span>{doctorProfile.telehealth ? '✅ Available' : '❌ Not available'}</span>
            </div>
            <div className="info-item">
              <label>Emergency Services</label>
              <span>{doctorProfile.emergencyAware ? '✅ Available' : '❌ Not available'}</span>
            </div>
          </div>
        </div>

        {/* Education & Credentials */}
        {(doctorProfile.education && doctorProfile.education.length > 0) && (
          <div className="form-section">
            <h3>Education</h3>
            <div className="credentials-list">
              {doctorProfile.education.map((edu, index) => (
                <div key={index} className="credential-item">
                  <div className="credential-main">
                    <strong>{edu.degree}</strong>
                    <span className="credential-institution">{edu.institution}</span>
                  </div>
                  <div className="credential-year">{edu.year}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Licenses */}
        {(doctorProfile.licenses && doctorProfile.licenses.length > 0) && (
          <div className="form-section">
            <h3>Professional Licenses</h3>
            <div className="credentials-list">
              {doctorProfile.licenses.map((license, index) => (
                <div key={index} className="credential-item">
                  <div className="credential-main">
                    <strong>{license.degree}</strong>
                    <span className="credential-number">License: {license.licenseNumber}</span>
                  </div>
                  <div className="credential-expiry">Expires: {license.expirationDate}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Certifications */}
        {(doctorProfile.certifications && doctorProfile.certifications.length > 0) && (
          <div className="form-section">
            <h3>Certifications</h3>
            <div className="credentials-list">
              {doctorProfile.certifications.map((cert, index) => (
                <div key={index} className="credential-item">
                  <div className="credential-main">
                    <strong>{cert.degree}</strong>
                    <span className="credential-authority">{cert.issuingAuthority}</span>
                  </div>
                  <div className="credential-year">{cert.year}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Documents */}
        <div className="form-section">
          <h3>Uploaded Documents</h3>
          <div className="documents-list">
            <div className="document-item">
              <span className="document-type">License Document</span>
              <span className={`document-status ${doctorProfile.licenseDocumentUrl ? 'uploaded' : 'missing'}`}>
                {doctorProfile.licenseDocumentUrl ? '✅ Uploaded' : '❌ Not uploaded'}
              </span>
            </div>
            <div className="document-item">
              <span className="document-type">Education Certificate</span>
              <span className={`document-status ${doctorProfile.educationCertificateUrl ? 'uploaded' : 'missing'}`}>
                {doctorProfile.educationCertificateUrl ? '✅ Uploaded' : '❌ Not uploaded'}
              </span>
            </div>
            <div className="document-item">
              <span className="document-type">Profile Photo</span>
              <span className={`document-status ${doctorProfile.profilePicture ? 'uploaded' : 'missing'}`}>
                {doctorProfile.profilePicture ? '✅ Uploaded' : '❌ Not uploaded'}
              </span>
            </div>
            {doctorProfile.additionalDocumentUrls && doctorProfile.additionalDocumentUrls.length > 0 && (
              <div className="document-item">
                <span className="document-type">Additional Documents</span>
                <span className="document-status uploaded">✅ {doctorProfile.additionalDocumentUrls.length} files uploaded</span>
              </div>
            )}
          </div>
        </div>

        {/* Availability */}
        {doctorProfile.availability && (
          <div className="form-section">
            <h3>Weekly Availability</h3>
            <div className="availability-grid">
              {Object.entries(doctorProfile.availability).map(([day, schedule]) => (
                <div key={day} className="availability-day">
                  <div className="day-name">{day.charAt(0).toUpperCase() + day.slice(1)}</div>
                  <div className={`day-status ${schedule.available ? 'available' : 'unavailable'}`}>
                    {schedule.available ? '✅ Available' : '❌ Not available'}
                  </div>
                  {schedule.available && schedule.slots && schedule.slots.length > 0 && (
                    <div className="time-slots">
                      {schedule.slots.map((slot, index) => (
                        <span key={index} className="time-slot">
                          {slot.startTime} - {slot.endTime}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Verification Information */}
        <div className="form-section">
          <h3>Verification Details</h3>
          <div className="info-grid">
            <div className="info-item">
              <label>Verification Status</label>
              <span className={`verification-status ${doctorProfile.verificationStatus || 'unknown'}`}>
                {doctorProfile.verificationStatus || 'Unknown'}
              </span>
            </div>
            <div className="info-item">
              <label>Account Active</label>
              <span>{doctorProfile.isActive ? '✅ Active' : '❌ Inactive'}</span>
            </div>
            <div className="info-item">
              <label>Email Verified</label>
              <span>{doctorProfile.isEmailVerified ? '✅ Verified' : '❌ Not verified'}</span>
            </div>
            <div className="info-item">
              <label>Terms Accepted</label>
              <span>{doctorProfile.termsAccepted ? '✅ Accepted' : '❌ Not accepted'}</span>
            </div>
            {doctorProfile.verificationDate && (
              <div className="info-item">
                <label>Verification Date</label>
                <span>{new Date(doctorProfile.verificationDate).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Verification Notes */}
        {doctorProfile.verificationNotes && doctorProfile.verificationNotes.length > 0 && (
          <div className="form-section">
            <h3>Admin Notes</h3>
            <div className="verification-notes-list">
              {doctorProfile.verificationNotes.map((note, index) => (
                <div key={index} className="verification-note">
                  <div className="note-content">{note.content}</div>
                  <div className="note-meta">
                    {note.timestamp && (
                      <span className="note-date">{new Date(note.timestamp).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="form-section">
          <div className="application-actions">
            {doctorProfile.verificationStatus === 'pending' && (
              <div className="info-message">
                <h4>⏳ Application Under Review</h4>
                <p>Your application is currently being reviewed by our admin team. You will receive an email notification once the review is complete.</p>
              </div>
            )}
            
            {doctorProfile.verificationStatus === 'rejected' && (
              <div className="action-buttons">
                <button className="secondary-button" onClick={() => alert('Contact support feature coming soon')}>
                  Contact Support
                </button>
                <button className="primary-button" onClick={() => alert('Resubmit application feature coming soon')}>
                  Resubmit Application
                </button>
              </div>
            )}
            
            {doctorProfile.verificationStatus === 'approved' && (
              <div className="success-message">
                <h4>🎉 Congratulations!</h4>
                <p>Your application has been approved. You can now provide professional services on our platform and access all doctor features.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

  const renderSidebarMenu = () => {
    const menuItems = [
      { id: 'edit-profile', label: 'Edit Profile', icon: editIcon },
      { id: 'change-password', label: 'Change Email or Password', icon: keyIcon },
      { id: 'doctor-application', label: 'My Doctor Application', icon: profileIcon },
      { id: 'public-profile', label: 'Public Profile', icon: settingsIcon },
      { id: 'help-guide', label: 'Help & Guide (HIRS)', icon: helpIcon }
    ];

    return (
      <div className="profile-sidebar">
        <div className="sidebar-menu">
          {menuItems.map(item => (
            <button
              key={item.id}
              className={`sidebar-menu-item ${activeSection === item.id ? 'active' : ''}`}
              onClick={() => setActiveSection(item.id)}
            >
              <div className="icon-container">
              <img src={item.icon} alt={item.label} className="menu-icon" /> </div>
              <span className="menu-label">{item.label}</span>
              <span className="menu-arrow">›</span>
            </button>
          ))}
        </div>
        
        <div className="sidebar-footer">
          <button className="logout-button" onClick={() => navigate('/login')}>
            <img src={logoutIcon} alt="Logout" className="logout-icon" />
            <span>Logout</span>
          </button>
        </div>
        
        {/* Profile Picture Section */}
        <div className="sidebar-profile">
          <div className="profile-image-container">
            {uploading ? (
              <div className="profile-image-uploading">
                <div className="upload-spinner"></div>
              </div>
            ) : profileImagePreview ? (
              <img 
                src={profileImagePreview} 
                alt="Profile" 
                className="profile-image"
              />
            ) : (
              <div className="profile-image-placeholder">
                {formData.firstName.charAt(0)}{formData.lastName.charAt(0)}
              </div>
            )}
            <div className="profile-image-edit">
              <label htmlFor="profile-image-input" className={`image-edit-button ${uploading ? 'disabled' : ''}`}>
                <img src={editIcon} alt="Edit" />
              </label>
              <input
                id="profile-image-input"
                type="file"
                accept="image/*"
                onChange={handleProfileImageChange}
                disabled={uploading}
                style={{ display: 'none' }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderEditProfile = () => {
    return (
      <div className="profile-content">
        <div className="content-header">
          <h2>Edit Profile</h2>
          <div className="tools-section">
            <button className="tools-button">
              <img src={settingsIcon} alt="Tools" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="profile-form">
          {/* Profile Photo Section with upload status */}
          <div className="form-section profile-photo-section">
            <h3>Profile Photo</h3>
            <div className="photo-upload-area">
              <div className="photo-preview">
                {uploading ? (
                  <div className="photo-uploading">
                    <div className="upload-spinner"></div>
                    <p>Uploading...</p>
                  </div>
                ) : profileImagePreview ? (
                  <img src={profileImagePreview} alt="Profile Preview" />
                ) : (
                  <div className="photo-placeholder">
                    {formData.firstName.charAt(0)}{formData.lastName.charAt(0)}
                  </div>
                )}
              </div>
              <div className="photo-upload-controls">
                <label htmlFor="photo-upload" className={`upload-button ${uploading ? 'disabled' : ''}`}>
                  {uploading ? 'Uploading...' : 'Choose Photo'}
                </label>
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleProfileImageChange}
                  disabled={uploading}
                  style={{ display: 'none' }}
                />
                {profileImagePreview && !uploading && (
                  <button 
                    type="button" 
                    onClick={deleteProfilePicture}
                    className="delete-photo-button"
                    disabled={uploading}
                  >
                    Delete Photo
                  </button>
                )}
                <p className="upload-help">
                  Upload a professional photo. Max file size: 5MB
                </p>
              </div>
            </div>
          </div>

          {/* Basic Information - Only Essential Fields */}
          <div className="form-section">
            <h3>Basic Information</h3>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="firstName">First Name *</label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  required
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label htmlFor="lastName">Last Name *</label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  required
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="title">Professional Title</label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="e.g., Dr., LCSW, RPSY"
                className="form-input"
              />
            </div>
          </div>

          {/* Info Message for Other Sections */}
          <div className="form-section info-section">
            <div className="info-message">
              <h3>📋 Additional Profile Information</h3>
              <p>Other profile details like contact information, specialization, license details, and bio can be managed in the corresponding sections:</p>
              <ul className="info-list">
                <li><strong>Change Email or Password</strong> - Update your login credentials</li>
                <li><strong>My Doctor Application</strong> - View and update professional credentials</li>
                <li><strong>Public Profile</strong> - Manage your public-facing profile information</li>
              </ul>
              <p className="info-note">Use the sidebar menu to navigate to these sections.</p>
            </div>
          </div>

          {/* Save Button */}
          <div className="form-actions">
            <button 
              type="submit" 
              className="save-button"
              disabled={saving || uploading}
            >
              {saving ? 'Saving...' : 'Save & Update'}
            </button>
          </div>
        </form>
      </div>
    );
  };

  const renderPlaceholderSection = (title) => (
    <div className="profile-content">
      <div className="content-header">
        <h2>{title}</h2>
      </div>
      <div className="placeholder-content">
        <p>This section is coming soon.</p>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'edit-profile':
        return renderEditProfile();
      case 'change-password':
        return renderChangeEmailPassword(); // 🆕 NEW: Use the change password component
      case 'doctor-application':
          return renderDoctorApplication();
      case 'public-profile':
        return renderPlaceholderSection('Public Profile');
      case 'help-guide':
        return renderPlaceholderSection('Help & Guide (HIRS)');
      default:
        return renderEditProfile();
    }
  };

  if (loading) {
    return (
      <div className="profile-loading">
        <div className="loading-spinner"></div>
        <p>Loading your profile...</p>
      </div>
    );
  }

  return (
    <div className="doctor-profile-container">
      <div className="profile-header">
        <div className="header-left">
          <button 
            className="back-button"
            onClick={() => navigate('/doctor')}
          >
            ←
          </button>
          <div className="header-title">
            <h1>My Professional Profile</h1>
            <p>Keep your information and availability up to date.</p>
          </div>
        </div>
      </div>

      <div className="profile-layout">
        {renderSidebarMenu()}
        {renderContent()}
      </div>
    </div>
  );
};

export default DoctorProfile;