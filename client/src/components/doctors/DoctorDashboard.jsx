// client/src/components/doctors/dashboard/DoctorDashboard.jsx - FIXED WITH REAL DATA
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import doctorService from '../../services/doctorService';
import '../../styles/components/doctor/DoctorDashboard.css';

const DoctorDashboard = () => {
  const [stats, setStats] = useState({
    totalPatients: 0,
    totalAppointments: 0,
    pendingEntries: 0,
    newMessages: 0
  });
  const [recentEntries, setRecentEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState('This Week');
  const [doctorInfo, setDoctorInfo] = useState({
    firstName: '',
    lastName: ''
  });
  const [todayAppointments, setTodayAppointments] = useState([]);
  const navigate = useNavigate();

  // ✅ NEW: Function to handle joining video meeting
  const handleJoinMeeting = (appointment) => {
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
    
    // Show confirmation dialog
    const confirmed = window.confirm(
      `Join ${platform} session with ${appointment.patientName}?\n\n` +
      `Session Platform: ${platform}\n` +
      `Patient: ${appointment.patientName}\n` +
      `Time: ${appointment.time}\n\n` +
      `This will open the video conference in a new window.`
    );
    
    if (confirmed) {
      // Open meeting in new window/tab
      window.open(meetingLink, '_blank', 'noopener,noreferrer');
      
      // Show success message
      setTimeout(() => {
        alert(
          `${platform} should now be opening in a new window.\n\n` +
          `📋 Session Tips:\n` +
          `• Ensure good internet connection\n` +
          `• Test your camera and microphone\n` +
          `• Both you and the patient will join the same room\n` +
          `• No account registration required for Jitsi Meet`
        );
      }, 1000);
    }
  };

  // ✅ NEW: Function to check if appointment has active meeting
  const isSessionActive = (appointment) => {
    if (!appointment.appointmentDate) return false;
    
    const appointmentTime = new Date(appointment.appointmentDate);
    const now = new Date();
    const diffMinutes = (appointmentTime.getTime() - now.getTime()) / (1000 * 60);
    
    // Session is considered active 15 minutes before to 2 hours after
    return diffMinutes <= 15 && diffMinutes >= -120;
  };

  // ✅ NEW: Function to get session status
  const getSessionStatus = (appointment) => {
    if (!appointment.meetingLink) return { status: 'No Meeting', color: '#666' };
    if (!appointment.appointmentDate) return { status: 'Scheduled', color: '#4CAF50' };
    
    const appointmentTime = new Date(appointment.appointmentDate);
    const now = new Date();
    const diffMinutes = (appointmentTime.getTime() - now.getTime()) / (1000 * 60);
    
    if (diffMinutes <= 5 && diffMinutes >= -60) {
      return { status: 'Active Now', color: '#FF4444' };
    } else if (diffMinutes <= 15 && diffMinutes > 5) {
      return { status: 'Starting Soon', color: '#FF9800' };
    } else if (diffMinutes > 15) {
      return { status: 'Scheduled', color: '#4CAF50' };
    } else {
      return { status: 'Ended', color: '#666' };
    }
  };

  // ✅ NEW: Function to get today's appointments from real data
  const getTodaysAppointments = (allAppointments) => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    console.log('🔍 Filtering appointments for today:', todayStr);
    console.log('🔍 All appointments received:', allAppointments.length);
    
    const todaysAppts = allAppointments.filter(appt => {
      if (!appt.appointmentDate) return false;
      
      const apptDate = new Date(appt.appointmentDate);
      const apptDateStr = apptDate.toISOString().split('T')[0];
      
      console.log(`🔍 Comparing: ${apptDateStr} === ${todayStr}`, apptDateStr === todayStr);
      
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

  useEffect(() => {
    // ✅ FIXED: Fetch dashboard data with real appointments
    const fetchDashboardData = async () => {
      try {
        console.log('🔍 Fetching real dashboard data...');
        
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
        
        // ✅ FIXED: Fetch real appointments with meeting links
        try {
          console.log('🔍 Fetching real appointments...');
          const appointmentsResponse = await doctorService.getAppointments();
          
          console.log('📊 Appointments response:', appointmentsResponse);
          
          // Handle different response structures
          let appointments = [];
          if (appointmentsResponse.success && appointmentsResponse.data) {
            appointments = appointmentsResponse.data;
          } else if (Array.isArray(appointmentsResponse)) {
            appointments = appointmentsResponse;
          } else if (appointmentsResponse.data && Array.isArray(appointmentsResponse.data)) {
            appointments = appointmentsResponse.data;
          }
          
          console.log('✅ Processed appointments:', appointments.length);
          
          // Get today's appointments from real data
          const todaysAppointments = getTodaysAppointments(appointments);
          setTodayAppointments(todaysAppointments);
          
          console.log('📅 Today\'s appointments set:', todaysAppointments.length);
          
          // Update stats with real data
          setStats(prevStats => ({
            ...prevStats,
            totalAppointments: appointments.length
          }));
          
        } catch (appointmentsError) {
          console.error('❌ Error fetching appointments:', appointmentsError);
          
          // Set fallback data only if API fails
          setTodayAppointments([
            {
              id: 'demo-1',
              patientName: "Demo Patient",
              patientType: "Patient",
              appointmentDate: new Date().toISOString(),
              time: "12:00 PM",
              meetingLink: null, // No demo meeting link
              status: "Scheduled",
              meetingType: "jitsi"
            }
          ]);
        }
        
        // Fetch patients
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
        
        // Fetch journal entries that need review
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
        
        // Set default message count (you can implement this later)
        setStats(prevStats => ({
          ...prevStats,
          newMessages: 0
        }));
        
        setLoading(false);
        console.log('✅ Dashboard data loading complete');
        
      } catch (error) {
        console.error('❌ Error in fetchDashboardData:', error);
        setLoading(false);
        
        // Set fallback values if everything fails
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
    
    fetchDashboardData();
  }, []);

  // Calendar state and functions (keep existing calendar code)
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
      <div className="weekly-calendar">
        <div className="calendar-month-header">
          <div className="month-title">{monthYear}</div>
          <div className="month-navigation">
            <button className="month-nav-button view-toggle" onClick={toggleViewMode}>
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
                      <div className="appointment-indicator">Appointment</div>
                      <div className="review-indicator">Review Journal</div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const StatCard = ({ title, value, subtitle }) => (
    <div className="stat-card">
      <h3 className="stat-title">{title}</h3>
      <div className="stat-value">{value}</div>
      <div className="stat-subtitle">{subtitle}</div>
    </div>
  );

  // ✅ UPDATED: Enhanced today's appointments with video meeting support using REAL data
  const renderTodayAppointments = () => {
    return (
      <div className="todays-appointments">
        <div className="today-appointment-header">
          <h3 className="section-title">Today's Appointments</h3>
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
            
            return (
              <div key={appointment.id || index} className="today-appointment-card">
                <div className="today-appointment-patient">
                  <div className="patient-avatar">
                    {appointment.patientName.charAt(0).toUpperCase()}
                  </div>
                  <div className="patient-info">
                    <h4 className="patient-name-label">{appointment.patientName}</h4>
                    <p className="patient-type-label">{appointment.appointmentType}</p>
                    {/* ✅ NEW: Session status indicator */}
                    <div className="session-status" style={{ color: sessionStatus.color }}>
                      🎥 {sessionStatus.status}
                    </div>
                  </div>
                </div>
                
                <div className="appointment-meta">
                  <div className="appointment-date-time">
                    <div className="meta-group">
                      <span className="meta-icon">📅</span>
                      <span>Today</span>
                    </div>
                    <div className="meta-group">
                      <span className="meta-icon">🕛</span>
                      <span>{appointment.time}</span>
                    </div>
                    <div className="meta-group">
                      <span className="meta-icon">⏱️</span>
                      <span>{appointment.duration} min</span>
                    </div>
                    {/* ✅ NEW: Meeting platform indicator */}
                    {appointment.meetingLink && (
                      <div className="meta-group">
                        <span className="meta-icon">📹</span>
                        <span>{appointment.meetingType === 'jitsi' ? 'Jitsi Meet' : 'Video Call'}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="appointment-actions">
                  {/* ✅ NEW: Join Meeting Button */}
                  {appointment.meetingLink ? (
                    <button 
                      className={`join-meeting-button ${isActive ? 'active' : ''}`}
                      onClick={() => handleJoinMeeting(appointment)}
                      style={{
                        backgroundColor: isActive ? '#FF4444' : '#4CAF50',
                        marginRight: '8px'
                      }}
                    >
                      {isActive ? '🔴 Join Now' : '📹 Join Meeting'}
                    </button>
                  ) : (
                    <button 
                      className="join-meeting-button disabled"
                      style={{
                        backgroundColor: '#ccc',
                        marginRight: '8px',
                        cursor: 'not-allowed'
                      }}
                      disabled
                    >
                      📹 No Meeting Link
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
        
        {/* ✅ NEW: Instructions for doctors */}
        {todayAppointments.some(appt => appt.meetingLink) && (
          <div className="meeting-instructions">
            <h4>📋 Video Session Instructions:</h4>
            <ul>
              <li>• Click "Join Meeting" to start the video session</li>
              <li>• Both you and your patient will join the same room</li>
              <li>• No account registration required for Jitsi Meet</li>
              <li>• Ensure good internet connection and test audio/video</li>
            </ul>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-wrapper">
      <div className="dashboard-header">
        <div className="welcome-message">
          <h1 className="welcome-title">
            Welcome back, Dr. {doctorInfo.firstName} {doctorInfo.lastName}.
          </h1>
          <p className="welcome-subtitle">
            Thank you for being here. Here's a gentle overview to guide your day.
          </p>
        </div>
        <div className="header-actions">
          <button className="search-button">🔍</button>
          <button className="notification-button">🔔</button>
          <div className="user-avatar">
            <div className="avatar-placeholder">
              {doctorInfo.firstName.charAt(0)}{doctorInfo.lastName.charAt(0)}
            </div>
          </div>
        </div>
      </div>
      
      <div className="overview-section">
        <div className="section-header">
          <h2 className="section-title">Patient and Appointment Overview</h2>
          <div className="timeframe-selector">
            <select 
              value={selectedTimeframe} 
              onChange={(e) => setSelectedTimeframe(e.target.value)}
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
          />
          <StatCard
            title="Total Appointments"
            value={stats.totalAppointments}
            subtitle="All Scheduled Sessions"
          />
          <StatCard
            title="Pending Review"
            value={stats.pendingEntries}
            subtitle="Journal Entries to Review"
          />
          <StatCard
            title="Messages"
            value={stats.newMessages}
            subtitle="New Messages"
          />
        </div>
      </div>
      
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