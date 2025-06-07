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

  // Form state for editing - Only essential fields
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    title: ''
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
      
      // Set default values if missing - Only essential fields
      const processedProfile = {
        firstName: profileData.firstName || '',
        lastName: profileData.lastName || '',
        title: profileData.title || ''
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