// client/src/components/admin/layout/AdminLayout.jsx
import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { AdminProvider } from '../../../context/AdminContext';
import '../../../styles/components/admin/AdminLayout.css';

// Import logo
import logoImage from '../../../assets/images/Neurolex_Logo_New.png';

// Import icons
import dashboardIcon from '../../../assets/icons/dashboard_icon.svg';
import usersIcon from '../../../assets/icons/UserManagement_Icon.svg';
import doctorIcon from '../../../assets/icons/DoctorManagement_Icon.svg';
import journalIcon from '../../../assets/icons/JournalManagement_Icon.svg';
import settingsIcon from '../../../assets/icons/Settings_icon.svg';


const AdminLayout = () => {
  // Menu items with proper icon imports
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', path: '/admin', icon: dashboardIcon },
    { id: 'users', label: 'User Management', path: '/admin/users', icon: usersIcon },
    { id: 'professionals', label: 'Doctor Management', path: '/admin/professionals', icon: doctorIcon },
    { id: 'journal', label: 'Journal Management', path: '/admin/journal', icon: journalIcon },
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
                    className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
                    end={item.path === '/admin'}
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

