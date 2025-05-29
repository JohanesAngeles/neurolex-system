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

  // Get tenant theme styles - this will now be dynamic from system settings
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

  // Apply dynamic tenant styles to CSS variables when theme changes
  useEffect(() => {
    if (theme && typeof document !== 'undefined') {
      const root = document.documentElement;
      
      // Set CSS custom properties for dynamic theming
      root.style.setProperty('--tenant-primary-color', theme.primaryColor || '#4CAF50');
      root.style.setProperty('--tenant-secondary-color', theme.secondaryColor || '#2196F3');
      root.style.setProperty('--tenant-primary-rgb', hexToRgb(theme.primaryColor || '#4CAF50'));
      root.style.setProperty('--tenant-secondary-rgb', hexToRgb(theme.secondaryColor || '#2196F3'));
    }
  }, [theme]);

  // Helper function to convert hex to RGB for CSS variables
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result 
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
      : '76, 175, 80'; // Default green fallback
  };

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
      <div className="doctor-sidebar">
        <div className="sidebar-header">
          <img 
            src={theme.systemLogo?.light || theme.logo || logoImage} 
            alt="Logo" 
            className="doctor-logo" 
          />
        </div>
        
        <div className="sidebar-menu">
          <ul className="nav-menu">
            {menuItems.map(item => (
              <li key={item.id} className="nav-item">
                <NavLink 
                  to={item.path}
                  className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
                  end={item.path === '/doctor'}
                >
                  <img src={item.icon} alt={item.label} className="nav-icon" />
                  <span className="nav-label">{item.label}</span>
                  
                  {/* Show feature status indicator in development */}
                  {process.env.NODE_ENV === 'development' && (
                    <span 
                      className={`feature-indicator ${featureControl.isFeatureEnabled(item.feature) ? 'enabled' : 'disabled'}`}
                      title={`Feature: ${item.feature} - ${featureControl.isFeatureEnabled(item.feature) ? 'Enabled' : 'Disabled'}`}
                    />
                  )}
                </NavLink>
              </li>
            ))}
          </ul>

          {/* Feature Status Panel (Development Only) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="dev-feature-status">
              <strong className="dev-title">🔧 Dev: Active Features</strong>
              <div className="feature-list">
                {featureControl.getActiveFeatures().slice(0, 4).map(feature => (
                  <div key={feature.id} className="feature-item">
                    <span className="feature-dot active"/>
                    <span className="feature-name">{feature.name}</span>
                  </div>
                ))}
                {featureControl.getActiveFeatures().length > 4 && (
                  <div className="feature-more">
                    +{featureControl.getActiveFeatures().length - 4} more...
                  </div>
                )}
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
    </div>
  );
};

export default DoctorLayout;