// client/src/components/find_doctor/FindDoctor.jsx - updated version
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../../styles/components/dashboard/FindDoctor.css'; // Make sure to create this CSS file
import ScheduleAppointment from './ScheduleAppointment';

const FindDoctor = () => {
  const [doctors, setDoctors] = useState([]);
  const [filteredDoctors, setFilteredDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: 'success'
  });
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Get tenant info from localStorage
        const tenantStr = localStorage.getItem('tenant');
        let tenantId = null;
        
        // Try to extract tenantId from tenant object
        if (tenantStr) {
          try {
            const tenantObj = JSON.parse(tenantStr);
            tenantId = tenantObj._id;
            console.log('Tenant ID extracted from tenant object:', tenantId);
          } catch (e) {
            console.error('Error parsing tenant JSON:', e);
          }
        } else {
          // Fallback: try direct tenantId
          tenantId = localStorage.getItem('tenantId');
          console.log('No tenant object found, direct tenantId:', tenantId || 'Not found');
        }
        
        // Get auth token
        const token = localStorage.getItem('token');
        const headers = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        // Add cache-busting parameter and explicitly include tenantId
        const timestamp = new Date().getTime();
        let directUrl = `http://localhost:5000/api/doctor/available?_t=${timestamp}`;
        
        // CRITICAL: Add tenantId as a URL parameter if available
        if (tenantId) {
          directUrl += `&tenantId=${tenantId}`;
          console.log('Including tenantId in URL:', tenantId);
        } else {
          console.warn('⚠️ No tenantId found in localStorage!');
        }
        
        console.log('Fetching doctors from:', directUrl);
        
        // Make the API call with the direct URL
        const response = await axios.get(directUrl, { headers });
        
        if (response.data.success) {
          console.log('Doctors fetched successfully:', response.data);
          setDoctors(response.data.data || []);
          setFilteredDoctors(response.data.data || []);
        } else {
          console.error('Failed to fetch doctors:', response.data);
          setError('Failed to load doctors. Please try again.');
        }
      } catch (err) {
        console.error('Error fetching doctors:', err);
        setError('Failed to load doctors. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchDoctors();
  }, []);

  const handleConnectDoctor = async (doctorId) => {
    try {
      // Hard-coded URL for consistency
      const directUrl = 'http://localhost:5000/api/doctor/connect';
      
      // Get auth token
      const token = localStorage.getItem('token');
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await axios.post(directUrl, { doctorId }, { headers });
      
      if (response.data.success) {
        // Show success notification
        setNotification({
          open: true,
          message: 'Successfully connected with doctor',
          severity: 'success'
        });
        
        // After connecting with a doctor, navigate to journal form
        navigate('/dashboard/journal/new');
      }
    } catch (err) {
      console.error('Error connecting with doctor:', err);
      
      if (err.response && err.response.status === 401) {
        setError('Please log in to connect with a doctor.');
      } else {
        setError('Failed to connect with doctor. Please try again.');
      }
    }
  };
  
  const handleScheduleAppointment = (doctor) => {
    setSelectedDoctor(doctor);
    setAppointmentDialogOpen(true);
  };
  
  const handleCloseAppointmentDialog = () => {
    setAppointmentDialogOpen(false);
  };
  
  const handleAppointmentScheduled = (appointmentData) => {
    // First connect the doctor with the patient
    handleConnectDoctor(selectedDoctor._id);
    
    // Show success notification
    setNotification({
      open: true,
      message: 'Appointment scheduled successfully!',
      severity: 'success'
    });
  };
  
  const handleViewProfile = (doctor) => {
    setSelectedDoctor(doctor);
    // For now, just show appointment dialog
    setAppointmentDialogOpen(true);
  };

  const handleRetry = () => {
    window.location.reload();
  };
  
  const handleCloseNotification = () => {
    setNotification({
      ...notification,
      open: false
    });
  };

  // Function to get initials from name
  const getInitials = (firstName, lastName) => {
    return `${firstName ? firstName[0] : ''}${lastName ? lastName[0] : ''}`;
  };

  // Automatic notification close
  useEffect(() => {
    if (notification.open) {
      const timer = setTimeout(() => {
        setNotification({ ...notification, open: false });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  return (
    <div className="doctor-page-container">
      <div className="doctor-content-container">
        {/* Page header */}
        <div className="page-header">
          <h1 className="page-title">Available Mental Health Professionals</h1>
          <div className="heart-icon-container">
            <svg className="heart-icon" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </div>
        </div>
        
        <p className="page-subtitle">
          Here are some professionals who match your preferences. Choose someone you feel comfortable with - you're not alone in this journey.
        </p>
        
        <div className="divider"></div>
        
        {/* Error message */}
        {error && (
          <div className="error-container">
            <span className="error-message">{error}</span>
            <button className="retry-btn" onClick={handleRetry}>
              Try Again
            </button>
          </div>
        )}
        
        {/* Loading state */}
        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
          </div>
        ) : (
          <>
            {/* Doctor cards */}
            {filteredDoctors.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-message">
                  No doctors available matching your preferences. Try adjusting your filters.
                </p>
              </div>
            ) : (
              <div className="doctor-cards-container">
                {filteredDoctors.map((doctor) => (
                  <div key={doctor._id} className="doctor-card">
                    <div className="doctor-avatar-container">
                      {doctor.profilePicture && doctor.profilePicture !== 'default-profile.png' ? (
                        <img 
                          src={doctor.profilePicture}
                          alt={`Dr. ${doctor.firstName} ${doctor.lastName}`}
                          className="doctor-avatar"
                        />
                      ) : (
                        <div className="doctor-avatar">
                          {getInitials(doctor.firstName, doctor.lastName)}
                        </div>
                      )}
                    </div>
                    
                    <div className="doctor-info">
                      <h3 className="doctor-name">
                        {doctor.title || 'Dr.'} {doctor.firstName} {doctor.lastName}
                      </h3>
                      <p className="doctor-title">
                        {doctor.specialty || 'Medical Professional'}
                      </p>
                      
                      <div className="doctor-tags">
                        {doctor.languages && doctor.languages.map((language) => (
                          <span key={language} className="doctor-tag language-tag">
                            <span role="img" aria-label="Language">🗣️</span> {language}
                          </span>
                        ))}
                        {doctor.lgbtqAffirming && (
                          <span className="doctor-tag lgbtq-tag">
                            <span role="img" aria-label="Rainbow">🏳️‍🌈</span> LGBTQ+ Affirming
                          </span>
                        )}
                      </div>
                      
                      <p className="doctor-description">
                        {doctor.description || 'Available for consultations and journal reviews'}
                      </p>
                    </div>
                    
                    <div className="doctor-actions">
                      <button 
                        className="schedule-btn"
                        onClick={() => handleScheduleAppointment(doctor)}
                      >
                        Schedule Appointment
                      </button>
                      <button 
                        className="profile-btn"
                        onClick={() => handleViewProfile(doctor)}
                      >
                        View Profile
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Load more button - only if there are more than 6 doctors */}
            {filteredDoctors.length > 6 && (
              <button className="load-more-btn">
                Load More
              </button>
            )}
          </>
        )}
        
        {/* Appointment Dialog - using existing component */}
        {selectedDoctor && appointmentDialogOpen && (
          <ScheduleAppointment
            open={appointmentDialogOpen}
            handleClose={handleCloseAppointmentDialog}
            doctor={selectedDoctor}
            onAppointmentScheduled={handleAppointmentScheduled}
          />
        )}
        
        {/* Notification */}
        {notification.open && (
          <div className="notification">
            {notification.message}
          </div>
        )}
      </div>
    </div>
  );
};

export default FindDoctor;