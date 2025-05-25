import React from 'react';
import { NavLink } from 'react-router-dom';
import '../../styles/components/dashboard/sidebar.css';
// Import logo
import logo from '../../assets/images/sidebar_logo.png';

// Import icons directly
import dashboardIcon from '../../assets/icons/dashboard_icon.svg';
import journalIcon from '../../assets/icons/journal_icon.svg';
import appointmentIcon from '../../assets/icons/appointment_icon.svg';
import messagesIcon from '../../assets/icons/messages_icon.svg';
import moodIcon from '../../assets/icons/mood_icon.svg';
import logoutIcon from '../../assets/icons/Logout_button.svg';

const Sidebar = () => {
  // Navigation items using imported SVGs
  const navItems = [
    {
      path: '/dashboard',
      icon: dashboardIcon,
      label: 'Dashboard',
      exact: true
    },
    {
      path: '/dashboard/journal',
      icon: journalIcon,
      label: 'Journaling'
    },
    {
      path: '/dashboard/other',
      icon: moodIcon,
      label: 'Other Page'
    },
    {
      path: '/dashboard/find-doctor',
      icon: appointmentIcon,
      label: 'Find Doctor'
    },
    {
      path: '/dashboard/messages',
      icon: messagesIcon,
      label: 'Messages'
    }
  ];

  const handleLogout = () => {
    // We'll implement logout functionality later
    console.log('Logout clicked');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <img src={logo} alt="Neurolex Logo" className="sidebar-logo" />
      </div>
      
      <nav className="sidebar-nav">
        <ul className="nav-list">
          {navItems.map((item) => (
            <li key={item.path} className="nav-item">
              <NavLink
                to={item.path}
                end={item.exact}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                title={item.label}
              >
                <div className="icon-container">
                  <img src={item.icon} alt={`${item.label} icon`} className="nav-icon" />
                </div>
                {/* Label removed - still keeping for accessibility but hidden with CSS */}
                <span className="nav-label">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      
      <div className="sidebar-footer">
        <button onClick={handleLogout} className="logout-button" title="Logout">
          <div className="icon-container">
            <img src={logoutIcon} alt="Logout icon" className="nav-icon" />
          </div>
          <span className="nav-label">Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;