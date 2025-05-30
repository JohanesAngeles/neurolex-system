// client/src/components/doctor/layout/DoctorLayout.jsx - Updated with Feature Control
import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useFeatureControl } from '../../../hooks/useFeatureControl';
import { useTenant } from '../../../context/TenantContext';
import '../../../styles/components/doctor/DoctorLayout.css';

// Import original icons
import logoImage from '../../../assets/images/Neurolex_Logo_New.png';
import dashboardIcon from '../../../assets/icons/dashboard_icon.svg';
import patientsIcon from '../../../assets/icons/UserManagement_Icon.svg';
import journalIcon from '../../../assets/icons/journal_icon.svg';
import templatesIcon from '../../../assets/icons/JournalManagement_Icon.svg';
import appointmentsIcon from '../../../assets/icons/appointment_icon.svg';
import messageIcon from '../../../assets/icons/messages_icon.svg';

const DoctorLayout = () => {
  const navigate = useNavigate();
  
  // 🔄 NEW: Use feature control hook
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
  const [logoKey, setLogoKey] = useState(Date.now());

  // Get tenant theme styles
  const theme = getThemeStyles();

  // Load current doctor info
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

  // 🔄 NEW: Listen for tenant settings updates and refresh logo
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

  // 🔄 UPDATED: Menu items with feature control integration
  const menuItems = React.useMemo(() => {
    const allItems = [
      { 
        id: 'dashboard', 
        label: 'Dashboard', 
        path: '/doctor', 
        icon: dashboardIcon,
        feature: 'Dashboard',
        alwaysShow: true, // Dashboard should always be available
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
        implemented: false // Not yet implemented
      }
    ];
    
    // 🔄 NEW: Filter items based on feature control
    return allItems.filter(item => {
      // Always show dashboard
      if (item.alwaysShow) {
        return true;
      }
      
      // 🔄 CHECK: Use feature control to determine visibility
      return featureControl.isFeatureEnabled && featureControl.isFeatureEnabled(item.feature);
    });
  }, [featureControl]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('tenant');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('tenant');
    
    navigate('/login');
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
          
          {/* 🔄 NEW: Feature Status Panel (Development Only) */}
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
        
        <div className="sidebar-footer">
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