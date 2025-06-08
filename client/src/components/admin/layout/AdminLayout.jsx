import React, { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { AdminProvider } from '../../../context/AdminContext';
import authService from '../../../services/authService';
import '../../../styles/components/admin/AdminLayout.css';

// Import logo
import logoImage from '../../../assets/images/Neurolex_Logo_New.png';

// Import icons
import dashboardIcon from '../../../assets/icons/dashboard_icon.svg';
import usersIcon from '../../../assets/icons/UserManagement_Icon.svg';
import doctorIcon from '../../../assets/icons/DoctorManagement_Icon.svg';
import journalIcon from '../../../assets/icons/JournalManagement_Icon.svg';
import tenantIcon from '../../../assets/icons/clinic_icon.svg';
import settingsIcon from '../../../assets/icons/Settings_icon.svg';
import moodIcon from '../../../assets/icons/mood_icon.svg';
// Using settings icon for logout - replace with your actual logout icon
import logoutIcon from '../../../assets/icons/admin_icon.svg';

const AdminLayout = () => {
  const location = useLocation();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Custom active check function for nested routes
  const isActiveRoute = (path, menuId) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    
    // Special case for User Management - include both users and patients routes
    if (menuId === 'users') {
      return location.pathname.startsWith('/admin/users') || 
             location.pathname.startsWith('/admin/patients');
    }
    
    // Special case for Journal Management - include both templates and journal entries
    if (menuId === 'journal') {
      return location.pathname.startsWith('/admin/templates') || 
             location.pathname.startsWith('/admin/journal-entries');
    }

    // Special case for Mood Check-ins
    if (menuId === 'mood') {
      return location.pathname.startsWith('/admin/mood-checkins');
    }
    
    return location.pathname.startsWith(path);
  };

  // Handle logout confirmation
  const handleLogoutClick = () => {
    console.log('Logout button clicked!'); // Debug log
    setShowLogoutModal(true);
  };

  // Handle logout confirmation
  const handleLogoutConfirm = () => {
    try {
      // Use the auth service logout function
      authService.logout();
    } catch (error) {
      console.error('Error during logout:', error);
      // Force logout even if there's an error
      localStorage.removeItem('token');
      localStorage.removeItem('adminToken');
      localStorage.removeItem('user');
      localStorage.removeItem('tenant');
      window.location.href = '/login';
    }
    setShowLogoutModal(false);
  };

  // Handle logout cancellation
  const handleLogoutCancel = () => {
    setShowLogoutModal(false);
  };

  // Menu items
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', path: '/admin', icon: dashboardIcon },
    { id: 'users', label: 'User Management', path: '/admin/users', icon: usersIcon },
    { id: 'professionals', label: 'Doctor Management', path: '/admin/professionals', icon: doctorIcon },
    { id: 'mood', label: 'Mood Analytics', path: '/admin/mood-checkins', icon: moodIcon },
    { id: 'tenants', label: 'Tenant Management', path: '/admin/tenants', icon: tenantIcon },
    { id: 'journal', label: 'Journal Management', path: '/admin/journal-entries', icon: journalIcon }, 
    { id: 'settings', label: 'System Settings', path: '/admin/settings', icon: settingsIcon }
  ];

  return (
    <AdminProvider>
      <div className="admin-layout">
        {/* Left Sidebar */}
        <div className="admin-sidebar">
          {/* Wrap top content in a container */}
          <div className="sidebar-top-content">
            {/* Top Logo Section */}
            <div className="sidebar-top">
              <div className="logo-container">
                <img src={logoImage} alt="Neurolex Logo" className="admin-logo" />
              </div>
            </div>
            
            {/* Navigation Menu */}
            <div className="sidebar-nav">
              <ul className="nav-menu">
                {menuItems.map(item => (
                  <li key={item.id} className="nav-item">
                    <NavLink 
                      to={item.path}
                      className={() => {
                        const shouldBeActive = isActiveRoute(item.path, item.id);
                        return shouldBeActive ? "nav-link active" : "nav-link";
                      }}
                      end={item.path === '/admin'}
                      title={item.label}
                    >
                      <img src={item.icon} alt={item.label} className="nav-icon" />
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          
          {/* Bottom Section - Logout Button - NOW POSITIONED ABSOLUTELY */}
          <div className="sidebar-bottom">
            <button 
              className="logout-container"
              onClick={handleLogoutClick}
              title="Logout"
            >
              <img 
                src={logoutIcon} 
                alt="Logout" 
                className="logout-icon"
              />
            </button>
          </div>
        </div>
        
        {/* Main Content Area */}
        <div className="admin-content">
          <div className="admin-content-container">
            <Outlet />
          </div>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="logout-modal-overlay">
          <div className="logout-modal">
            <div className="logout-modal-header">
              <h3>Confirm Logout</h3>
            </div>
            <div className="logout-modal-body">
              <p>Are you sure you want to logout? You will need to sign in again to access the admin panel.</p>
            </div>
            <div className="logout-modal-footer">
              <button 
                className="logout-cancel-btn"
                onClick={handleLogoutCancel}
              >
                Cancel
              </button>
              <button 
                className="logout-confirm-btn"
                onClick={handleLogoutConfirm}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminProvider>
  );
};

export default AdminLayout;