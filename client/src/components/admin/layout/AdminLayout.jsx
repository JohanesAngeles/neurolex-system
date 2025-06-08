import React from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { AdminProvider } from '../../../context/AdminContext';
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
// TODO: Add mood check-ins icon - using journal icon for now
import moodIcon from '../../../assets/icons/mood_icon.svg';

const AdminLayout = () => {
  const location = useLocation();

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

  // 🆕 UPDATED: Menu items with mood check-ins route
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', path: '/admin', icon: dashboardIcon },
    { id: 'users', label: 'User Management', path: '/admin/users', icon: usersIcon }, // This handles both users and patients
    { id: 'professionals', label: 'Doctor Management', path: '/admin/professionals', icon: doctorIcon },
    { id: 'mood', label: 'Mood Analytics', path: '/admin/mood-checkins', icon: moodIcon }, // 🆕 NEW: Mood Check-ins
    { id: 'tenants', label: 'Tenant Management', path: '/admin/tenants', icon: tenantIcon },
    { id: 'journal', label: 'Journal Management', path: '/admin/journal-entries', icon: journalIcon }, 
    { id: 'settings', label: 'System Settings', path: '/admin/settings', icon: settingsIcon }
  ];

  return (
    <AdminProvider>
      <div className="admin-layout">
        {/* Left Sidebar - matching the image */}
        <div className="admin-sidebar">
          <div className="sidebar-header">
            <img src={logoImage} alt="Neurolex Logo" className="admin-logo" />
          </div>
          
          <div className="sidebar-menu">
            <ul className="nav-menu">
              {menuItems.map(item => (
                <li key={item.id} className="nav-item">
                  <NavLink 
                    to={item.path}
                    className={() => {
                      // Use custom logic for determining active state
                      const shouldBeActive = isActiveRoute(item.path, item.id);
                      return shouldBeActive ? "nav-link active" : "nav-link";
                    }}
                    end={item.path === '/admin'}
                    title={item.label} // Add tooltip for better UX
                  >
                    <img src={item.icon} alt={item.label} className="nav-icon" />
                    <span className="nav-label">{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="sidebar-footer">
            <div className="admin-info">
              <div className="admin-details">
                <p className="admin-name">Admin User</p>
                <p className="admin-role">System Admin</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Main Content Area with admin-content-container */}
        <div className="admin-content">
          <div className="admin-content-container">
            <Outlet />
          </div>
        </div>
      </div>
    </AdminProvider>
  );
};

export default AdminLayout;