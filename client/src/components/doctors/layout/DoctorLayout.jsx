// client/src/components/doctors/DoctorLayout.jsx
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
import settingsIcon from '../../../assets/icons/Settings_icon.svg';

const DoctorLayout = () => {
  const navigate = useNavigate();
  const featureControl = useFeatureControl();
  const { currentTenant, getThemeStyles, platformName, isLoading } = useTenant();
  const [currentUser, setCurrentUser] = useState(null);

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

  // Define all possible menu items with feature mapping
  const getAllMenuItems = () => [
    { 
      id: 'dashboard', 
      label: 'Dashboard', 
      path: '/doctor', 
      icon: dashboardIcon,
      feature: 'User Dashboard',
      alwaysShow: true // Dashboard should always be available
    },
    { 
      id: 'patients', 
      label: 'Patients', 
      path: '/doctor/patients', 
      icon: patientsIcon,
      feature: 'User Profiles' // Maps to User Profiles HIRS setting
    },
    { 
      id: 'journal', 
      label: 'Journal Entries', 
      path: '/doctor/journal-entries', 
      icon: journalIcon,
      feature: 'Journal Entries'
    },
    { 
      id: 'templates', 
      label: 'Form Templates', 
      path: '/doctor/form-templates', 
      icon: templatesIcon,
      feature: 'Journal Entries' // Templates are part of journal functionality
    },
    { 
      id: 'appointments', 
      label: 'Appointments', 
      path: '/doctor/appointments', 
      icon: appointmentsIcon,
      feature: 'Care / Report' // Appointments are part of care management
    },
    { 
      id: 'assessments', 
      label: 'Mental Assessments', 
      path: '/doctor/assessments', 
      icon: dashboardIcon, // You can add a specific assessment icon
      feature: 'Dr Mental Assessments'
    },
    { 
      id: 'analytics', 
      label: 'Analytics', 
      path: '/doctor/analytics', 
      icon: dashboardIcon, // You can add a specific analytics icon
      feature: 'Data Analytics'
    },
    { 
      id: 'settings', 
      label: 'Settings', 
      path: '/doctor/settings', 
      icon: settingsIcon,
      feature: 'Config'
    }
  ];

  // Filter menu items based on tenant feature settings
  const getFilteredMenuItems = () => {
    const allItems = getAllMenuItems();
    
    return allItems.filter(item => {
      // Always show dashboard and items marked as alwaysShow
      if (item.alwaysShow) {
        return true;
      }
      
      // Check if feature is enabled for this tenant
      return featureControl.isFeatureEnabled(item.feature);
    });
  };

  const menuItems = getFilteredMenuItems();

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

  // Get doctor display info
  const getDoctorDisplayInfo = () => {
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
  };

  const doctorInfo = getDoctorDisplayInfo();

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
      <div className="doctor-sidebar" style={{
        // Apply tenant primary color as accent
        borderRight: `3px solid ${theme.primaryColor}`
      }}>
        <div className="sidebar-header">
          <img 
            src={theme.logo || logoImage} 
            alt={`${platformName} Logo`} 
            className="doctor-logo" 
            style={{
              // Add subtle styling based on tenant theme
              filter: currentTenant ? 'none' : 'grayscale(0.2)'
            }}
          />
          {/* Show tenant name if multi-tenant */}
          {currentTenant && (
            <div className="tenant-indicator" style={{
              fontSize: '12px',
              color: theme.primaryColor,
              textAlign: 'center',
              marginTop: '5px',
              fontWeight: '500'
            }}>
              {currentTenant.name}
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
                  style={({ isActive }) => ({
                    // Apply tenant colors to active state
                    backgroundColor: isActive ? theme.primaryColor : 'transparent',
                    borderLeft: isActive ? `4px solid ${theme.secondaryColor}` : 'none'
                  })}
                >
                  <img src={item.icon} alt={item.label} className="nav-icon" />
                  <span className="nav-label">{item.label}</span>
                  
                  {/* Show feature status indicator in development */}
                  {process.env.NODE_ENV === 'development' && (
                    <span 
                      className="feature-indicator"
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: featureControl.isFeatureEnabled(item.feature) ? '#4CAF50' : '#f44336',
                        marginLeft: 'auto',
                        flexShrink: 0
                      }}
                      title={`Feature: ${item.feature} - ${featureControl.isFeatureEnabled(item.feature) ? 'Enabled' : 'Disabled'}`}
                    />
                  )}
                </NavLink>
              </li>
            ))}
          </ul>

          {/* Feature Status Panel (Development Only) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="dev-feature-status" style={{
              margin: '20px 10px',
              padding: '10px',
              backgroundColor: '#f5f5f5',
              borderRadius: '8px',
              fontSize: '11px'
            }}>
              <strong style={{ color: theme.primaryColor }}>🔧 Dev: Active Features</strong>
              <div style={{ marginTop: '5px' }}>
                {featureControl.getActiveFeatures().slice(0, 4).map(feature => (
                  <div key={feature.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    marginBottom: '2px'
                  }}>
                    <span style={{
                      width: '6px',
                      height: '6px',
                      backgroundColor: '#4CAF50',
                      borderRadius: '50%'
                    }}/>
                    <span>{feature.name}</span>
                  </div>
                ))}
                {featureControl.getActiveFeatures().length > 4 && (
                  <div style={{ color: '#666', fontStyle: 'italic' }}>
                    +{featureControl.getActiveFeatures().length - 4} more...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        <div className="sidebar-footer">
          <div className="doctor-info" onClick={() => navigate('/doctor/profile')}>
            <div 
              className="doctor-avatar"
              style={{
                backgroundColor: theme.primaryColor,
                color: 'white'
              }}
            >
              <span>{doctorInfo.initials}</span>
            </div>
            <div className="doctor-details">
              <p className="doctor-name">{doctorInfo.name}</p>
              <p className="doctor-role">{doctorInfo.role}</p>
              {currentTenant && (
                <p className="doctor-clinic" style={{
                  fontSize: '11px',
                  color: '#666',
                  margin: '2px 0 0 0'
                }}>
                  {currentTenant.name}
                </p>
              )}
            </div>
          </div>
          <button 
            className="logout-button" 
            onClick={handleLogout}
            style={{
              borderColor: theme.primaryColor,
              color: theme.primaryColor
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = theme.primaryColor;
              e.target.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent';
              e.target.style.color = theme.primaryColor;
            }}
          >
            <span>Logout</span>
          </button>
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className="doctor-content">
        {/* Optional: Add tenant branding header */}
        {currentTenant && (
          <div className="content-header" style={{
            background: `linear-gradient(135deg, ${theme.primaryColor}15, ${theme.secondaryColor}15)`,
            padding: '10px 20px',
            borderBottom: '1px solid #e0e0e0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <h4 style={{ 
                margin: 0, 
                color: theme.primaryColor,
                fontSize: '16px' 
              }}>
                {platformName} - Medical Dashboard
              </h4>
              <p style={{ 
                margin: 0, 
                fontSize: '12px', 
                color: '#666' 
              }}>
                {currentTenant.name} | {doctorInfo.role}
              </p>
            </div>
            
            {/* Feature count indicator */}
            <div style={{
              fontSize: '12px',
              color: '#666',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span>
                {featureControl.getActiveFeatures().length} features active
              </span>
              <div style={{
                width: '8px',
                height: '8px',
                backgroundColor: theme.primaryColor,
                borderRadius: '50%'
              }}/>
            </div>
          </div>
        )}
        
        <div className="doctor-content-container">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default DoctorLayout;