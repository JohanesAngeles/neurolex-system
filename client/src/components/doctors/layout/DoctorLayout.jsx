// client/src/components/doctor/layout/DoctorLayout.jsx - Enhanced with Real-time Updates
import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useFeatureControl } from '../../../hooks/useFeatureControl';
import { useTenant } from '../../../context/TenantContext';
import '../../../styles/components/doctor/DoctorLayout.css';

// Import original icons (keeping your existing structure)
import logoImage from '../../../assets/images/Neurolex_Logo_New.png';
import dashboardIcon from '../../../assets/icons/dashboard_icon.svg';
import patientsIcon from '../../../assets/icons/UserManagement_Icon.svg';
import journalIcon from '../../../assets/icons/JournalManagement_Icon.svg';
import templatesIcon from '../../../assets/icons/JournalManagement_Icon.svg';
import appointmentsIcon from '../../../assets/icons/appointment_icon.svg';
import messageIcon from '../../../assets/icons/messages_icon.svggit '; // 🔄 CHANGED: Settings to Message icon

const DoctorLayout = () => {
  const navigate = useNavigate();
  const featureControl = useFeatureControl();
  const { 
    currentTenant, 
    getThemeStyles, 
    platformName, 
    isLoading,
    refreshTenantSettings,
    lastRefresh
  } = useTenant();
  
  const [currentUser, setCurrentUser] = useState(null);
  const [logoError, setLogoError] = useState(false);
  const [logoKey, setLogoKey] = useState(Date.now()); // 🔄 Force logo refresh

  // Get tenant theme styles - this will now be dynamic from system settings
  const theme = getThemeStyles();

  // 🔧 FIXED: Load current doctor info ONLY ONCE
  useEffect(() => {
    const loadDoctorInfo = () => {
      try {
        const userData = localStorage.getItem('user') || sessionStorage.getItem('user');
        if (userData) {
          const user = JSON.parse(userData);
          setCurrentUser(user);
        }
      } catch (error) {
        console.error('Error loading doctor info:', error);
      }
    };
    loadDoctorInfo();
  }, []); // 🔧 EMPTY DEPENDENCY - RUNS ONLY ONCE

  // 🔧 FIXED: Apply CSS variables ONLY when specific theme properties change
  useEffect(() => {
    if (theme && typeof document !== 'undefined') {
      const root = document.documentElement;
      
      // Set CSS custom properties for dynamic theming
      root.style.setProperty('--tenant-primary-color', theme.primaryColor || '#4CAF50');
      root.style.setProperty('--tenant-secondary-color', theme.secondaryColor || '#2196F3');
      root.style.setProperty('--tenant-primary-rgb', hexToRgb(theme.primaryColor || '#4CAF50'));
      root.style.setProperty('--tenant-secondary-rgb', hexToRgb(theme.secondaryColor || '#2196F3'));
    }
  }, [theme?.primaryColor, theme?.secondaryColor]); // 🔧 SPECIFIC DEPENDENCIES ONLY

  // 🔄 NEW: Listen for tenant settings updates and refresh logo
  useEffect(() => {
    const handleSettingsUpdate = (event) => {
      console.log('🔔 [DoctorLayout] Received tenant settings update:', event.detail);
      
      // Force logo refresh by updating the key
      setLogoKey(Date.now());
      setLogoError(false);
      
      // Refresh tenant settings if needed
      if (refreshTenantSettings) {
        setTimeout(() => {
          refreshTenantSettings(true);
        }, 500);
      }
    };

    // Listen for custom events from admin panel
    window.addEventListener('tenantSettingsUpdated', handleSettingsUpdate);
    
    // Also listen for storage events (settings updated in another tab)
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

  // 🔄 NEW: Update logo key when theme changes to force refresh
  useEffect(() => {
    if (theme?.systemLogo?.light || theme?.logo) {
      setLogoKey(Date.now());
      setLogoError(false);
    }
  }, [theme?.systemLogo?.light, theme?.logo, lastRefresh]);

  // Helper function to convert hex to RGB for CSS variables
  const hexToRgb = (hex) => {
    if (!hex) return '76, 175, 80';
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result 
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
      : '76, 175, 80'; // Default green fallback
  };

  // 🔧 UPDATED: Only 6 navigation menu items as requested
  const menuItems = React.useMemo(() => {
    const allItems = [
      { 
        id: 'dashboard', 
        label: 'Dashboard', 
        path: '/doctor', 
        icon: dashboardIcon,
        feature: 'User Dashboard',
        alwaysShow: true, // Dashboard should always be available
        implemented: true
      },
      { 
        id: 'patients', 
        label: 'Patients', 
        path: '/doctor/patients', 
        icon: patientsIcon,
        feature: 'User Profiles',
        implemented: true
      },
      { 
        id: 'patient-journal', 
        label: 'Patient Journal Management', 
        path: '/doctor/journal-entries', 
        icon: journalIcon,
        feature: 'Journal Entries',
        implemented: true
      },
      { 
        id: 'journal-templates', 
        label: 'Journal Template Management', 
        path: '/doctor/form-templates', 
        icon: templatesIcon,
        feature: 'Journal Entries', // Templates are part of journal functionality
        implemented: true
      },
      { 
        id: 'appointments', 
        label: 'Appointments', 
        path: '/doctor/appointments', 
        icon: appointmentsIcon,
        feature: 'Care / Report',
        implemented: true
      },
      { 
        id: 'messages', 
        label: 'Messages', 
        path: '/doctor/messages', 
        icon: messageIcon, // 🔄 FIXED: Now using proper message icon
        feature: 'Notifications', // Map to notifications feature
        implemented: false // Not yet implemented
      }
    ];
    
    // Return only the 6 specified menu items
    return allItems.filter(item => {
      // Always show dashboard and items marked as alwaysShow
      if (item.alwaysShow) {
        return true;
      }
      
      // Show all 6 items regardless of implementation status for now
      return true;
      
      // Later you can uncomment this to filter by feature control:
      // return featureControl.isFeatureEnabled && featureControl.isFeatureEnabled(item.feature);
    });
  }, [featureControl]); // 🔧 MEMOIZED WITH SPECIFIC DEPENDENCY

  const handleLogout = () => {
    // Clear all stored data
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('tenant');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('tenant');
    
    // Redirect to login page
    navigate('/login');
  };

  // 🔧 MEMOIZED: Doctor info to prevent recalculation (keeping for future use)
  const doctorInfo = React.useMemo(() => {
    if (currentUser) {
      return {
        name: `Dr. ${currentUser.firstName} ${currentUser.lastName}`,
        role: currentUser.specialization || 'Doctor',
        initials: `${currentUser.firstName?.[0] || 'D'}${currentUser.lastName?.[0] || 'R'}`
      };
    }
    
    return {
      name: 'Dr. Loading...',
      role: 'Doctor',
      initials: 'DR'
    };
  }, [currentUser]); // 🔧 MEMOIZED WITH SPECIFIC DEPENDENCY

  // 🔄 NEW: Enhanced logo source with fallback and cache busting
  const getLogoSource = () => {
    // Determine which logo to use
    let logoUrl = null;
    
    // Priority: systemLogo.light > logo > fallback
    if (theme?.systemLogo?.light) {
      logoUrl = theme.systemLogo.light;
    } else if (theme?.logo) {
      logoUrl = theme.logo;
    }
    
    // If we have a tenant logo URL, add cache busting
    if (logoUrl && !logoError) {
      return `${logoUrl}?key=${logoKey}`;
    }
    
    // Fallback to default logo
    return logoImage;
  };

  // 🔄 NEW: Handle logo load errors
  const handleLogoError = () => {
    console.warn('🖼️ [DoctorLayout] Logo failed to load, using fallback');
    setLogoError(true);
  };

  // 🔄 NEW: Handle successful logo load
  const handleLogoLoad = () => {
    console.log('✅ [DoctorLayout] Logo loaded successfully');
    setLogoError(false);
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
          {/* 🔄 ENHANCED: Logo with real-time updates and error handling */}
          <img 
            key={logoKey} // Force re-render when key changes
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
          {/* 🔄 NEW: Debug info in development */}
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
                    opacity: item.implemented ? 1 : 0.6 // Slightly fade unimplemented items
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
          {process.env.NODE_ENV === 'development' && featureControl.getActiveFeatures && (
            <div className="dev-feature-status">
              <strong className="dev-title">🔧 Dev: Menu Status</strong>
              <div className="feature-list">
                <div className="feature-item">
                  <span className="feature-dot active"/>
                  <span className="feature-name">6 Menu Items Active</span>
                </div>
                <div className="feature-item">
                  <span className="feature-dot" style={{ backgroundColor: '#4CAF50' }}/>
                  <span className="feature-name">5 Implemented</span>
                </div>
                <div className="feature-item">
                  <span className="feature-dot" style={{ backgroundColor: '#ff9800' }}/>
                  <span className="feature-name">1 Pending (Messages)</span>
                </div>
              </div>
              
              {/* 🔄 NEW: Settings update indicator */}
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
        
        <div className="sidebar-footer">
          {/* 🔄 REMOVED: Doctor profile section completely removed - will be implemented later */}
          <button className="logout-button" onClick={handleLogout}>
            <span>Logout</span>
          </button>
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className="doctor-content">
        <div className="doctor-content-container">
          <Outlet />
        </div>
      </div>
      
      {/* 🔄 NEW: Real-time update notification (development only) */}
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
          🔄 Live Updates Active
        </div>
      )}
    </div>
  );
};

export default DoctorLayout;