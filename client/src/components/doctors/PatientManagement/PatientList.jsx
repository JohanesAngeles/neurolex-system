// client/src/components/doctors/PatientManagement/PatientList.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import doctorService from '../../../services/doctorService';
import '../../../styles/components/doctor/PatientList.css';

const PatientList = () => {
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState([]);
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [appointmentFilter, setAppointmentFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(10);
  
  // End Care Modal States
  const [showEndCareModal, setShowEndCareModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [endCareLoading, setEndCareLoading] = useState(false);
  const [understanding, setUnderstanding] = useState(false);
  
  // Fetch patients
  useEffect(() => {
    const fetchPatients = async () => {
      try {
        setLoading(true);
        
        // Check if token exists to help debug
        const token = localStorage.getItem('token');
        if (!token) {
          console.error('No authentication token found in localStorage');
          setError('Authentication error: No token found. Please log in again.');
          setLoading(false);
          return;
        }
        
        // Let's try to use our doctorService instead of direct axios call
        const response = await doctorService.getPatients();
        
        // Make sure we're properly handling the response format
        if (response.success && response.patients) {
          setPatients(response.patients);
          setFilteredPatients(response.patients);
        } else if (response.data && response.data.success && response.data.patients) {
          // Handle alternative response format
          setPatients(response.data.patients);
          setFilteredPatients(response.data.patients);
        } else {
          setError('Failed to load patients: Unexpected response format');
          console.error('Unexpected response format:', response);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching patients:', error);
        
        // Show more detailed error info for debugging
        let errorMessage = 'Failed to load patients. Please try again later.';
        
        if (error.response) {
          console.error('Error response:', error.response.status, error.response.data);
          
          if (error.response.status === 401) {
            errorMessage = 'Authentication error: Please log in again.';
          } else if (error.response.status === 403) {
            errorMessage = 'Access denied: You do not have permission to view patients.';
          } else {
            errorMessage = `Error: ${error.response.status} - ${error.response.data.message || 'Unknown error'}`;
          }
        }
        
        setError(errorMessage);
        
        // If in development, use mock data
        if (process.env.NODE_ENV === 'development') {
          console.log('Using mock patient data for development');
          const mockPatients = [
            { _id: '1', firstName: 'John', lastName: 'Doe', email: 'john@example.com', gender: 'Male', age: 42, status: 'Active' },
            { _id: '2', firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com', gender: 'Female', age: 35, status: 'Active' },
            { _id: '3', firstName: 'Alex', lastName: 'Brown', email: 'alex@example.com', gender: 'Other', age: 28, status: 'Inactive' },
          ];
          setPatients(mockPatients);
          setFilteredPatients(mockPatients);
        }
        
        setLoading(false);
      }
    };
    
    fetchPatients();
  }, []);
  
  // Handle search and filters
  useEffect(() => {
    let filtered = patients;
    
    // Apply search filter
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(patient => 
        patient.firstName?.toLowerCase().includes(query) || 
        patient.lastName?.toLowerCase().includes(query) || 
        patient.email?.toLowerCase().includes(query)
      );
    }
    
    // Apply status filter
    if (statusFilter !== 'All') {
      filtered = filtered.filter(patient => patient.status === statusFilter);
    }
    
    // Apply appointment filter (you can extend this based on your data structure)
    if (appointmentFilter !== 'All') {
      // This is a placeholder - you'll need to implement based on your appointment data
      // filtered = filtered.filter(patient => /* your appointment filter logic */);
    }
    
    setFilteredPatients(filtered);
    
    // Reset to first page when filters change
    setCurrentPage(1);
  }, [searchQuery, statusFilter, appointmentFilter, patients]);
  
  // Pagination
  const indexOfLastPatient = currentPage * rowsPerPage;
  const indexOfFirstPatient = indexOfLastPatient - rowsPerPage;
  const currentPatients = filteredPatients.slice(indexOfFirstPatient, indexOfLastPatient);
  const totalPages = Math.ceil(filteredPatients.length / rowsPerPage);
  
  const paginate = (pageNumber) => {
    setCurrentPage(pageNumber);
  };
  
  // Handle actions
  const handleViewPatient = (patientId) => {
    navigate(`/doctor/patients/${patientId}`);
  };
  
  const handleEditPatient = (patientId) => {
    navigate(`/doctor/patients/${patientId}/edit`);
  };
  
  // NEW: Handle End Care Modal
  const handleEndCare = (patient) => {
    console.log('Opening end care modal for patient:', patient);
    setSelectedPatient(patient);
    setShowEndCareModal(true);
    setUnderstanding(false); // Reset checkbox
  };
  
  const closeEndCareModal = () => {
    setShowEndCareModal(false);
    setSelectedPatient(null);
    setUnderstanding(false);
    setEndCareLoading(false);
  };
  
  // NEW: Confirm End Care
  const confirmEndCare = async () => {
    if (!understanding || !selectedPatient) {
      return;
    }
    
    try {
      setEndCareLoading(true);
      
      // Call the API to end care
      const response = await doctorService.endPatientCare(selectedPatient._id);
      
      if (response.success) {
        // Remove the patient from the local state
        setPatients(prev => prev.filter(p => p._id !== selectedPatient._id));
        setFilteredPatients(prev => prev.filter(p => p._id !== selectedPatient._id));
        
        // Show success message (you can add a toast notification here)
        console.log('Care ended successfully:', response.message);
        
        // Close modal
        closeEndCareModal();
        
        // Optional: Show success toast
        // toast.success('Care relationship ended successfully');
      } else {
        throw new Error(response.message || 'Failed to end care');
      }
    } catch (error) {
      console.error('Error ending care:', error);
      setError(error.message || 'Failed to end care relationship');
      setEndCareLoading(false);
    }
  };
  
  const handleAddPatient = () => {
    navigate('/doctor/patients/add');
  };
  
  const handleExportPDF = () => {
    // TODO: Implement PDF export functionality
    console.log('Export PDF functionality');
    alert('PDF export functionality coming soon!');
  };
  
  const formatPatientName = (patient) => {
    if (!patient) return 'Unknown Patient';
    return `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || patient.email || 'Unknown Patient';
  };
  
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }
  
  return (
    <>
      <h1 className="dashboard-title">My Patients</h1>
      <p className="dashboard-subtitle">Compassionate care begins here. View and manage the individuals you're supporting.</p>
      
      <div className="section-divider"></div>
      
      {error && (
        <div className="error-alert">
          <span className="error-icon">⚠️</span>
          <span className="error-message">{error}</span>
        </div>
      )}
      
      <div className="list-controls">
        <div className="controls-left">
          {/* Search Container */}
          <div className="search-container">
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <div className="search-icon"></div>
          </div>
          
          {/* Filter Controls */}
          <div className="filter-controls">
            <div className="filter-group">
              <label className="filter-label">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="filter-select"
              >
                <option value="All">All</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Pending">Pending</option>
              </select>
            </div>
            
            <div className="filter-group">
              <label className="filter-label">Upcoming Appointments</label>
              <select
                value={appointmentFilter}
                onChange={(e) => setAppointmentFilter(e.target.value)}
                className="filter-select"
              >
                <option value="All">All</option>
                <option value="Today">Today</option>
                <option value="This Week">This Week</option>
                <option value="This Month">This Month</option>
                <option value="No Appointments">No Appointments</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="controls-right">
          <button
            className="primary-button"
            onClick={handleAddPatient}
          >
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Add a Patient
          </button>
          
          <button
            className="export-button"
            onClick={handleExportPDF}
          >
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="20" height="20">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="10,9 9,9 8,9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Export PDF
          </button>
        </div>
      </div>
      
      <div className="dashboard-section">
        <div className="custom-table">
          {/* Table Header */}
          <div className="table-row header-row">
            <div className="table-cell">Patient</div>
            <div className="table-cell">Email</div>
            <div className="table-cell">Gender</div>
            <div className="table-cell">Age</div>
            <div className="table-cell">Actions</div>
          </div>
          
          {/* Table Body */}
          {filteredPatients.length === 0 ? (
            <div className="table-row empty-row">
              <div className="table-cell" style={{ gridColumn: '1 / -1' }}>
                <p className="no-data">No patients found</p>
              </div>
            </div>
          ) : (
            currentPatients.map((patient, index) => (
              <div 
                key={patient._id} 
                className="table-row"
              >
                <div className="table-cell patient-cell">
                  <div className="patient-avatar">
                    {patient.firstName?.[0] || 'P'}
                  </div>
                  <div className="patient-name">
                    {`${patient.firstName || ''} ${patient.lastName || ''}`}
                  </div>
                </div>
                
                <div className="table-cell">{patient.email}</div>
                <div className="table-cell">{patient.gender || 'Not specified'}</div>
                <div className="table-cell">{patient.age || 'Unknown'}</div>
                
                <div className="table-cell actions-cell">
                  <button 
                    className="view-journals-button"
                    onClick={() => navigate(`/doctor/patients/${patient._id}/journals`)}
                  >
                    View Journals
                  </button>
                  
                  <div className="action-buttons">
                    {/* View Button */}
                    <button 
                      className="btn-icon view"
                      onClick={() => handleViewPatient(patient._id)}
                      title="View patient details"
                    >
                      <svg className="icon-view" viewBox="0 0 24 24">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    </button>
                    
                    {/* Edit Button */}
                    <button 
                      className="btn-icon edit"
                      onClick={() => handleEditPatient(patient._id)}
                      title="Edit patient"
                    >
                      <svg className="icon-edit" viewBox="0 0 24 24">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="m18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    
                    {/* End Care Button (was Delete) */}
                    <button
                      className="btn-icon delete"
                      onClick={() => handleEndCare(patient)}
                      title="End care relationship"
                    >
                      <svg className="icon-delete" viewBox="0 0 24 24">
                        <path d="M18 6L6 18"/>
                        <path d="M6 6l12 12"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <button 
              className="page-nav prev"
              onClick={() => paginate(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            
            <div className="page-numbers">
              {[...Array(totalPages)].map((_, index) => (
                <button
                  key={index}
                  className={`page-number ${currentPage === index + 1 ? 'active' : ''}`}
                  onClick={() => paginate(index + 1)}
                >
                  {index + 1}
                </button>
              ))}
            </div>
            
            <button 
              className="page-nav next"
              onClick={() => paginate(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        )}
      </div>
      
      {/* END CARE MODAL */}
      {showEndCareModal && (
        <div className="modal-overlay">
          <div className="modal-container end-care-modal">
            {/* Header */}
            <div className="modal-header">
              <div className="header-icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 9V13M12 17H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" 
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h2 className="modal-title">END CARE FOR THIS PATIENT?</h2>
            </div>

            {/* Patient Info */}
            <div className="patient-info-card">
              <div className="patient-name">{formatPatientName(selectedPatient)}</div>
              <div className="patient-subtitle">Mood Check-In Log - April 19, 2025</div>
            </div>

            {/* Warning Message */}
            <div className="warning-message">
              <p>Are you sure you want to remove this patient from your care?</p>
              <p>This will end your access to their records and session history.</p>
            </div>

            {/* Understanding Checkbox */}
            <div className="understanding-section">
              <label className="checkbox-container">
                <input
                  type="checkbox"
                  checked={understanding}
                  onChange={(e) => setUnderstanding(e.target.checked)}
                  className="understanding-checkbox"
                />
                <span className="checkmark"></span>
                <span className="checkbox-text">
                  I understand that ending care will terminate my professional relationship with this patient
                </span>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="modal-actions">
              <button
                className="cancel-button"
                onClick={closeEndCareModal}
                disabled={endCareLoading}
              >
                Cancel
              </button>
              <button
                className={`confirm-button ${!understanding ? 'disabled' : ''}`}
                onClick={confirmEndCare}
                disabled={!understanding || endCareLoading}
              >
                {endCareLoading ? (
                  <>
                    <div className="loading-spinner"></div>
                    Ending Care...
                  </>
                ) : (
                  'Yes, Remove'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PatientList;