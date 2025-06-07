// PatientList.jsx or PatientManagement.jsx (whatever component renders your table)
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import doctorService from '../../../services/doctorService';

const PatientList = () => {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [appointmentFilter, setAppointmentFilter] = useState('All');

  // Fetch patients data
  useEffect(() => {
    const fetchPatients = async () => {
      try {
        setLoading(true);
        const response = await doctorService.getPatients();
        setPatients(response.data || []);
      } catch (error) {
        console.error('Error fetching patients:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPatients();
  }, []);

  // Handle patient view
  const handleViewPatient = (patientId) => {
    navigate(`/doctor/patients/${patientId}`);
  };

  // Handle patient deletion
  const handleDeletePatient = async (patientId) => {
    if (window.confirm('Are you sure you want to delete this patient?')) {
      try {
        await doctorService.deletePatient(patientId);
        setPatients(patients.filter(patient => patient.id !== patientId));
        // Show success message
        alert('Patient deleted successfully');
      } catch (error) {
        console.error('Error deleting patient:', error);
        alert('Failed to delete patient');
      }
    }
  };

  // Filter patients based on search and filters
  const filteredPatients = patients.filter(patient => {
    const matchesSearch = 
      patient.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'All' || patient.status === statusFilter;
    const matchesAppointment = appointmentFilter === 'All'; // Add your appointment logic here
    
    return matchesSearch && matchesStatus && matchesAppointment;
  });

  if (loading) {
    return <div className="loading-container"><div className="loading-spinner"></div></div>;
  }

  return (
    <div className="patient-list-container">
      {/* Header */}
      <div className="page-header">
        <div className="header-content">
          <h1 className="page-title">My Patients</h1>
          <p className="page-subtitle">
            Compassionate care begins here. View and manage the individuals you're supporting.
          </p>
        </div>
        <div className="header-actions">
          <button className="add-patient-btn">
            <span className="btn-icon">+</span>
            Add a Patient
          </button>
          <button className="export-btn">
            <span className="btn-icon">📄</span>
            Export PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="search-container">
          <input
            type="text"
            placeholder="Search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="filter-group">
          <div className="filter-item">
            <label>Status</label>
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              <option value="All">All</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          
          <div className="filter-item">
            <label>Upcoming Appointments</label>
            <select 
              value={appointmentFilter} 
              onChange={(e) => setAppointmentFilter(e.target.value)}
              className="filter-select"
            >
              <option value="All">All</option>
              <option value="Today">Today</option>
              <option value="This Week">This Week</option>
            </select>
          </div>
        </div>
      </div>

      {/* Patient Table */}
      <div className="table-container">
        <table className="patients-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Email</th>
              <th>Gender</th>
              <th>Age</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPatients.map((patient) => (
              <tr key={patient.id || patient._id}>
                {/* Patient Info */}
                <td className="patient-info-cell">
                  <div className="patient-avatar">
                    {patient.profilePicture && patient.profilePicture !== 'default-profile.png' ? (
                      <img 
                        src={patient.profilePicture} 
                        alt={`${patient.firstName} ${patient.lastName}`}
                        className="avatar-image"
                      />
                    ) : (
                      <div className="avatar-placeholder">
                        {patient.firstName?.[0] || 'P'}
                      </div>
                    )}
                  </div>
                  <div className="patient-details">
                    <span className="patient-name">
                      {patient.firstName} {patient.lastName}
                    </span>
                  </div>
                </td>

                {/* Email */}
                <td className="email-cell">
                  {patient.email || 'Not provided'}
                </td>

                {/* Gender */}
                <td className="gender-cell">
                  {patient.gender || 'Not specified'}
                </td>

                {/* Age */}
                <td className="age-cell">
                  {patient.age || 'Unknown'}
                </td>

                {/* Actions - UPDATED PART */}
                <td className="actions-column">
                  <div className="action-buttons">
                    {/* View Button (Eye Icon) */}
                    <button 
                      className="view-btn"
                      onClick={() => handleViewPatient(patient.id || patient._id)}
                      title="View Patient Details"
                    >
                      <span className="action-icon">👁</span>
                    </button>
                    
                    {/* Delete Button (X Icon) */}
                    <button 
                      className="delete-btn"
                      onClick={() => handleDeletePatient(patient.id || patient._id)}
                      title="Delete Patient"
                    >
                      <span className="action-icon">✕</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Empty State */}
        {filteredPatients.length === 0 && (
          <div className="empty-state">
            <p>No patients found matching your criteria.</p>
          </div>
        )}
      </div>

      {/* Pagination (if needed) */}
      <div className="pagination-container">
        <div className="pagination-info">
          Showing {filteredPatients.length} of {patients.length} patients
        </div>
        <div className="pagination-controls">
          {/* Add pagination buttons here if needed */}
        </div>
      </div>
    </div>
  );
};

export default PatientList;