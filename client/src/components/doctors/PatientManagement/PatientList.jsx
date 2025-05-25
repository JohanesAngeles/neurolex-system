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
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [actionMenuPosition, setActionMenuPosition] = useState({ top: 0, left: 0 });
  
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
            { _id: '1', firstName: 'John', lastName: 'Doe', email: 'john@example.com', gender: 'Male', age: 42 },
            { _id: '2', firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com', gender: 'Female', age: 35 },
            { _id: '3', firstName: 'Alex', lastName: 'Brown', email: 'alex@example.com', gender: 'Other', age: 28 },
          ];
          setPatients(mockPatients);
          setFilteredPatients(mockPatients);
        }
        
        setLoading(false);
      }
    };
    
    fetchPatients();
  }, []);
  
  // Handle search
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredPatients(patients);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = patients.filter(patient => 
        patient.firstName?.toLowerCase().includes(query) || 
        patient.lastName?.toLowerCase().includes(query) || 
        patient.email?.toLowerCase().includes(query)
      );
      setFilteredPatients(filtered);
    }
    
    // Reset to first page when search changes
    setCurrentPage(1);
  }, [searchQuery, patients]);
  
  // Handle action menu
  const handleShowActionMenu = (event, patient) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedPatient(patient);
    
    // Position the menu near the clicked button
    const rect = event.currentTarget.getBoundingClientRect();
    setActionMenuPosition({
      top: rect.bottom + window.scrollY,
      left: rect.left + window.scrollX - 100 // Offset to align the menu
    });
    
    setShowActionMenu(true);
    
    // Add click event listener to close the menu when clicking outside
    document.addEventListener('click', handleClickOutside);
  };
  
  // Handle click outside of action menu
  const handleClickOutside = () => {
    setShowActionMenu(false);
    document.removeEventListener('click', handleClickOutside);
  };
  
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
    setShowActionMenu(false);
  };
  
  const handleViewJournals = (patientId) => {
    navigate(`/doctor/patients/${patientId}/journals`);
    setShowActionMenu(false);
  };
  
  const handleAssignTemplates = (patientId) => {
    navigate(`/doctor/form-templates/assign`, { 
      state: { selectedPatients: [patientId] } 
    });
    setShowActionMenu(false);
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
      
      {error && (
        <div className="error-alert">
          <span className="error-icon">⚠️</span>
          <span className="error-message">{error}</span>
        </div>
      )}
      
      <div className="list-controls">
        <div className="search-container">
          <input
            type="text"
            placeholder="Search patients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>
        
        <button
          className="primary-button"
          onClick={() => navigate('/doctor/patient-management')}
        >
          Manage Patients
        </button>
      </div>
      
      <div className="dashboard-section">
        <div className="custom-table">
          {/* Table Header */}
          <div className="table-row header-row">
            <div className="table-cell">Patient</div>
            <div className="table-cell">Email</div>
            <div className="table-cell">Gender</div>
            <div className="table-cell">Age</div>
            <div className="table-cell">Recent Journals</div>
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
                className={`table-row ${index % 2 === 0 ? 'odd-row' : 'even-row'}`}
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
                
                <div className="table-cell">
                  <button 
                    className="view-journals-button"
                    onClick={() => handleViewJournals(patient._id)}
                  >
                    View Journals
                  </button>
                </div>
                
                <div className="table-cell">
                  <div className="action-buttons">
                    <button 
                      className="btn-icon view"
                      onClick={() => handleViewPatient(patient._id)}
                      title="View patient details"
                    >
                      <i className="icon-view"></i>
                    </button>
                    <button 
                      className="btn-icon approve"
                      onClick={() => handleAssignTemplates(patient._id)}
                      title="Assign forms"
                    >
                      <i className="icon-assign"></i>
                    </button>
                    <button
                      className="btn-icon more"
                      onClick={(e) => handleShowActionMenu(e, patient)}
                      title="More options"
                    >
                      <i className="icon-more"></i>
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
      
      {/* Action Menu */}
      {showActionMenu && selectedPatient && (
        <div 
          className="action-menu"
          style={{
            top: `${actionMenuPosition.top}px`,
            left: `${actionMenuPosition.left}px`
          }}
        >
          <div className="menu-item" onClick={() => handleViewPatient(selectedPatient._id)}>
            <span className="menu-icon">👁️</span>
            <span>View Details</span>
          </div>
          <div className="menu-item" onClick={() => handleViewJournals(selectedPatient._id)}>
            <span className="menu-icon">📖</span>
            <span>View Journals</span>
          </div>
          <div className="menu-item" onClick={() => handleAssignTemplates(selectedPatient._id)}>
            <span className="menu-icon">📝</span>
            <span>Assign Templates</span>
          </div>
          <div className="menu-divider"></div>
          <div className="menu-item">
            <span className="menu-icon">💬</span>
            <span>Send Message</span>
          </div>
          <div className="menu-item">
            <span className="menu-icon">🎓</span>
            <span>Educational Resources</span>
          </div>
        </div>
      )}
    </>
  );
};

export default PatientList;