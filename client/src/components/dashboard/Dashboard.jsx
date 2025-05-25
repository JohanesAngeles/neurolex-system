import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import DailyMoodTracker from './DailyMoodTracker';
import MoodCalendar from './MoodCalendar';
import TodoList from './TodoList';
import NotificationPanel from './NotificationPanel';
import { useAuth } from '../../App';  
import moodService from '../../services/moodService';
import authService from '../../services/authService';
import '../../styles/components/dashboard/dashboard.css';

// Import icons directly
import search from '../../assets/icons/search_icon.svg';
import journal from '../../assets/icons/journal_icon.svg';
// Import a default avatar image (placeholder)
import defaultAvatar from '../../assets/images/default_image.jpg'; // Make sure this path is correct

// Debug info component for development
const DebugInfo = ({ user, tenant, appointmentDebug, journalDebug }) => (
  <div style={{ 
    position: 'absolute', 
    top: '10px', 
    right: '10px', 
    background: '#f0f0f0', 
    padding: '10px', 
    border: '1px solid #ccc',
    borderRadius: '5px',
    zIndex: 1000,
    fontSize: '12px',
    width: '300px',
    opacity: 0.9
  }}>
    <h4>Debug Info:</h4>
    <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
      <li>User: {user ? `${user.firstName} ${user.lastName}` : 'Not loaded'}</li>
      <li>User ID: {user ? (user.id || user._id) : 'Not available'}</li>
      <li>Role: {user ? user.role : 'Unknown'}</li>
      <li>Tenant: {tenant ? tenant.name : 'Not available'}</li>
      <li>Tenant ID: {tenant ? tenant._id : 'Not available'}</li>
      {appointmentDebug && (
        <>
          <li style={{ marginTop: '10px' }}><strong>Appointment Debug:</strong></li>
          <li>Status: {appointmentDebug.status}</li>
          <li>Count: {appointmentDebug.count}</li>
          <li>Last Error: {appointmentDebug.error || 'None'}</li>
          <li>API URL: {appointmentDebug.url || 'Not set'}</li>
        </>
      )}
      {journalDebug && (
        <>
          <li style={{ marginTop: '10px' }}><strong>Journal Debug:</strong></li>
          <li>Status: {journalDebug.status}</li>
          <li>Count: {journalDebug.count}</li>
          <li>Last Error: {journalDebug.error || 'None'}</li>
          <li>API URL: {journalDebug.url || 'Not set'}</li>
        </>
      )}
    </ul>
  </div>
);

const Dashboard = () => {
  const [showMoodTracker, setShowMoodTracker] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [profileImageError, setProfileImageError] = useState(false);
  const [moodData, setMoodData] = useState(null);
  const [forceCalendarUpdate, setForceCalendarUpdate] = useState(0);
  const [tenant, setTenant] = useState(null);
  const [manualUser, setManualUser] = useState(null);
  const [appointments, setAppointments] = useState([]); // State for appointments
  const [loadingAppointments, setLoadingAppointments] = useState(true); // Loading state for appointments
  const [journalEntries, setJournalEntries] = useState([]); // State for journal entries
  const [loadingJournalEntries, setLoadingJournalEntries] = useState(true); // Loading state for journal entries
  const [appointmentDebug, setAppointmentDebug] = useState({
    status: 'Not started',
    count: 0,
    error: null,
    url: null
  });
  const [journalDebug, setJournalDebug] = useState({
    status: 'Not started',
    count: 0, 
    error: null,
    url: null
  });
  const { user } = useAuth(); // Get the current user from auth context

  // Determine the effective user - either from context or manual fallback
  const effectiveUser = user || manualUser;

  // Immediately load user data from localStorage on mount
  useEffect(() => {
    console.log("Dashboard: Immediate localStorage check");
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const userData = JSON.parse(userStr);
        console.log("Dashboard: Found user in localStorage immediately:", userData);
        setManualUser(userData);
        
        // Also try to get tenant info
        const tenantStr = localStorage.getItem('tenant');
        if (tenantStr) {
          try {
            const tenantData = JSON.parse(tenantStr);
            console.log("Dashboard: Found tenant in localStorage immediately:", tenantData);
            setTenant(tenantData);
          } catch (e) {
            console.error("Error parsing tenant data:", e);
          }
        }
      } else {
        console.log("Dashboard: No user data in localStorage");
      }
      
      // Set loading to false after checking localStorage
      setIsLoading(false);
    } catch (e) {
      console.error("Dashboard: Error checking localStorage:", e);
      setIsLoading(false);
    }
  }, []);

  // Fetch appointments from tenant database with direct API access
  useEffect(() => {
    const fetchAppointments = async () => {
      if (!effectiveUser) {
        setAppointmentDebug(prev => ({
          ...prev,
          status: 'No user data',
          error: 'User data not available'
        }));
        return;
      }
      
      try {
        setLoadingAppointments(true);
        setAppointmentDebug(prev => ({
          ...prev,
          status: 'Fetching started'
        }));
        
        // Get token DIRECTLY from localStorage
        const token = localStorage.getItem('token');
        
        if (!token) {
          console.error('No token found in localStorage');
          setAppointmentDebug(prev => ({
            ...prev,
            status: 'Auth error',
            error: 'No authentication token found'
          }));
          return;
        }
        
        // Get user and tenant IDs
        const userId = effectiveUser.id || effectiveUser._id;
        const tenantId = tenant ? tenant._id : null;
        
        if (!userId) {
          setAppointmentDebug(prev => ({
            ...prev,
            status: 'Missing user ID',
            error: 'User ID not available'
          }));
          return;
        }
        
        // Build URL with tenant ID if available
        let url = `/api/appointments/users/${userId}/appointments?status=upcoming`;
        if (tenantId) {
          url += `&tenantId=${tenantId}`;
        }
        
        setAppointmentDebug(prev => ({
          ...prev,
          status: 'Making API request',
          url: url
        }));
        
        console.log(`Fetching appointments for user ${userId}${tenantId ? ` in tenant ${tenantId}` : ''}`);
        
        // Make the API call with explicit token in headers
        const response = await axios.get(url, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        console.log('Appointments response:', response);
        
        if (Array.isArray(response.data)) {
          setAppointments(response.data);
          setAppointmentDebug(prev => ({
            ...prev,
            status: 'Success',
            count: response.data.length
          }));
        } else if (response.data && Array.isArray(response.data.data)) {
          setAppointments(response.data.data);
          setAppointmentDebug(prev => ({
            ...prev,
            status: 'Success (data wrapper)',
            count: response.data.data.length
          }));
        } else {
          setAppointments([]);
          setAppointmentDebug(prev => ({
            ...prev,
            status: 'No appointments found',
            count: 0
          }));
        }
      } catch (error) {
        console.error('Error fetching appointments:', error);
        setAppointments([]);
        
        // Try to refresh token if needed
        if (error.response && error.response.status === 401) {
          console.log('Attempting to refresh authentication...');
          try {
            // Call the auth service to fix user data
            await authService.fixUserData();
            setAppointmentDebug(prev => ({
              ...prev,
              status: 'Auth refreshed',
              error: 'Token was invalid, attempted refresh'
            }));
          } catch (refreshError) {
            console.error('Error refreshing authentication:', refreshError);
            setAppointmentDebug(prev => ({
              ...prev, 
              status: 'Auth refresh failed',
              error: 'Could not refresh authentication'
            }));
          }
        } else {
          setAppointmentDebug(prev => ({
            ...prev,
            status: 'Error',
            error: error.message || 'Unknown error'
          }));
        }
      } finally {
        setLoadingAppointments(false);
      }
    };
    
    fetchAppointments();
  }, [effectiveUser, tenant]);

 useEffect(() => {
  const fetchJournalEntries = async () => {
    if (!effectiveUser) {
      setJournalDebug(prev => ({
        ...prev,
        status: 'No user data',
        error: 'User data not available'
      }));
      return;
    }
    
    try {
      setLoadingJournalEntries(true);
      setJournalDebug(prev => ({
        ...prev,
        status: 'Fetching started'
      }));
      
      // Get token DIRECTLY from localStorage
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.error('No token found in localStorage');
        setJournalDebug(prev => ({
          ...prev,
          status: 'Auth error',
          error: 'No authentication token found'
        }));
        return;
      }
      
      // Get user and tenant IDs
      const userId = effectiveUser.id || effectiveUser._id;
      const tenantId = tenant ? tenant._id : null;
      
      // Use the same API endpoint as the JournalList component
      let url = `/api/journals`;
      
      // Add query parameters if needed
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);
      if (tenantId) params.append('tenantId', tenantId);
      params.append('limit', '5'); // Limit to 5 most recent entries for dashboard
      
      // Append params if we have any
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      setJournalDebug(prev => ({
        ...prev,
        status: 'Making API request',
        url: url
      }));
      
      console.log(`Trying to fetch journal entries from: ${url}`);
      
      // Set up headers with auth token and tenant if available
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
      
      if (tenantId) {
        headers['X-Tenant-ID'] = tenantId;
      }
      
      // Make the API call with explicit token in headers
      const response = await axios.get(url, { headers });
      
      console.log('Journal entries response:', response);
      
      // Process the response - handle different response formats
      if (Array.isArray(response.data)) {
        setJournalEntries(response.data);
        setJournalDebug(prev => ({
          ...prev,
          status: 'Success with direct array',
          count: response.data.length
        }));
      } else if (response.data && response.data.success && Array.isArray(response.data.data)) {
        setJournalEntries(response.data.data);
        setJournalDebug(prev => ({
          ...prev,
          status: 'Success with data wrapper',
          count: response.data.data.length
        }));
      } else {
        console.warn('Unexpected response format:', response.data);
        
        // Try to extract data in different formats
        const possibleData = response.data?.data || response.data?.entries || response.data?.journals || [];
        
        if (Array.isArray(possibleData) && possibleData.length > 0) {
          setJournalEntries(possibleData);
          setJournalDebug(prev => ({
            ...prev,
            status: 'Success with alternative field',
            count: possibleData.length
          }));
        } else {
          setJournalEntries([]);
          setJournalDebug(prev => ({
            ...prev,
            status: 'No journal entries found or invalid format',
            count: 0
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching journal entries:', error);
      setJournalEntries([]);
      setJournalDebug(prev => ({
        ...prev,
        status: 'Error',
        error: error.message || 'Unknown error'
      }));
      
      // Try multiple fallback endpoints if first one fails
      await tryFallbackJournalRoutes();
    } finally {
      setLoadingJournalEntries(false);
    }
  };
  
  // Helper function to try multiple fallback routes
  const tryFallbackJournalRoutes = async () => {
    const fallbackRoutes = [
      '/api/journal',                                 // Alternate endpoint
      `/api/users/${effectiveUser.id || effectiveUser._id}/journal-entries`, // User-specific endpoint
      '/api/journals/recent'                          // Possible recent entries endpoint
    ];
    
    const token = localStorage.getItem('token');
    const userId = effectiveUser.id || effectiveUser._id;
    const tenantId = tenant ? tenant._id : null;
    
    // Set up headers with auth token and tenant if available
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }
    
    for (const route of fallbackRoutes) {
      try {
        setJournalDebug(prev => ({
          ...prev,
          status: `Trying fallback route: ${route}`,
          url: route
        }));
        
        console.log(`Trying fallback route: ${route}`);
        
        const response = await axios.get(route, { headers });
        
        console.log(`Fallback response from ${route}:`, response);
        
        // Process various response formats
        if (Array.isArray(response.data)) {
          setJournalEntries(response.data);
          setJournalDebug(prev => ({
            ...prev,
            status: `Success with fallback route: ${route}`,
            count: response.data.length
          }));
          return; // Exit on success
        } else if (response.data && response.data.success && Array.isArray(response.data.data)) {
          setJournalEntries(response.data.data);
          setJournalDebug(prev => ({
            ...prev,
            status: `Success with fallback route: ${route} (data wrapper)`,
            count: response.data.data.length
          }));
          return; // Exit on success
        }
      } catch (fallbackError) {
        console.error(`Error with fallback route ${route}:`, fallbackError);
      }
    }
    
    // If we get here, all fallbacks failed
    setJournalDebug(prev => ({
      ...prev,
      status: 'All fallback attempts failed',
      error: 'Could not retrieve journal entries from any endpoint'
    }));
  };
  
  fetchJournalEntries();
}, [effectiveUser, tenant])

  useEffect(() => {
    if (effectiveUser) {
      console.log("Dashboard: User data available", effectiveUser);
      
      try {
        const userId = effectiveUser.id || effectiveUser._id;
        if (userId) {
          console.log("Dashboard: User ID:", userId);
        }
      } catch (error) {
        console.error("Error processing user data:", error);
      }
      
      // Check if user has submitted mood today
      const hasSubmitted = moodService.hasSubmittedToday();
      console.log("Dashboard: Has submitted mood today:", hasSubmitted);
      
      setShowMoodTracker(!hasSubmitted);
      setProfileImageError(false);
    }
  }, [effectiveUser]);

  // Listen for mood submissions globally
  useEffect(() => {
    const handleMoodSubmitted = (event) => {
      console.log("Dashboard: Captured mood submission event");
      if (event.detail) {
        setMoodData(event.detail);
        setForceCalendarUpdate(prev => prev + 1);
      }
    };

    window.addEventListener('moodSubmitted', handleMoodSubmitted);
    
    return () => {
      window.removeEventListener('moodSubmitted', handleMoodSubmitted);
    };
  }, []);

  // Get user initials
  const getUserInitials = () => {
    if (!effectiveUser) return 'U';
    return (effectiveUser.firstName?.charAt(0) || effectiveUser.name?.charAt(0) || 'U');
  };

  // Handle image error
  const handleImageError = () => {
    console.error("Profile image failed to load");
    setProfileImageError(true);
  };

  // Handle mood tracker submission
  const handleMoodTrackerSubmit = (submissionData) => {
    console.log("Mood tracker submitted:", submissionData);
    
    // Store the submitted mood data to pass to calendar
    setMoodData(submissionData);
    
    // Force calendar to update
    setForceCalendarUpdate(prev => prev + 1);
    
    // Hide the mood tracker
    setShowMoodTracker(false);
  };
  
  // Handle mood tracker close
  const handleMoodTrackerClose = () => {
    console.log("Mood tracker closed");
    setShowMoodTracker(false);
  };

  // Handle starting a new journal entry
  const handleStartJournal = () => {
    console.log('Starting new journal entry');
    window.location.href = '/dashboard/journal/new';
  };
  
  // Handle scheduling a new appointment
  const handleScheduleAppointment = () => {
    console.log('Opening appointment scheduler');
    window.location.href = '/dashboard/find-doctor';
  };
  
  // Handle viewing journal entry details
  const handleViewJournalEntry = (entryId) => {
    console.log('Viewing journal entry details:', entryId);
    window.location.href = `/dashboard/journal/${entryId}`;
  };

  // Format date for display
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  // Format time for display
  const formatTime = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error('Error formatting time:', error);
      return 'Invalid time';
    }
  };

  // IMPORTANT: Show loading state with detailed info
  if (isLoading) {
    return (
      <div className="dashboard-loading">
        <h2>Loading dashboard...</h2>
        <p>Please wait while we retrieve your information.</p>
      </div>
    );
  }

  // IMPORTANT: Error state if no user data
  if (!effectiveUser) {
    return (
      <div className="dashboard-error">
        <h2>Dashboard Error</h2>
        <p>Could not load user data. Please try logging in again.</p>
        <button onClick={() => authService.logout()} className="error-button">
          Return to Login
        </button>
      </div>
    );
  }

  return (
    <div className={`dashboard-container ${showMoodTracker ? 'with-mood-tracker' : ''}`}>
      {/* Debug info in development mode - COMMENTED OUT */}
      {/* 
        {process.env.NODE_ENV !== 'production' && 
          <DebugInfo 
            user={effectiveUser} 
            tenant={tenant} 
            appointmentDebug={appointmentDebug}
            journalDebug={journalDebug}
          />
        }
      */}

      {showMoodTracker && (
        <div className="mood-tracker-wrapper">
          <DailyMoodTracker 
            onSubmit={handleMoodTrackerSubmit} 
            onClose={handleMoodTrackerClose}
            user={effectiveUser}
          />
        </div>
      )}

      <div className="dashboard-content-area">
        <div className="dashboard-content-container">
          <div className="dashboard-header">
            <div className="user-welcome">
              <h1>Hi, {effectiveUser?.firstName || effectiveUser?.name?.split(' ')[0] || 'User'}</h1>
              <p className="dashboard-subtitle">
                Track your progress, understand your emotions, and boost your well-being
              </p>
            </div>
            
            <div className="dashboard-actions">
              <div className="action-icon search-icon">
                <img src={search} alt="Search" />
              </div>
              <div className="action-icon notification-icon">
                <NotificationPanel user={effectiveUser} />
              </div>
              <div className="profile-icon">
                {profileImageError || !effectiveUser?.profilePicture ? (
                  <div className="profile-initials">{getUserInitials()}</div>
                ) : (
                  <img 
                    src={effectiveUser.profilePicture} 
                    alt="Profile" 
                    crossOrigin="anonymous"
                    referrerPolicy="no-referrer"
                    className="profile-image" 
                    onError={handleImageError}
                  />
                )}
              </div>
            </div>
          </div>
          
          {/* Added divider below the header */}
          <div className="dashboard-header-divider"></div>

          <div className="dashboard-main">
            {/* Layout with two columns */}
            <div className="dashboard-flex-layout">
              {/* Left side - Journal section */}
              <div className="dashboard-left-column">
                <div className="journal-section">
                  {/* Keep the existing journal-container section */}
                  <div className="journal-container compact-journal">
                    <button className="journal-button" onClick={handleStartJournal}>
                      <img src={journal} alt="Journal" />
                      <div className="journal-button-text">
                        <h3>Today's Journal</h3>
                        <p>What's on your mind?</p>
                      </div>
                    </button>
                  </div>
                  
                  {/* UPDATED JOURNAL LOG SECTION */}
                 
                  {/* Journal Log Section */}
                  <div className="journal-log-container">
  <div className="journal-log-header">
    <h2>Journal Log</h2>
    <Link to="/dashboard/journal" className="view-all-link">
      View All
    </Link>
  </div>
  
  {/* Display journal entries or loading/empty state */}
  {loadingJournalEntries ? (
    <div className="loading-state">
      <p>Loading your journal entries...</p>
    </div>
  ) : journalEntries && journalEntries.length > 0 ? (
    <div className="journal-entries-list">
      {journalEntries.map(entry => {
        console.log("Processing journal entry:", entry); // Debug log
        
        // Extract mood value
        let moodValue = "neutral";
        if (entry.journalFields?.quickMood === 'positive' || 
            (entry.sentimentAnalysis?.sentiment?.type === 'positive') ||
            entry.mood === "I'm good") {
          moodValue = "positive";
        } else if (entry.journalFields?.quickMood === 'negative' || 
                  (entry.sentimentAnalysis?.sentiment?.type === 'negative') ||
                  entry.mood === "I'm struggling") {
          moodValue = "negative";
        }
        
        return (
          <div key={entry._id} className="journal-entry-item">
            <div className="entry-emoji-container">
              <span className={`mood-emoji ${moodValue}`}>
                {moodValue === "positive" ? "😊" : 
                 moodValue === "negative" ? "😔" : "😐"}
              </span>
            </div>
            
            <div className="entry-content">
              <h3 className="entry-title">
                {entry.title || 
                 (entry.template && entry.template.name) || 
                 `Journal Entry - ${formatDate(entry.createdAt || entry.date)}`}
              </h3>
              
              <p className="entry-date">
                Created on {formatDate(entry.createdAt || entry.date)}
              </p>
              
              {/* Add sentiment and emotions if available */}
              {(entry.sentimentAnalysis || entry.emotions || entry.mood) && (
                <div className="entry-metadata">
                  {entry.sentimentAnalysis?.sentiment?.type && (
                    <span className="entry-sentiment">
                      {entry.sentimentAnalysis.sentiment.type.charAt(0).toUpperCase() + 
                       entry.sentimentAnalysis.sentiment.type.slice(1)}
                    </span>
                  )}
                  
                  {entry.emotions && Array.isArray(entry.emotions) && entry.emotions.length > 0 && (
                    <div className="entry-emotions">
                      {entry.emotions.slice(0, 2).map((emotion, idx) => (
                        <span key={idx} className="emotion-tag">{emotion}</span>
                      ))}
                    </div>
                  )}
                  
                  {entry.sentimentAnalysis?.emotions && Object.keys(entry.sentimentAnalysis.emotions).length > 0 && (
                    <div className="entry-emotions">
                      {Object.entries(entry.sentimentAnalysis.emotions)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 2)
                        .map(([emotion, _], idx) => (
                          <span key={idx} className="emotion-tag">{emotion}</span>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <button 
              className="view-entry-button" 
              onClick={() => handleViewJournalEntry(entry._id)}
            >
              View
            </button>
          </div>
        );
      })}
    </div>
  ) : (
    <div className="empty-state">
      <p>📔 Your journal is waiting — write your first entry today!</p>
      <button 
        className="dashboard-action-button journal-action-button" 
        onClick={handleStartJournal}
      >
        Write my first entry
      </button>
    </div>  
                    )}
                  </div>
                </div>
                
                {/* Added divider below journal section */}
                <div className="journal-section-divider"></div>

                {/* UPDATED APPOINTMENT SECTION WITH FIXED PLACEHOLDER */}
                {/* DASHBOARD-SPECIFIC APPOINTMENT SECTION */}
<div className="dashboard-appointment-section">
  <div className="dashboard-appointment-header">
    <h2>Upcoming Appointment</h2>
    <Link to="/dashboard/appointments" className="dashboard-view-all-link">
      View All
    </Link>
  </div>
  
  {/* Display appointments or loading/empty state */}
  {loadingAppointments ? (
    <div className="dashboard-loading-state">
      <p>Loading your appointments...</p>
    </div>
  ) : appointments && appointments.length > 0 ? (
    <div className="dashboard-appointment-card">
      {/* Doctor Info */}
      <div className="dashboard-doctor-info">
        <div className="dashboard-doctor-avatar">
          {appointments[0].doctor && appointments[0].doctor.profilePicture ? (
            <img 
              src={appointments[0].doctor.profilePicture} 
              alt="Doctor" 
              onError={(e) => {
                e.target.onerror = null;
                // Use inline SVG as fallback instead of missing image
                e.target.outerHTML = `<div class="dashboard-default-avatar"><span>${appointments[0].doctor ? appointments[0].doctor.firstName?.charAt(0) : 'D'}</span></div>`;
              }}
            />
          ) : (
            <div className="dashboard-default-avatar">
              <span>{appointments[0].doctor ? appointments[0].doctor.firstName?.charAt(0) : 'D'}</span>
            </div>
          )}
        </div>
        <div className="dashboard-doctor-details">
          <h3 className="dashboard-doctor-name">
            Dr. {appointments[0].doctor ? 
              `${appointments[0].doctor.firstName || ''} ${appointments[0].doctor.lastName || ''}` : 
              'Doctor Name'}
          </h3>
          <p className="dashboard-doctor-specialty">
            {appointments[0].doctor?.specialty || 'Psychotherapist'}
          </p>
        </div>
        <button 
          className="dashboard-view-details-button" 
          onClick={() => window.location.href = `/dashboard/appointments/${appointments[0]._id}`}
        >
          View Details
        </button>
      </div>
      
      {/* Appointment Time */}
      <div className="dashboard-appointment-time-container">
        <div className="dashboard-appointment-date-box">
          <div className="dashboard-appointment-icon">
            <span className="dashboard-calendar-icon">📅</span>
          </div>
          <div className="dashboard-appointment-date">
            {formatDate(appointments[0].appointmentDate)}
          </div>
        </div>
        
        <div className="dashboard-appointment-time-box">
          <div className="dashboard-appointment-icon">
            <span className="dashboard-clock-icon">🕓</span>
          </div>
          <div className="dashboard-appointment-time">
            {formatTime(appointments[0].appointmentDate)}
          </div>
        </div>
      </div>
    </div>
  ) : (
    <div className="dashboard-appointment-empty-state">
      <p>📅 You don't have any upcoming appointments.</p>
      <button 
        className="dashboard-appointment-action-button" 
        onClick={handleScheduleAppointment}
      >
        Schedule an appointment
      </button>
    </div>
  )}
</div>
{/* END DASHBOARD-SPECIFIC APPOINTMENT SECTION */}
              </div>
              
              {/* Right side - Calendar and To-Do List */}
              <div className="dashboard-right-column">
                <MoodCalendar 
                  key={`mood-calendar-${forceCalendarUpdate}`}
                  refreshTrigger={forceCalendarUpdate}
                  newMoodData={moodData}
                  user={effectiveUser}
                />
                {/* Pass onShowMoodTracker prop to TodoList */}
                <TodoList 
                  user={effectiveUser} 
                  onShowMoodTracker={() => setShowMoodTracker(true)} 
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;