// client/src/components/find_doctor/ScheduleAppointment.jsx - Fixed Structure
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../../styles/components/dashboard/ScheduleAppointment.css';

const ScheduleAppointment = ({ open, handleClose, doctor, onAppointmentScheduled }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [appointmentData, setAppointmentData] = useState({
    date: '',
    time: '',
    duration: 30,
    appointmentType: 'Initial Consultation',
    notes: ''
  });

  // Get tenant ID from localStorage if available (fallback mechanism)
  const [tenantId, setTenantId] = useState(null);
  
  useEffect(() => {
    // Try to get tenant ID from localStorage
    try {
      const userData = localStorage.getItem('userData');
      if (userData) {
        const parsedData = JSON.parse(userData);
        if (parsedData.tenantId) {
          setTenantId(parsedData.tenantId);
        }
      }
    } catch (err) {
      console.error('Error retrieving tenant ID:', err);
    }
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setAppointmentData({
      ...appointmentData,
      [name]: value
    });
  };

  const handleSubmit = async () => {
    if (!appointmentData.date || !appointmentData.time) {
      setError('Please select both date and time');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Combine date and time into a single datetime
      const appointmentDateTime = new Date(`${appointmentData.date}T${appointmentData.time}`);

      const appointmentPayload = {
        doctorId: doctor._id,
        appointmentDate: appointmentDateTime.toISOString(),
        duration: appointmentData.duration,
        appointmentType: appointmentData.appointmentType,
        notes: appointmentData.notes
      };

      // Add tenantId to the request if available
      if (tenantId) {
        appointmentPayload.tenantId = tenantId;
      }

      // Get the API base URL from environment or use default
      const apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      const appointmentUrl = `${apiBaseUrl}/appointments/schedule`;
      
      // Get auth token
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      console.log('Scheduling appointment with payload:', {
        ...appointmentPayload,
        tenantId: tenantId || 'Not available'
      });
      
      const response = await axios.post(appointmentUrl, appointmentPayload, { headers });
      
      if (response.data.success) {
        // Call the onAppointmentScheduled callback to trigger any parent component updates
        onAppointmentScheduled(response.data.data);
        handleClose();
      } else {
        setError(response.data.message || 'Failed to schedule appointment');
      }
    } catch (err) {
      console.error('Error scheduling appointment:', err);
      
      if (err.response) {
        console.error('Response data:', err.response.data);
        console.error('Response status:', err.response.status);
        
        if (err.response.status === 401) {
          setError('Please log in to schedule an appointment');
        } else if (err.response.data && err.response.data.message) {
          setError(err.response.data.message);
        } else {
          setError('Failed to schedule appointment. Please try again.');
        }
      } else if (err.request) {
        console.error('No response received:', err.request);
        setError('Server did not respond. Please check your connection and try again.');
      } else {
        setError('Failed to schedule appointment. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Don't render anything if the modal is not open
  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <h2 className="modal-title">
            Schedule Appointment with {doctor?.title || 'Dr.'} {doctor?.firstName} {doctor?.lastName}
          </h2>
        </div>
        
        {/* Modal Body - without the modal-content div */}
        <div className="modal-body">
          {error && (
            <div className="modal-error">
              {error}
            </div>
          )}
          
          <p className="modal-subtitle">
            Please select a date and time for your appointment
          </p>
          
          {/* Date field */}
          <div className="form-field">
            <label className="form-label">Appointment Date</label>
            <input
              type="date"
              name="date"
              value={appointmentData.date}
              onChange={handleInputChange}
              className="form-input"
              min={new Date().toISOString().split('T')[0]}
              placeholder="dd/mm/yyyy"
            />
          </div>
          
          {/* Time field */}
          <div className="form-field">
            <label className="form-label">Appointment Time</label>
            <input
              type="time"
              name="time"
              value={appointmentData.time}
              onChange={handleInputChange}
              className="form-input"
              placeholder="--:-- --"
            />
          </div>
          
          {/* Appointment type field */}
          <div className="form-field">
            <label className="form-label">Appointment Type</label>
            <select
              name="appointmentType"
              value={appointmentData.appointmentType}
              onChange={handleInputChange}
              className="form-select"
            >
              <option value="Initial Consultation">Initial Consultation</option>
              <option value="Follow-up">Follow-up</option>
              <option value="Therapy Session">Therapy Session</option>
              <option value="Assessment">Assessment</option>
            </select>
          </div>
          
          {/* Duration field */}
          <div className="form-field" style={{ maxWidth: '180px' }}>
            <label className="form-label">Duration (minutes)</label>
            <select
              name="duration"
              value={appointmentData.duration}
              onChange={handleInputChange}
              className="form-select"
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>60 minutes</option>
            </select>
          </div>
          
          {/* Notes field */}
          <div className="form-field">
            <label className="form-label">Notes (optional)</label>
            <textarea
              name="notes"
              value={appointmentData.notes}
              onChange={handleInputChange}
              className="form-textarea"
              placeholder="Add any notes or special requests for your appointment"
            ></textarea>
          </div>
        </div>
        
        {/* Modal Footer */}
        <div className="modal-footer">
          <button 
            className="btn btn-cancel"
            onClick={handleClose}
          >
            CANCEL
          </button>
          <button 
            className="btn btn-schedule"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'SCHEDULING...' : 'SCHEDULE APPOINTMENT'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleAppointment;