// src/pages/doctors/DoctorProfile.jsx
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
  const [doctorProfile, setDoctorProfile] = useState({
    firstName: '',
    lastName: '',
    title: '',
    specialization: '',
    email: '',
    phoneNumber: '',
    licenseNumber: '',
    yearsOfExperience: '',
    practiceAddress: '',
    bio: '',
    languages: [],
    availableForEmergency: false,
    profilePicture: null
  });

  // Form state for editing
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    title: '',
    specialization: '',
    email: '',
    phoneNumber: '',
    licenseNumber: '',
    yearsOfExperience: '',
    practiceAddress: '',
    bio: '',
    languages: [],
    availableForEmergency: false
  });

  const [profileImagePreview, setProfileImagePreview] = useState(null);

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
        specialization: profileData.specialization || '',
        email: profileData.email || '',
        phoneNumber: profileData.phoneNumber || '',
        licenseNumber: profileData.licenseNumber || '',
        yearsOfExperience: profileData.yearsOfExperience || '',
        practiceAddress: profileData.practiceAddress || '',
        bio: profileData.bio || '',
        languages: profileData.languages || [],
        availableForEmergency: profileData.availableForEmergency || false,
        profilePicture: profileData.profilePicture || null
      };
      
      setDoctorProfile(processedProfile);
      setFormData(processedProfile);
      
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

  const handleLanguageChange = (e) => {
    const { value, checked } = e.target;
    
    setFormData(prev => ({
      ...prev,
      languages: checked 
        ? [...prev.languages, value]
        : prev.languages.filter(lang => lang !== value)
    }));
  };

  const handleProfileImageChange = (e) => {
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
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      console.log('💾 Saving doctor profile...');
      
      // Validate required fields
      if (!formData.firstName || !formData.lastName || !formData.email) {
        toast.error('Please fill in all required fields');
        return;
      }
      
      // Prepare data for submission
      const updateData = {
        ...formData,
        // Convert years of experience to number if provided
        yearsOfExperience: formData.yearsOfExperience ? parseInt(formData.yearsOfExperience) : null
      };
      
      console.log('📤 Sending update data:', updateData);
      
      const response = await doctorService.updateProfile(updateData);
      console.log('✅ Profile updated:', response);
      
      // Update local state
      setDoctorProfile(formData);
      
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
              <img src={item.icon} alt={item.label} className="menu-icon" />
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
            {profileImagePreview ? (
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
              <label htmlFor="profile-image-input" className="image-edit-button">
                <img src={editIcon} alt="Edit" />
              </label>
              <input
                id="profile-image-input"
                type="file"
                accept="image/*"
                onChange={handleProfileImageChange}
                style={{ display: 'none' }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderEditProfile = () => {
    const availableLanguages = [
      'English', 'Spanish', 'French', 'German', 'Italian', 
      'Portuguese', 'Chinese', 'Japanese', 'Korean', 'Arabic'
    ];

    const specializations = [
      'Psychiatrist',
      'Psychologist', 
      'Clinical Psychologist',
      'Mental Health Counselor',
      'Clinical Social Worker',
      'Marriage and Family Therapist',
      'Addiction Counselor',
      'Child Psychologist',
      'Neuropsychologist',
      'Other'
    ];

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
          {/* Profile Photo Section */}
          <div className="form-section profile-photo-section">
            <h3>Profile Photo</h3>
            <div className="photo-upload-area">
              <div className="photo-preview">
                {profileImagePreview ? (
                  <img src={profileImagePreview} alt="Profile Preview" />
                ) : (
                  <div className="photo-placeholder">
                    {formData.firstName.charAt(0)}{formData.lastName.charAt(0)}
                  </div>
                )}
              </div>
              <div className="photo-upload-controls">
                <label htmlFor="photo-upload" className="upload-button">
                  Choose Photo
                </label>
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleProfileImageChange}
                  style={{ display: 'none' }}
                />
                <p className="upload-help">
                  Upload a professional photo. Max file size: 5MB
                </p>
              </div>
            </div>
          </div>

          {/* Basic Information */}
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

          {/* Professional Information */}
          <div className="form-section">
            <h3>Professional Information</h3>
            <div className="form-group">
              <label htmlFor="specialization">Specialization</label>
              <select
                id="specialization"
                name="specialization"
                value={formData.specialization}
                onChange={handleInputChange}
                className="form-select"
              >
                <option value="">Select Specialization</option>
                {specializations.map(spec => (
                  <option key={spec} value={spec}>{spec}</option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="licenseNumber">License Number</label>
                <input
                  type="text"
                  id="licenseNumber"
                  name="licenseNumber"
                  value={formData.licenseNumber}
                  onChange={handleInputChange}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label htmlFor="yearsOfExperience">Years of Experience</label>
                <input
                  type="number"
                  id="yearsOfExperience"
                  name="yearsOfExperience"
                  value={formData.yearsOfExperience}
                  onChange={handleInputChange}
                  min="0"
                  max="50"
                  className="form-input"
                />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="form-section">
            <h3>Contact Information</h3>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="email">Email Address *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label htmlFor="phoneNumber">Phone Number</label>
                <input
                  type="tel"
                  id="phoneNumber"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleInputChange}
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="practiceAddress">Practice Address</label>
              <textarea
                id="practiceAddress"
                name="practiceAddress"
                value={formData.practiceAddress}
                onChange={handleInputChange}
                rows="3"
                className="form-textarea"
                placeholder="Enter your practice address"
              />
            </div>
          </div>

          {/* Languages */}
          <div className="form-section">
            <h3>Languages Spoken</h3>
            <div className="checkbox-grid">
              {availableLanguages.map(language => (
                <label key={language} className="checkbox-label">
                  <input
                    type="checkbox"
                    value={language}
                    checked={formData.languages.includes(language)}
                    onChange={handleLanguageChange}
                    className="checkbox-input"
                  />
                  <span className="checkbox-text">{language}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Bio */}
          <div className="form-section">
            <h3>Professional Bio</h3>
            <div className="form-group">
              <label htmlFor="bio">About You</label>
              <textarea
                id="bio"
                name="bio"
                value={formData.bio}
                onChange={handleInputChange}
                rows="6"
                className="form-textarea"
                placeholder="Tell patients about your background, approach, and specialties..."
              />
            </div>
          </div>

          {/* Availability */}
          <div className="form-section">
            <h3>Availability</h3>
            <div className="form-group">
              <label className="checkbox-label emergency-availability">
                <input
                  type="checkbox"
                  name="availableForEmergency"
                  checked={formData.availableForEmergency}
                  onChange={handleInputChange}
                  className="checkbox-input"
                />
                <span className="checkbox-text">
                  Available for Emergency Consultations
                </span>
                <p className="checkbox-help">
                  Check this if you're available for urgent mental health consultations
                </p>
              </label>
            </div>
          </div>

          {/* Save Button */}
          <div className="form-actions">
            <button 
              type="submit" 
              className="save-button"
              disabled={saving}
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
        return renderPlaceholderSection('Change Email or Password');
      case 'doctor-application':
        return renderPlaceholderSection('My Doctor Application');
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