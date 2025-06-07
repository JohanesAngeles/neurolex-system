// client/src/components/doctor/layout/DoctorLayout.jsx - UPDATED WITH PROFILE BUTTON AND FRESH DATA LOADING
import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useTenant } from '../../../context/TenantContext';
import doctorService from '../../../services/doctorService'; // 🆕 NEW: Import doctor service
import '../../../styles/components/doctor/DoctorLayout.css';

// Import original icons
import logoImage from '../../../assets/images/Neurolex_Logo_New.png';
import dashboardIcon from '../../../assets/icons/dashboard_icon.svg';
import patientsIcon from '../../../assets/icons/UserManagement_Icon.svg';
import journalIcon from '../../../assets/icons/journal_icon.svg';
import templatesIcon from '../../../assets/icons/JournalManagement_Icon.svg';
import appointmentsIcon from '../../../assets/icons/appointment_icon.svg';
import messageIcon from '../../../assets/icons/messages_icon.svg';
import moodCheckInIcon from '../../../assets/icons/mood_icon.svg';

const DoctorLayout = () => {
  const navigate = useNavigate();
  
  const { 
    currentTenant, 
    getThemeStyles, 
    platformName, 
    isLoading,
    refreshTenantSettings,
    lastRefresh,
    isFeatureEnabled,
    tenantSettings
  } = useTenant();
  
  const [currentUser, setCurrentUser] = useState(null);
  const [logoError, setLogoError] = useState(false);
  const [logoKey, setLogoKey] = useState(Date.now());
  const [profileLoading, setProfileLoading] = useState(false); // 🆕 NEW: Profile loading state

  // Get tenant theme styles
  const theme = getThemeStyles();

  // 🆕 UPDATED: Load current doctor info with fresh data from server
  const loadDoctorInfo = async () => {
    try {
      setProfileLoading(true);
      
      // First, try to get basic user info from localStorage for immediate display
      const userData = localStorage.getItem('user') || sessionStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        setCurrentUser(user); // Set initial data for immediate display
        console.log('📦 Loaded cached user data for immediate display');
      }
      
      // Then fetch fresh profile data from server
      try {
        console.log('🔄 Fetching fresh doctor profile for sidebar...');
        const response = await doctorService.getProfile();
        
        let profileData = {};
        if (response.success && response.data) {
          profileData = response.data;
        } else if (response.data) {
          profileData = response.data;
        } else {
          profileData = response;
        }
        
        console.log('✅ Fresh profile data received:', profileData);
        
        // Update currentUser with fresh data from server
        setCurrentUser(prev => ({
          ...prev,
          ...profileData,
          // Ensure we keep essential fields from localStorage if not in API response
          id: prev?.id || prev?._id || profileData._id,
          role: prev?.role || profileData.role || 'doctor'
        }));
        
        // 🆕 NEW: Update localStorage with fresh profile data
        if (userData) {
          const user = JSON.parse(userData);
          const updatedUser = {
            ...user,
            ...profileData,
            // Keep existing ID and role from localStorage
            id: user.id || user._id || profileData._id,
            _id: user._id || user.id || profileData._id,
            role: user.role || 'doctor'
          };
          
          localStorage.setItem('user', JSON.stringify(updatedUser));
          
          // Also update sessionStorage if it exists
          if (sessionStorage.getItem('user')) {
            sessionStorage.setItem('user', JSON.stringify(updatedUser));
          }
          
          console.log('💾 Updated localStorage with fresh profile data');
        }
        
        console.log('✅ Sidebar profile updated with fresh data');
        
      } catch (apiError) {
        console.warn('⚠️ Could not fetch fresh profile data, using cached data:', apiError.message);
        // Continue with localStorage data if API fails
      }
      
    } catch (error) {
      console.error('❌ Error loading doctor info:', error);
    } finally {
      setProfileLoading(false);
    }
  };

  // Load current doctor info and listen for profile updates
  useEffect(() => {
    loadDoctorInfo(); // 🆕 UPDATED: Now an async function that fetches fresh data
    
    // Listen for profile picture updates
    const handleProfilePictureUpdate = (event) => {
      console.log('🖼️ Profile picture updated via event:', event.detail);
      setCurrentUser(prev => ({
        ...prev,
        profilePicture: event.detail.profilePicture
      }));
      
      // 🆕 NEW: Also update localStorage when profile picture changes
      const userData = localStorage.getItem('user') || sessionStorage.getItem('user');
      if (userData) {
        try {
          const user = JSON.parse(userData);
          user.profilePicture = event.detail.profilePicture;
          localStorage.setItem('user', JSON.stringify(user));
          
          if (sessionStorage.getItem('user')) {
            sessionStorage.setItem('user', JSON.stringify(user));
          }
          
          console.log('💾 Updated localStorage with new profile picture');
        } catch (storageError) {
          console.error('Error updating localStorage:', storageError);
        }
      }
    };
    
    window.addEventListener('profilePictureUpdated', handleProfilePictureUpdate);
    
    return () => {
      window.removeEventListener('profilePictureUpdated', handleProfilePictureUpdate);
    };
  }, []);

  // Apply CSS variables for theming
  useEffect(() => {
    if (theme && typeof document !== 'undefined') {
      const root = document.documentElement;
      
      root.style.setProperty('--tenant-primary-color', theme.primaryColor || '#4CAF50');
      root.style.setProperty('--tenant-secondary-color', theme.secondaryColor || '#2196F3');
      root.style.setProperty('--tenant-primary-rgb', hexToRgb(theme.primaryColor || '#4CAF50'));
      root.style.setProperty('--tenant-secondary-rgb', hexToRgb(theme.secondaryColor || '#2196F3'));
    }
  }, [theme?.primaryColor, theme?.secondaryColor]);

  // Listen for tenant settings updates and refresh logo
  useEffect(() => {
    const handleSettingsUpdate = (event) => {
      console.log('🔔 [DoctorLayout] Received tenant settings update:', event.detail);
      
      setLogoKey(Date.now());
      setLogoError(false);
      
      if (refreshTenantSettings) {
        setTimeout(() => {
          refreshTenantSettings(true);
        }, 500);
      }
    };

    window.addEventListener('tenantSettingsUpdated', handleSettingsUpdate);
    
    const handleStorageChange = (event) => {
      if (event.key === 'tenantSettingsUpdated') {
        console.log('🔔 [DoctorLayout] Detected settings update from storage');
        setLogoKey(Date.now());
        setLogoError(false);
        
        if (refreshTenantSettings) {
          setTimeout(() => {
            refreshTenantSettings(true);
          }, 500);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('tenantSettingsUpdated', handleSettingsUpdate);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [refreshTenantSettings]);

  // Update logo key when theme changes
  useEffect(() => {
    if (theme?.systemLogo?.light || theme?.logo) {
      setLogoKey(Date.now());
      setLogoError(false);
    }
  }, [theme?.systemLogo?.light, theme?.logo, lastRefresh]);

  // Helper function to convert hex to RGB
  const hexToRgb = (hex) => {
    if (!hex) return '76, 175, 80';
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result 
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
      : '76, 175, 80';
  };

  // Menu items (removed logout from here)
  const allItems = [
    { 
      id: 'dashboard', 
      label: 'Dashboard', 
      path: '/doctor', 
      icon: dashboardIcon,
      feature: 'Dashboard',
      alwaysShow: true,
      implemented: true
    },
    { 
      id: 'patients', 
      label: 'Patients', 
      path: '/doctor/patients', 
      icon: patientsIcon,
      feature: 'Patients',
      implemented: true
    },
    { 
      id: 'patient-mood-checkins', 
      label: 'Patient Mood Check-Ins', 
      path: '/doctor/mood-checkins', 
      icon: moodCheckInIcon,
      feature: 'Patient Mood Check-Ins',
      implemented: true
    },
    { 
      id: 'patient-journal', 
      label: 'Patient Journal Management', 
      path: '/doctor/journal-entries', 
      icon: journalIcon,
      feature: 'Patient Journal Management',
      implemented: true
    },
    { 
      id: 'journal-templates', 
      label: 'Journal Template Management', 
      path: '/doctor/form-templates', 
      icon: templatesIcon,
      feature: 'Journal Template Management',
      implemented: true
    },
    { 
      id: 'appointments', 
      label: 'Appointments', 
      path: '/doctor/appointments', 
      icon: appointmentsIcon,
      feature: 'Appointments',
      implemented: true
    },
    { 
      id: 'messages', 
      label: 'Messages', 
      path: '/doctor/messages', 
      icon: messageIcon,
      feature: 'Messages',
      implemented: false
    }
  ];
  
  // DEBUG: Add comprehensive logging
  console.log('🔍 [DoctorLayout] Building menu items...');
  console.log('🔍 [DoctorLayout] tenantSettings:', tenantSettings);
  console.log('🔍 [DoctorLayout] hirsSettings:', tenantSettings?.hirsSettings);
  console.log('🔍 [DoctorLayout] lastRefresh:', lastRefresh);
  
  // SIMPLIFIED: Direct filtering without useMemo
  const menuItems = allItems.filter(item => {
    // Always show dashboard
    if (item.alwaysShow) {
      console.log(`🔍 [DoctorLayout] ${item.label} - Always show`);
      return true;
    }
    
    // Check if isFeatureEnabled function exists and tenantSettings are loaded
    if (!isFeatureEnabled || !tenantSettings) {
      console.log(`🔍 [DoctorLayout] ${item.label} - Settings not loaded yet, showing temporarily`);
      return true; // Show all items while loading
    }
    
    // Use isFeatureEnabled function
    const enabled = isFeatureEnabled(item.feature);
    console.log(`🔍 [DoctorLayout] ${item.label} (${item.feature}) - Enabled: ${enabled}`);
    console.log(`🔍 [DoctorLayout] HIRS Settings for ${item.feature}:`, 
      tenantSettings?.hirsSettings?.find(h => h.name === item.feature)
    );
    
    return enabled;
  });
  
  console.log('🔍 [DoctorLayout] Final filtered menu items:', menuItems.map(i => i.label));

  // Navigate to profile instead of logout
  const handleProfileClick = () => {
    navigate('/doctor/profile');
  };

  // Enhanced logo source with fallback and cache busting
  const getLogoSource = () => {
    let logoUrl = null;
    
    if (theme?.systemLogo?.light) {
      logoUrl = theme.systemLogo.light;
    } else if (theme?.logo) {
      logoUrl = theme.logo;
    }
    
    if (logoUrl && !logoError) {
      return `${logoUrl}?key=${logoKey}`;
    }
    
    return logoImage;
  };

  const handleLogoError = () => {
    console.warn('🖼️ [DoctorLayout] Logo failed to load, using fallback');
    setLogoError(true);
  };

  const handleLogoLoad = () => {
    console.log('✅ [DoctorLayout] Logo loaded successfully');
    setLogoError(false);
  };

  // 🆕 UPDATED: Get doctor's profile picture or create initials with loading state
  const getDoctorProfileDisplay = () => {
    if (profileLoading) {
      return (
        <div className="doctor-profile-loading">
          <div className="profile-loading-spinner"></div>
        </div>
      );
    }
    
    if (currentUser?.profilePicture) {
      return (
        <img 
          src={currentUser.profilePicture} 
          alt="Profile" 
          className="doctor-profile-image"
          onError={(e) => {
            console.warn('Profile image failed to load:', currentUser.profilePicture);
            // Hide the broken image and show initials instead
            e.target.style.display = 'none';
            const initialsDiv = e.target.parentNode.querySelector('.doctor-profile-initials-fallback');
            if (initialsDiv) {
              initialsDiv.style.display = 'flex';
            }
          }}
        />
      );
    } else {
      // Create initials from first and last name
      const firstName = currentUser?.firstName || 'D';
      const lastName = currentUser?.lastName || 'R';
      return (
        <div className="doctor-profile-initials">
          {firstName.charAt(0)}{lastName.charAt(0)}
        </div>
      );
    }
  };

  // Show loading state if tenant data is still loading
  if (isLoading) {
    return (
      <div className="doctor-layout">
        <div className="doctor-sidebar">
          <div className="sidebar-header">
            <div className="loading-logo">Loading...</div>
          </div>
        </div>
        <div className="doctor-content">
          <div className="loading-content">
            <p>Loading your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="doctor-layout">
      {/* Left Sidebar */}
      <div className="doctor-sidebar">
        <div className="sidebar-header">
          <img 
            key={logoKey}
            src={getLogoSource()} 
            alt={`${platformName} Logo`} 
            className="doctor-logo" 
            onError={handleLogoError}
            onLoad={handleLogoLoad}
            style={{
              transition: 'opacity 0.3s ease-in-out',
              opacity: logoError ? 0.7 : 1
            }}
          />
          {/* Debug info in development */}
          {process.env.NODE_ENV === 'development' && (
            <div style={{ 
              fontSize: '10px', 
              color: '#666', 
              marginTop: '4px',
              textAlign: 'center',
              opacity: 0.7
            }}>
              {logoError ? 'Fallback Logo' : 'Dynamic Logo'}
              <br />
              Key: {logoKey.toString().slice(-6)}
            </div>
          )}
        </div>
        
        <div className="sidebar-menu">
          <ul className="nav-menu">
            {menuItems.map(item => (
              <li key={item.id} className="nav-item">
                <NavLink 
                  to={item.path}
                  className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
                  end={item.path === '/doctor'}
                  style={{
                    opacity: item.implemented ? 1 : 0.6
                  }}
                >
                  <img src={item.icon} alt={item.label} className="nav-icon" />
                  <span className="nav-label">{item.label}</span>
                  
                  {/* Show implementation status in development */}
                  {process.env.NODE_ENV === 'development' && (
                    <span 
                      className={`implementation-indicator ${item.implemented ? 'implemented' : 'not-implemented'}`}
                      title={`${item.label} - ${item.implemented ? 'Implemented' : 'Not Yet Implemented'}`}
                      style={{
                        marginLeft: '8px',
                        fontSize: '10px',
                        color: item.implemented ? '#4CAF50' : '#ff9800'
                      }}
                    >
                      {item.implemented ? '✅' : '🚧'}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
          
          {/* Feature Status Panel (Development Only) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="dev-feature-status">
              <strong className="dev-title">🔧 Dev: Menu Control</strong>
              <div className="feature-list">
                <div className="feature-item">
                  <span className="feature-dot active"/>
                  <span className="feature-name">{menuItems.length} Items Visible</span>
                </div>
                <div className="feature-item">
                  <span className="feature-dot" style={{ backgroundColor: '#4CAF50' }}/>
                  <span className="feature-name">{menuItems.filter(i => i.implemented).length} Implemented</span>
                </div>
                <div className="feature-item">
                  <span className="feature-dot" style={{ backgroundColor: '#ff9800' }}/>
                  <span className="feature-name">{menuItems.filter(i => !i.implemented).length} Pending</span>
                </div>
              </div>
              
              {/* Settings update indicator */}
              <div style={{ 
                marginTop: '8px', 
                padding: '4px 8px', 
                backgroundColor: theme?.primaryColor || '#4CAF50',
                color: 'white',
                borderRadius: '4px',
                fontSize: '10px',
                textAlign: 'center'
              }}>
                Settings: {new Date(lastRefresh).toLocaleTimeString()}
              </div>
            </div>
          )}
        </div>
        
        {/* 🆕 UPDATED: Profile Button with loading state */}
        <div className="sidebar-footer">
          <div 
            className={`doctor-profile-button ${profileLoading ? 'loading' : ''}`}
            onClick={handleProfileClick}
            title={`${currentUser?.firstName} ${currentUser?.lastName} - View Profile`}
          >
            <div className="profile-picture-container">
              {getDoctorProfileDisplay()}
              {/* 🆕 NEW: Fallback initials for broken images */}
              {currentUser?.profilePicture && (
                <div className="doctor-profile-initials-fallback" style={{ display: 'none' }}>
                  {(currentUser?.firstName || 'D').charAt(0)}{(currentUser?.lastName || 'R').charAt(0)}
                </div>
              )}
            </div>
            <div className="doctor-info">
              <div className="doctor-name">
                {profileLoading ? 'Loading...' : `${currentUser?.firstName || 'Doctor'} ${currentUser?.lastName || ''}`}
              </div>
              <div className="doctor-role">Mental Health Professional</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className="doctor-content">
        <div className="doctor-content-container">
          <Outlet />
        </div>
      </div>
      
      {/* Real-time update notification (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          backgroundColor: theme?.primaryColor || '#4CAF50',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '12px',
          zIndex: 1000,
          opacity: 0.8,
          pointerEvents: 'none'
        }}>
          🔄 Live Feature Control Active
        </div>
      )}
    </div>
  );
};

export default DoctorLayout;