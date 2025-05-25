// src/components/admin/PendingDoctorsList.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const PendingDoctorsList = () => {
  const [pendingDoctors, setPendingDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchPendingDoctors = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/admin/doctors/pending', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('adminToken')}`
          }
        });
        
        setPendingDoctors(response.data.data);
      } catch (err) {
        console.error('Error fetching pending doctors:', err);
        setError('Failed to load pending verifications');
      } finally {
        setLoading(false);
      }
    };
    
    fetchPendingDoctors();
    
    // Set up polling to refresh data every minute
    const intervalId = setInterval(fetchPendingDoctors, 60000);
    
    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, []);
  
  // Format date helper
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };
  
  if (loading) {
    return <div className="loading">Loading pending verifications...</div>;
  }
  
  if (error) {
    return <div className="error-alert">{error}</div>;
  }
  
  return (
    <div className="pending-doctors-container">
      <div className="section-header">
        <h2>Pending Doctor Verifications</h2>
        <div className="count-badge">{pendingDoctors.length}</div>
      </div>
      
      {pendingDoctors.length === 0 ? (
        <div className="empty-state">
          <p>No pending verifications at this time.</p>
        </div>
      ) : (
        <div className="doctors-table-container">
          <table className="doctors-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Specialization</th>
                <th>Submitted On</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingDoctors.map((doctor) => (
                <tr key={doctor._id}>
                  <td>{doctor.firstName} {doctor.lastName}</td>
                  <td>{doctor.email}</td>
                  <td>{doctor.specialization}</td>
                  <td>{formatDate(doctor.createdAt)}</td>
                  <td>
                    <Link 
                      to={`/admin/verify-doctor/${doctor._id}`} 
                      className="btn-verify"
                    >
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PendingDoctorsList;