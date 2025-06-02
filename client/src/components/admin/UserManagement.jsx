import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import adminService from '../../services/adminService';
import '../../styles/components/admin/AdminLayout.css';
import '../../styles/components/admin/UserManagement.css'; // Import the new CSS file

// Import icons from assets
import PlusIcon from '../../assets/icons/appointment_icon.svg';
import SearchIcon from '../../assets/icons/search_icon.svg';
import EditIcon from '../../assets/icons/edit_icon.svg';
import TrashIcon from '../../assets/icons/delete_icon.svg';
import EyeIcon from '../../assets/icons/view_icon.svg';
import DownloadIcon from '../../assets/icons/appointment_icon.svg';
import CheckCircleIcon from '../../assets/icons/view_icon.svg';
import XCircleIcon from '../../assets/icons/DoctorManagement_Icon.svg';

// Delete Confirmation Modal Component
const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, patientName, patientEmail }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <div className="modal-icon">
            <svg viewBox="0 0 24 24" className="delete-icon">
              <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 5V7H20L18.5 18C18.4 19.1 17.5 20 16.4 20H7.6C6.5 20 5.6 19.1 5.5 18L4 7H3V5H21M16.5 18L18 7H6L7.5 18H16.5Z" />
            </svg>
          </div>
        </div>
        
        <div className="modal-content">
          <h2 className="modal-title">DELETE PATIENT ACCOUNT?</h2>
          
          <div className="patient-info-card">
            <div className="patient-name">{patientName}</div>
            <div className="patient-email">{patientEmail}</div>
          </div>
          
          <p className="modal-message">
            Delete this patient account? This is permanent and can't be undone, 
            but it's okay to let go if you're ready.
          </p>
          
          <div className="modal-actions">
            <button className="modal-cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button className="modal-delete-btn" onClick={onConfirm}>
              Yes, Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const PatientManagement = () => {
  // State variables
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [genderFilter, setGenderFilter] = useState('All');
  const [tenantFilter, setTenantFilter] = useState('All');
  const [tenants, setTenants] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  
  // Modal state
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    patientId: null,
    tenantId: null,
    patientName: '',
    patientEmail: ''
  });
  
  const navigate = useNavigate();

  // Function to fetch tenants
  const fetchTenants = useCallback(async () => {
    try {
      const response = await adminService.getTenants();
      if (response.success) {
        setTenants(response.data);
      }
    } catch (err) {
      console.error('Error fetching tenants:', err);
    }
  }, []);

  // Function to fetch all patients across all tenants
  const fetchPatients = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminService.getAllPatients({
        page: currentPage,
        limit: itemsPerPage,
        search: searchTerm || undefined,
        status: statusFilter !== 'All' ? statusFilter.toLowerCase() : undefined,
        gender: genderFilter !== 'All' ? genderFilter : undefined,
        tenantId: tenantFilter !== 'All' ? tenantFilter : undefined,
      });
      
      if (response.success) {
        setPatients(response.data);
        // Update total pages from pagination info
        if (response.pagination) {
          setTotalPages(response.pagination.pages);
        }
      } else {
        throw new Error(response.message || 'Failed to fetch patients');
      }
    } catch (err) {
      console.error('Error fetching patients:', err);
      setError(err.message || 'An error occurred while fetching patients');
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, searchTerm, statusFilter, genderFilter, tenantFilter]);

  // Load tenants and patients on component mount
  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  // Load patients when filters change
  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  // Open delete confirmation modal
  const handleDeletePatient = (patientId, tenantId, patientName, patientEmail) => {
    setDeleteModal({
      isOpen: true,
      patientId,
      tenantId,
      patientName,
      patientEmail
    });
  };

  // Close delete confirmation modal
  const closeDeleteModal = () => {
    setDeleteModal({
      isOpen: false,
      patientId: null,
      tenantId: null,
      patientName: '',
      patientEmail: ''
    });
  };

  // Confirm delete patient
  const confirmDeletePatient = async () => {
    try {
      const response = await adminService.deletePatient(deleteModal.patientId, deleteModal.tenantId);
      
      if (response.success) {
        // Remove patient from state
        setPatients(prevPatients => prevPatients.filter(patient => patient._id !== deleteModal.patientId));
        alert('Patient deleted successfully');
        closeDeleteModal();
      } else {
        throw new Error(response.message || 'Failed to delete patient');
      }
    } catch (err) {
      console.error('Error deleting patient:', err);
      alert(`Error: ${err.message || 'An error occurred while deleting the patient'}`);
      closeDeleteModal();
    }
  };

  // Export patients as PDF
  const handleExportPDF = async () => {
    try {
      // Gather current filters
      const filters = {
        search: searchTerm || undefined,
        status: statusFilter !== 'All' ? statusFilter.toLowerCase() : undefined,
        gender: genderFilter !== 'All' ? genderFilter : undefined,
        tenantId: tenantFilter !== 'All' ? tenantFilter : undefined
      };
      
      // Call the export service
      await adminService.exportPatientsToPdf(filters);
      
      // The PDF download should be triggered by the browser
    } catch (err) {
      console.error('Error exporting PDF:', err);
      alert(`Error: ${err.message || 'An error occurred while exporting to PDF'}`);
    }
  };

  // Navigate to add new patient page
  const handleAddPatient = () => {
    navigate('/admin/patients/add');
  };

  // Navigate to patient details page
  const handleViewPatient = (patientId, tenantId) => {
    navigate(`/admin/patients/${patientId}?tenantId=${tenantId}`);
  };

  // Navigate to edit patient page
  const handleEditPatient = (patientId, tenantId) => {
    navigate(`/admin/patients/${patientId}/edit?tenantId=${tenantId}`);
  };

  // Change page
  const paginate = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  // Get tenant name from ID
  const getTenantName = (tenantId) => {
    const tenant = tenants.find(t => t._id === tenantId);
    return tenant ? tenant.name : 'Unknown Clinic';
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  // Get status badge JSX
  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return (
          <span className="status-badge active">
            <img src={CheckCircleIcon} alt="Active" className="status-icon" /> Active
          </span>
        );
      case 'pending':
        return <span className="status-badge pending">Pending</span>;
      case 'inactive':
      case 'suspended':
        return (
          <span className="status-badge inactive">
            <img src={XCircleIcon} alt="Inactive" className="status-icon" /> Inactive
          </span>
        );
      default:
        return <span className="status-badge">{status || 'Unknown'}</span>;
    }
  };

  if (loading) {
    return <div className="loading-container"><div className="loading-spinner"></div></div>;
  }

  if (error) {
    return <div className="error-alert"><span className="alert-title">Error:</span> {error}</div>;
  }

  return (
    <div className="admin-content">
      <div className="user-management-header">
        <h1>Patient Management</h1>
        <p>Easily view, update, and manage all patients in the system.</p>
      </div>

      {/* Search and actions bar */}
      <div className="admin-actions-bar">
        {/* Top row with search and add button */}
        <div className="top-actions-row">
          <div className="search-box">
            <img src={SearchIcon} alt="Search" className="search-icon" />
            <input 
              type="text" 
              placeholder="Search patients by name or email" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
          
          <button className="Add-Patient-Button" onClick={handleAddPatient}>
            <img src={PlusIcon} alt="Add" className="button-icon" /> Add a Patient
          </button>
        </div>
        
        {/* Bottom row with filters and export button */}
        <div className="bottom-actions-row">
          <div className="filter-box">
            {/* Tenant filter */}
            <div className="filter-item">
              <label htmlFor="tenant-filter">Clinic:</label>
              <select 
                id="tenant-filter" 
                value={tenantFilter} 
                onChange={(e) => setTenantFilter(e.target.value)}
              >
                <option value="All">All Clinics</option>
                {tenants.map(tenant => (
                  <option key={tenant._id} value={tenant._id}>
                    {tenant.name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Other filters */}
            <div className="filter-item">
              <label htmlFor="status-filter">Status:</label>
              <select 
                id="status-filter" 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">All</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Pending">Pending</option>
              </select>
            </div>
            
            <div className="filter-item">
              <label htmlFor="gender-filter">Gender:</label>
              <select 
                id="gender-filter" 
                value={genderFilter} 
                onChange={(e) => setGenderFilter(e.target.value)}
              >
                <option value="All">All</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Non-Binary">Non-Binary</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
          
          {/* Export button */}
          <div className="action-buttons">
            <button className="Export-PDF-Button" onClick={handleExportPDF}>
              <img src={DownloadIcon} alt="Download" className="button-icon" /> Export PDF
            </button>
          </div>
        </div>
      </div>

      {/* Patients table */}
      {patients.length === 0 ? (
        <div className="empty-state">
          <h3>No patients found</h3>
          <p>Try adjusting your search or filters, or add a new patient.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Registration Date</th>
                <th>Clinic</th>
                <th>Account Status</th>
                <th>Assigned Doctor</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {patients.map(patient => (
                <tr key={`${patient._id}-${patient.tenantId}`}>
                  <td data-label="Name">
                    <div className="user-name-cell">
                      <div className="user-avatar">
                        {patient.profilePicture ? (
                          <img src={patient.profilePicture} alt={`${patient.firstName} ${patient.lastName}`} />
                        ) : (
                          <div className="user-initials">
                            {patient.firstName?.[0]}{patient.lastName?.[0]}
                          </div>
                        )}
                      </div>
                      <div className="user-info">
                        <div className="user-fullname">
                          {patient.firstName} {patient.lastName}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td data-label="Email">{patient.email}</td>
                  <td data-label="Registration Date">{formatDate(patient.createdAt)}</td>
                  <td data-label="Clinic">{getTenantName(patient.tenantId)}</td>
                  <td data-label="Account Status">{getStatusBadge(patient.accountStatus)}</td>
                  <td data-label="Assigned Doctor">{patient.primaryDoctor || 'Not assigned'}</td>
                  <td data-label="Actions">
                    <div className="action-icons">
                      <img 
                        src={EyeIcon} 
                        className="action-icon view" 
                        onClick={() => handleViewPatient(patient._id, patient.tenantId)} 
                        title="View Patient" 
                        alt="View"
                      />
                      <img 
                        src={EditIcon} 
                        className="action-icon edit" 
                        onClick={() => handleEditPatient(patient._id, patient.tenantId)} 
                        title="Edit Patient" 
                        alt="Edit"
                      />
                      <img 
                        src={TrashIcon} 
                        className="action-icon delete" 
                        onClick={() => handleDeletePatient(
                          patient._id, 
                          patient.tenantId, 
                          `${patient.firstName} ${patient.lastName}`,
                          patient.email
                        )} 
                        title="Delete Patient" 
                        alt="Delete"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button 
            className="pagination-button" 
            onClick={() => paginate(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            &laquo; Previous
          </button>
          
          <div className="pagination-info">
            Page {currentPage} of {totalPages}
          </div>
          
          <button 
            className="pagination-button" 
            onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
          >
            Next &raquo;
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={closeDeleteModal}
        onConfirm={confirmDeletePatient}
        patientName={deleteModal.patientName}
        patientEmail={deleteModal.patientEmail}
      />
    </div>
  );
};

export default PatientManagement;