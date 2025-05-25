// client/src/components/doctors/DoctorLayout.jsx
import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import '../../../styles/components/doctor/DoctorLayout.css';

// Import logo (adjust path as needed)
import logoImage from '../../../assets/images/Neurolex_Logo_New.png';

// Import icons (adjust paths as needed)
import dashboardIcon from '../../../assets/icons/dashboard_icon.svg';
import patientsIcon from '../../../assets/icons/UserManagement_Icon.svg';
import journalIcon from '../../../assets/icons/JournalManagement_Icon.svg';
import templatesIcon from '../../../assets/icons/JournalManagement_Icon.svg';
import appointmentsIcon from '../../../assets/icons/appointment_icon.svg';
import settingsIcon from '../../../assets/icons/Settings_icon.svg';

const DoctorLayout = () => {
  const navigate = useNavigate();
  
  // Menu items with proper icon imports
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', path: '/doctor', icon: dashboardIcon },
    { id: 'patients', label: 'Patients', path: '/doctor/patients', icon: patientsIcon },
    { id: 'journal', label: 'Journal Entries', path: '/doctor/journal-entries', icon: journalIcon },
    { id: 'templates', label: 'Form Templates', path: '/doctor/form-templates', icon: templatesIcon },
    { id: 'appointments', label: 'Appointments', path: '/doctor/appointments', icon: appointmentsIcon },
    { id: 'settings', label: 'Settings', path: '/doctor/settings', icon: settingsIcon }
  ];
  
  const handleLogout = () => {
    // Clear token from localStorage
    localStorage.removeItem('token');
    // Redirect to login page
    navigate('/login');
  };

  return (
    <div className="doctor-layout">
      {/* Left Sidebar */}
      <div className="doctor-sidebar">
        <div className="sidebar-header">
          <img src={logoImage} alt="Neurolex Logo" className="doctor-logo" />
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
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
        
        <div className="sidebar-footer">
          <div className="doctor-info" onClick={() => navigate('/doctor/profile')}>
            <div className="doctor-avatar">
              <span>D</span>
            </div>
            <div className="doctor-details">
              <p className="doctor-name">Dr. Smith</p>
              <p className="doctor-role">Psychiatrist</p>
            </div>
          </div>
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