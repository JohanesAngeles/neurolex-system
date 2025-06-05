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
  
  const handleDeletePatient = (patientId) => {
    // Add confirmation dialog
    if (window.confirm('Are you sure you want to delete this patient? This action cannot be undone.')) {
      // TODO: Implement delete functionality
      console.log('Delete patient:', patientId);
      // You can add the actual delete API call here
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
                    
                    {/* Delete Button */}
                    <button
                      className="btn-icon delete"
                      onClick={() => handleDeletePatient(patient._id)}
                      title="Delete patient"
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
    </>
  );
};

export default PatientList;