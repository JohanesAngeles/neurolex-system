// client/src/components/doctors/dashboard/DoctorDashboard.jsx - FIXED INFINITE LOOP
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFeatureControl } from '../../hooks/useFeatureControl';
import { useTenant } from '../../context/TenantContext';
import FeatureWrapper from '../common/FeatureWrapper';

import doctorService from '../../services/doctorService';
import '../../styles/components/doctor/DoctorDashboard.css';

const DoctorDashboard = () => {
  // ✅ NEW: Add dynamic feature control
  const featureControl = useFeatureControl();
  const { currentTenant, getThemeStyles, platformName } = useTenant();
  const theme = getThemeStyles();
  
  const [stats, setStats] = useState({
    totalPatients: 0,
    totalAppointments: 0,
    pendingEntries: 0,
    newMessages: 0
  });
  const [, setRecentEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState('This Week');
  const [doctorInfo, setDoctorInfo] = useState({
    firstName: '',
    lastName: ''
  });
  const [todayAppointments, setTodayAppointments] = useState([]);
  const navigate = useNavigate();

  // ✅ ENHANCED: Function to handle joining video meeting with feature check
  const handleJoinMeeting = (appointment) => {
    // Check if Care/Report feature is enabled (appointments functionality)
    if (!featureControl.isFeatureEnabled('Care / Report')) {
      alert('Video meeting functionality is currently disabled for your clinic. Please contact your administrator.');
      return;
    }

    const meetingLink = appointment.meetingLink;
    
    if (!meetingLink) {
      alert('No meeting link available for this appointment. Please ensure the appointment is confirmed and has a video session scheduled.');
      return;
    }
    
    console.log('🎥 Doctor joining meeting:', meetingLink);
    
    // Determine meeting platform
    const getMeetingPlatform = (url) => {
      try {
        const urlObj = new URL(url);
        if (urlObj.hostname === 'meet.google.com') return 'Google Meet';
        if (urlObj.hostname === 'meet.jit.si') return 'Jitsi Meet';
        if (urlObj.hostname.includes('zoom')) return 'Zoom';
        return 'Video Conference';
      } catch (e) {
        return 'Video Conference';
      }
    };
    
    const platform = getMeetingPlatform(meetingLink);
    
    // Show confirmation dialog with tenant branding
    const confirmed = window.confirm(
      `Join ${platform} session with ${appointment.patientName}?\n\n` +
      `${platformName} - ${currentTenant?.name || 'Clinic'}\n` +
      `Session Platform: ${platform}\n` +
      `Patient: ${appointment.patientName}\n` +
      `Time: ${appointment.time}\n\n` +
      `This will open the video conference in a new window.`
    );
    
    if (confirmed) {
      // Open meeting in new window/tab
      window.open(meetingLink, '_blank', 'noopener,noreferrer');
      
      // Show success message with tenant branding
      setTimeout(() => {
        alert(
          `${platform} should now be opening in a new window.\n\n` +
          `📋 ${platformName} Session Tips:\n` +
          `• Ensure good internet connection\n` +
          `• Test your camera and microphone\n` +
          `• Both you and the patient will join the same room\n` +
          `• No account registration required for Jitsi Meet`
        );
      }, 1000);
    }
  };

  // Keep existing functions unchanged
  const isSessionActive = (appointment) => {
    if (!appointment.appointmentDate) return false;
    
    const appointmentTime = new Date(appointment.appointmentDate);
    const now = new Date();
    const diffMinutes = (appointmentTime.getTime() - now.getTime()) / (1000 * 60);
    
    return diffMinutes <= 15 && diffMinutes >= -120;
  };

  const getSessionStatus = (appointment) => {
    if (!appointment.meetingLink) return { status: 'No Meeting', color: '#666' };
    if (!appointment.appointmentDate) return { status: 'Scheduled', color: theme?.primaryColor || '#4CAF50' };
    
    const appointmentTime = new Date(appointment.appointmentDate);
    const now = new Date();
    const diffMinutes = (appointmentTime.getTime() - now.getTime()) / (1000 * 60);
    
    if (diffMinutes <= 5 && diffMinutes >= -60) {
      return { status: 'Active Now', color: '#FF4444' };
    } else if (diffMinutes <= 15 && diffMinutes > 5) {
      return { status: 'Starting Soon', color: '#FF9800' };
    } else if (diffMinutes > 15) {
      return { status: 'Scheduled', color: theme?.primaryColor || '#4CAF50' };
    } else {
      return { status: 'Ended', color: '#666' };
    }
  };

  const getTodaysAppointments = (allAppointments) => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    console.log('🔍 Filtering appointments for today:', todayStr);
    console.log('🔍 All appointments received:', allAppointments.length);
    
    const todaysAppts = allAppointments.filter(appt => {
      if (!appt.appointmentDate) return false;
      
      const apptDate = new Date(appt.appointmentDate);
      const apptDateStr = apptDate.toISOString().split('T')[0];
      
      return apptDateStr === todayStr;
    });
    
    console.log('✅ Found appointments for today:', todaysAppts.length);
    
    return todaysAppts.map(appt => ({
      id: appt._id,
      patientName: appt.patient ? 
        `${appt.patient.firstName || ''} ${appt.patient.lastName || ''}`.trim() :
        'Unknown Patient',
      patientType: "Patient",
      appointmentDate: appt.appointmentDate,
      time: new Date(appt.appointmentDate).toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      }),
      meetingLink: appt.meetingLink,
      status: appt.status,
      meetingType: appt.meetingType || 'jitsi',
      duration: appt.duration || 30,
      appointmentType: appt.appointmentType || 'Consultation'
    }));
  };

  // 🔧 FIXED: useEffect with proper dependencies to prevent infinite loop
  useEffect(() => {
    // ✅ ENHANCED: Fetch dashboard data with feature-based filtering
    const fetchDashboardData = async () => {
      try {
        console.log('🔍 Fetching dashboard data with feature control...');
        
        // Fetch doctor profile information
        try {
          const profileResponse = await doctorService.getProfile();
          const profile = profileResponse.data || {};
          
          setDoctorInfo({
            firstName: profile.firstName || 'Doctor',
            lastName: profile.lastName || ''
          });
          
          console.log('✅ Doctor profile loaded:', profile.firstName, profile.lastName);
        } catch (profileError) {
          console.error('❌ Error fetching doctor profile:', profileError);
          setDoctorInfo({ firstName: 'Doctor', lastName: '' });
        }
        
        // ✅ ENHANCED: Fetch appointments only if Care/Report feature is enabled
        if (featureControl.isFeatureEnabled && featureControl.isFeatureEnabled('Care / Report')) {
          try {
            console.log('🔍 Fetching appointments (feature enabled)...');
            const appointmentsResponse = await doctorService.getAppointments();
            
            let appointments = [];
            if (appointmentsResponse.success && appointmentsResponse.data) {
              appointments = appointmentsResponse.data;
            } else if (Array.isArray(appointmentsResponse)) {
              appointments = appointmentsResponse;
            } else if (appointmentsResponse.data && Array.isArray(appointmentsResponse.data)) {
              appointments = appointmentsResponse.data;
            }
            
            console.log('✅ Processed appointments:', appointments.length);
            
            const todaysAppointments = getTodaysAppointments(appointments);
            setTodayAppointments(todaysAppointments);
            
            setStats(prevStats => ({
              ...prevStats,
              totalAppointments: appointments.length
            }));
            
          } catch (appointmentsError) {
            console.error('❌ Error fetching appointments:', appointmentsError);
            setTodayAppointments([]);
          }
        } else {
          console.log('⚠️ Appointments feature disabled - skipping fetch');
          setTodayAppointments([]);
          setStats(prevStats => ({ ...prevStats, totalAppointments: 0 }));
        }
        
        // ✅ ENHANCED: Fetch patients only if User Profiles feature is enabled
        if (featureControl.isFeatureEnabled && featureControl.isFeatureEnabled('User Profiles')) {
          try {
            const patientsResponse = await doctorService.getPatients();
            const patients = patientsResponse.data || patientsResponse.patients || [];
            
            setStats(prevStats => ({
              ...prevStats,
              totalPatients: patients.length
            }));
            
            console.log('✅ Patients loaded:', patients.length);
          } catch (patientsError) {
            console.error('❌ Error fetching patients:', patientsError);
            setStats(prevStats => ({ ...prevStats, totalPatients: 0 }));
          }
        } else {
          console.log('⚠️ User Profiles feature disabled - skipping patients fetch');
          setStats(prevStats => ({ ...prevStats, totalPatients: 0 }));
        }
        
        // ✅ ENHANCED: Fetch journal entries only if Journal Entries feature is enabled
        if (featureControl.isFeatureEnabled && featureControl.isFeatureEnabled('Journal Entries')) {
          try {
            const entriesResponse = await doctorService.getJournalEntries({
              analyzed: 'unanalyzed',
              limit: 5
            });
            const entries = entriesResponse.data || [];
            
            setRecentEntries(entries);
            setStats(prevStats => ({
              ...prevStats,
              pendingEntries: entries.length
            }));
            
            console.log('✅ Journal entries loaded:', entries.length);
          } catch (entriesError) {
            console.error('❌ Error fetching journal entries:', entriesError);
            setStats(prevStats => ({ ...prevStats, pendingEntries: 0 }));
          }
        } else {
          console.log('⚠️ Journal Entries feature disabled - skipping fetch');
          setStats(prevStats => ({ ...prevStats, pendingEntries: 0 }));
        }
        
        // ✅ ENHANCED: Messages only if Notifications feature is enabled
        if (featureControl.isFeatureEnabled && featureControl.isFeatureEnabled('Notifications')) {
          // Implement message fetching when ready
          setStats(prevStats => ({ ...prevStats, newMessages: 0 }));
        } else {
          setStats(prevStats => ({ ...prevStats, newMessages: 0 }));
        }
        
        setLoading(false);
        console.log('✅ Dashboard data loading complete with feature control');
        
      } catch (error) {
        console.error('❌ Error in fetchDashboardData:', error);
        setLoading(false);
        
        setDoctorInfo({ firstName: 'Doctor', lastName: '' });
        setTodayAppointments([]);
        setStats({
          totalPatients: 0,
          totalAppointments: 0,
          pendingEntries: 0,
          newMessages: 0
        });
      }
    };
    
    // 🔧 CRITICAL FIX: Only fetch data once when component mounts
    if (featureControl.isFeatureEnabled) {
      fetchDashboardData();
    }
  }, []); // 🔧 EMPTY DEPENDENCY ARRAY - RUNS ONLY ONCE!

  // Keep existing calendar functions unchanged
  const [calendarState, setCalendarState] = useState({
    currentDate: new Date(),
    viewMode: 'week',
    selectedDate: new Date()
  });

  const getMonthName = (date) => {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return monthNames[date.getMonth()];
  };

  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay();
  };

  const goToPreviousPeriod = () => {
    setCalendarState(prevState => {
      const newDate = new Date(prevState.currentDate);
      if (prevState.viewMode === 'week') {
        newDate.setDate(newDate.getDate() - 7);
      } else {
        newDate.setMonth(newDate.getMonth() - 1);
      }
      return { ...prevState, currentDate: newDate };
    });
  };

  const goToNextPeriod = () => {
    setCalendarState(prevState => {
      const newDate = new Date(prevState.currentDate);
      if (prevState.viewMode === 'week') {
        newDate.setDate(newDate.getDate() + 7);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return { ...prevState, currentDate: newDate };
    });
  };

  const toggleViewMode = () => {
    setCalendarState(prevState => ({
      ...prevState,
      viewMode: prevState.viewMode === 'week' ? 'month' : 'week'
    }));
  };

  const getWeekDays = (date) => {
    const day = date.getDay();
    const diff = date.getDate() - day;
    const weekDays = [];
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(date);
      currentDay.setDate(diff + i);
      weekDays.push({
        date: currentDay,
        name: daysOfWeek[i],
        number: currentDay.getDate(),
        month: currentDay.getMonth(),
        year: currentDay.getFullYear()
      });
    }
    return weekDays;
  };

  const getMonthDays = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const totalDays = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const daysArray = [];
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    const prevMonth = new Date(year, month, 0);
    const prevMonthDays = prevMonth.getDate();
    
    for (let i = firstDay - 1; i >= 0; i--) {
      const dayNumber = prevMonthDays - i;
      daysArray.push({
        date: new Date(year, month - 1, dayNumber),
        name: daysOfWeek[(7 + dayNumber - i) % 7],
        number: dayNumber,
        month: month - 1,
        year: year,
        isCurrentMonth: false
      });
    }
    
    for (let i = 1; i <= totalDays; i++) {
      const dayDate = new Date(year, month, i);
      daysArray.push({
        date: dayDate,
        name: daysOfWeek[dayDate.getDay()],
        number: i,
        month: month,
        year: year,
        isCurrentMonth: true
      });
    }
    
    const remainingDays = 42 - daysArray.length;
    for (let i = 1; i <= remainingDays; i++) {
      const dayDate = new Date(year, month + 1, i);
      daysArray.push({
        date: dayDate,
        name: daysOfWeek[dayDate.getDay()],
        number: i,
        month: month + 1,
        year: year,
        isCurrentMonth: false
      });
    }
    
    return daysArray;
  };

  const hasAppointments = (date) => {
    const dateStr = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    return todayAppointments.some(appt => {
      if (!appt.appointmentDate) return false;
      const apptDate = new Date(appt.appointmentDate);
      const apptDateStr = `${apptDate.getFullYear()}-${apptDate.getMonth() + 1}-${apptDate.getDate()}`;
      return apptDateStr === dateStr;
    });
  };

  const isToday = (date) => {
    const today = new Date();
    return date.getDate() === today.getDate() && 
           date.getMonth() === today.getMonth() && 
           date.getFullYear() === today.getFullYear();
  };

  const renderCalendar = () => {
    const { currentDate, viewMode } = calendarState;
    const isMonthView = viewMode === 'month';
    const days = isMonthView ? getMonthDays(currentDate) : getWeekDays(currentDate);
    const monthYear = `${getMonthName(currentDate)} ${currentDate.getFullYear()}`;
    
    return (
      <FeatureWrapper feature="Care / Report" showMessage={true}>
        <div className="weekly-calendar">
          <div className="calendar-month-header">
            <div className="month-title">{monthYear}</div>
            <div className="month-navigation">
              <button 
                className="month-nav-button view-toggle" 
                onClick={toggleViewMode}
              >
                {isMonthView ? 'Week View' : 'Month View'}
              </button>
              <button className="month-nav-button prev" onClick={goToPreviousPeriod}>&#10094;</button>
              <button className="month-nav-button next" onClick={goToNextPeriod}>&#10095;</button>
            </div>
          </div>
          
          {isMonthView ? (
            <div className="month-grid">
              <div className="day-names-row">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName, index) => (
                  <div key={`header-${index}`} className="day-name-cell">{dayName}</div>
                ))}
              </div>
              <div className="month-days-grid">
                {days.map((day, index) => (
                  <div 
                    key={`day-${index}`} 
                    className={`month-day ${!day.isCurrentMonth ? 'other-month' : ''} 
                                ${isToday(day.date) ? 'today' : ''} 
                                ${hasAppointments(day.date) ? 'has-appointment' : ''}`}
                  >
                    <div className="month-day-number">{day.number}</div>
                    {hasAppointments(day.date) && (
                      <div className="month-day-indicators">
                        <div className="day-appointment-dot"></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="week-row">
              {days.map((day, index) => (
                <div 
                  key={`week-day-${index}`} 
                  className={`week-day ${hasAppointments(day.date) ? 'has-appointment' : ''} 
                              ${isToday(day.date) ? 'today' : ''}`}
                >
                  <div className="week-day-header">
                    <div className="day-name">{day.name}</div>
                    <div className="day-number">{day.number}</div>
                  </div>
                  <div className="day-event-container">
                    {hasAppointments(day.date) && (
                      <>
                        <div className="appointment-indicator">
                          Appointment
                        </div>
                        <div className="review-indicator">
                          Review Journal
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </FeatureWrapper>
    );
  };

  // ✅ ENHANCED: StatCard with feature-based styling and conditional rendering
  const StatCard = ({ title, value, subtitle, feature, onClick }) => {
    const isFeatureEnabled = feature ? (featureControl.isFeatureEnabled && featureControl.isFeatureEnabled(feature)) : true;
    
    if (feature && !isFeatureEnabled) {
      return (
        <div className="stat-card disabled" onClick={onClick}>
          <h3 className="stat-title">{title}</h3>
          <div className="stat-value">--</div>
          <div className="stat-subtitle">Feature Disabled</div>
        </div>
      );
    }
    
    return (
      <div className="stat-card" onClick={onClick}>
        <h3 className="stat-title">{title}</h3>
        <div className="stat-value">{value}</div>
        <div className="stat-subtitle">{subtitle}</div>
      </div>
    );
  };

  // ✅ ENHANCED: Today's appointments with feature wrapper
  const renderTodayAppointments = () => {
  return (
    <FeatureWrapper feature="Care / Report" showMessage={true}>
      <div className="todays-appointments">
        <div className="today-appointment-header">
          <h3 className="section-title">
            Today's Appointments
          </h3>
          <p className="appointments-count">
            {todayAppointments.length} appointment{todayAppointments.length !== 1 ? 's' : ''} today
          </p>
        </div>
        
        {todayAppointments.length === 0 ? (
          <div className="no-appointments">
            <p>🗓️ No appointments scheduled for today</p>
            <p className="no-appointments-subtitle">Enjoy your free time!</p>
          </div>
        ) : (
          todayAppointments.map((appointment, index) => {
            const sessionStatus = getSessionStatus(appointment);
            const isActive = isSessionActive(appointment);
            
            // Format date to show month and day (e.g., "April 19")
            const appointmentDate = new Date(appointment.appointmentDate);
            const formattedDate = appointmentDate.toLocaleDateString('en-US', { 
              month: 'long', 
              day: 'numeric' 
            });
            
            return (
              <div key={appointment.id || index} className="today-appointment-card">
                {/* Patient Info Section */}
                <div className="today-appointment-patient">
                  <div className="patient-avatar">
                    {/* If you have patient images, use them, otherwise show initials */}
                    {appointment.patientImage ? (
                      <img src={appointment.patientImage} alt={appointment.patientName} />
                    ) : (
                      appointment.patientName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="patient-info">
                    <h4 className="patient-name-label">{appointment.patientName}</h4>
                    <p className="patient-type-label">{appointment.patientType}</p>
                    {appointment.meetingLink && (
                      <div 
                        className="session-status" 
                        data-status={sessionStatus.status.toLowerCase().replace(/\s+/g, '-')}
                      >
                        🎥 {sessionStatus.status}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Date and Time Section - Matching Figma exactly */}
                <div className="appointment-meta">
                  <div className="appointment-date-time">
                    <div className="meta-group date-group">
                      <span>{formattedDate}</span>
                    </div>
                    <div className="meta-group time-group">
                      <span>{appointment.time}</span>
                    </div>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="appointment-actions">
                  {appointment.meetingLink && (
                    <button 
                      className={`join-meeting-button ${isActive ? 'active' : ''}`}
                      onClick={() => handleJoinMeeting(appointment)}
                    >
                      {isActive ? '🔴 Join Now' : '📹 Join Meeting'}
                    </button>
                  )}
                  
                  <button 
                    className="view-details-button"
                    onClick={() => navigate(`/doctor/appointments/${appointment.id}`)}
                  >
                    View Details
                  </button>
                </div>
              </div>
            );
          })
        )}
        
        {todayAppointments.some(appt => appt.meetingLink) && (
          <div className="meeting-instructions">
            <h4>📋 {platformName} Video Session Instructions:</h4>
            <ul>
              <li>Click "Join Meeting" to start the video session</li>
              <li>Both you and your patient will join the same room</li>
              <li>No account registration required for Jitsi Meet</li>
              <li>Ensure good internet connection and test audio/video</li>
            </ul>
          </div>
        )}
      </div>
    </FeatureWrapper>
  );
};

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">
          Loading {platformName} dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-wrapper">
      {/* ✅ ENHANCED: Header with tenant branding */}
      <div className="dashboard-header">
        <div className="welcome-message">
          <h1 className="welcome-title">
            Welcome back, Dr. {doctorInfo.firstName} {doctorInfo.lastName}.
          </h1>
          <p className="welcome-subtitle">
            {currentTenant?.name ? `${currentTenant.name} - ` : ''}{platformName} Medical Dashboard. 
            Here's a gentle overview to guide your day.
          </p>
        </div>
        <div className="header-actions">
          <FeatureWrapper feature="Config">
            <button className="search-button"></button>
          </FeatureWrapper>
          <FeatureWrapper feature="Notifications">
           <button className="notification-button"></button>
          </FeatureWrapper>
          <div className="user-avatar">
            <div className="avatar-placeholder">
              {doctorInfo.firstName.charAt(0)}{doctorInfo.lastName.charAt(0)}
            </div>
          </div>
        </div>
      </div>
      
      {/* ✅ ENHANCED: Overview section with feature-based stats */}
      {/* Divider above Patient and Appointment Overview */}
      <div className="section-divider overview-divider"></div>

{/* ✅ ENHANCED: Overview section with feature-based stats */}
      <div className="overview-section">
        <div className="section-header">
          <h2 className="section-title">
            Patient and Appointment Overview
          </h2>
          <div className="timeframe-selector">
            <select 
              value={selectedTimeframe} 
              onChange={(e) => setSelectedTimeframe(e.target.value)}
              className="timeframe-select"
            >
              <option value="This Week">This Week</option>
              <option value="This Month">This Month</option>
              <option value="This Year">This Year</option>
            </select>
          </div>
        </div>
        
        <div className="stats-container">
          <StatCard
            title="Total Patients"
            value={stats.totalPatients}
            subtitle="Patients in Your Care"
            feature="User Profiles"
            onClick={() => featureControl.isFeatureEnabled && featureControl.isFeatureEnabled('User Profiles') && navigate('/doctor/patients')}
          />
          <StatCard
            title="Total Appointments"
            value={stats.totalAppointments}
            subtitle="All Scheduled Sessions"
            feature="Care / Report"
            onClick={() => featureControl.isFeatureEnabled && featureControl.isFeatureEnabled('Care / Report') && navigate('/doctor/appointments')}
          />
          <StatCard
            title="Pending Review"
            value={stats.pendingEntries}
            subtitle="Journal Entries to Review"
            feature="Journal Entries"
            onClick={() => featureControl.isFeatureEnabled && featureControl.isFeatureEnabled('Journal Entries') && navigate('/doctor/journal-entries')}
          />
          <StatCard
            title="Messages"
            value={stats.newMessages}
            subtitle="New Messages"
            feature="Notifications"
            onClick={() => featureControl.isFeatureEnabled && featureControl.isFeatureEnabled('Notifications') && navigate('/doctor/messages')}
          />
        </div>
      </div>
      
      {/* ✅ ENHANCED: Main content with feature wrappers */}
      {/* Divider above calendar and appointments */}
<div className="section-divider calendar-divider"></div>

{/* ✅ ENHANCED: Main content with feature wrappers */}
<div className="main-content">
        <div className="calendar-section">
          {renderCalendar()}
        </div>
        <div className="appointments-section">
          {renderTodayAppointments()}
        </div>
      </div>

    </div>
  );
};

export default DoctorDashboard;