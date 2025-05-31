// client/src/components/admin/TenantManagement.jsx
import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import adminService from '../../services/adminService';
import '../../styles/components/admin/TenantManagement.css';

const TenantManagement = () => {
  // State management
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTenants, setTotalTenants] = useState(0);
  
  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [locations, setLocations] = useState([]);
  
  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    primaryEmail: '',
    name: '',
    location: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Load tenants on component mount and when filters change
  useEffect(() => {
    loadTenants();
  }, [currentPage, itemsPerPage, searchTerm, statusFilter, locationFilter]);

  // Load unique locations for filter dropdown
  useEffect(() => {
    loadUniqueLocations();
  }, [tenants]);

  const loadTenants = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Build query parameters
      const params = {
        page: currentPage,
        limit: itemsPerPage
      };
      
      if (searchTerm) params.search = searchTerm;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (locationFilter !== 'all') params.location = locationFilter;
      
      // Call tenant service (we'll add this to adminService)
      const response = await adminService.getTenants(params);
      
      if (response.success) {
        setTenants(response.data || []);
        setTotalTenants(response.total || 0);
        setTotalPages(Math.ceil((response.total || 0) / itemsPerPage));
      } else {
        throw new Error(response.message || 'Failed to load tenants');
      }
    } catch (err) {
      console.error('Error loading tenants:', err);
      setError(err.message);
      
      // Mock data for development
      if (process.env.NODE_ENV === 'development') {
        setTenants([
          {
            _id: '1',
            tenantId: 'NLX-2025-001',
            name: 'MindBridge Health',
            location: 'New York, NY',
            active: true,
            doctorCount: 15,
            patientCount: 320,
            createdAt: '2025-04-19T00:00:00Z'
          },
          {
            _id: '2',
            tenantId: 'NLX-2025-002',
            name: 'NovaTherapy',
            location: 'Los Angeles, CA',
            active: true,
            doctorCount: 4,
            patientCount: 53,
            createdAt: '2025-03-01T00:00:00Z'
          },
          {
            _id: '3',
            tenantId: 'NLX-2025-003',
            name: 'ClearPath Clinic',
            location: 'Chicago, IL',
            active: false,
            doctorCount: 8,
            patientCount: 129,
            createdAt: '2025-02-28T00:00:00Z'
          },
          {
            _id: '4',
            tenantId: 'NLX-2025-004',
            name: 'Serenity Center',
            location: 'Miami, FL',
            active: false,
            doctorCount: 10,
            patientCount: 182,
            createdAt: '2025-02-12T00:00:00Z'
          }
        ]);
        setTotalTenants(4);
        setTotalPages(1);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadUniqueLocations = () => {
    const uniqueLocations = [...new Set(tenants.map(tenant => tenant.location))].filter(Boolean);
    setLocations(uniqueLocations);
  };

  // Handle form submission for add/edit
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    try {
      setSubmitting(true);
      
      if (showEditModal && selectedTenant) {
        // Update existing tenant
        const response = await adminService.updateTenant(selectedTenant._id, formData);
        
        if (response.success) {
          toast.success('Tenant updated successfully!');
          setShowEditModal(false);
          loadTenants();
        } else {
          throw new Error(response.message || 'Failed to update tenant');
        }
      } else {
        // Create new tenant
        const response = await adminService.createTenant(formData);
        
        if (response.success) {
          toast.success(`Welcome email sent to ${formData.primaryEmail}! Tenant created successfully.`);
          setShowAddModal(false);
          loadTenants();
        } else {
          throw new Error(response.message || 'Failed to create tenant');
        }
      }
      
      resetForm();
    } catch (err) {
      console.error('Error submitting form:', err);
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Validate form data
  const validateForm = () => {
    const errors = {};
    
    if (!formData.primaryEmail?.trim()) {
      errors.primaryEmail = 'Primary email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.primaryEmail)) {
      errors.primaryEmail = 'Please enter a valid email address';
    }
    
    if (!formData.name?.trim()) {
      errors.name = 'Clinic name is required';
    }
    
    if (!formData.location?.trim()) {
      errors.location = 'Clinic location is required';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Reset form data
  const resetForm = () => {
    setFormData({
      primaryEmail: '',
      name: '',
      location: ''
    });
    setFormErrors({});
    setSelectedTenant(null);
  };

  // Handle status toggle (active/inactive)
  const handleStatusToggle = async (tenant) => {
    try {
      const newStatus = !tenant.active;
      const response = await adminService.updateTenantStatus(tenant._id, { active: newStatus });
      
      if (response.success) {
        toast.success(`Tenant ${newStatus ? 'activated' : 'deactivated'} successfully`);
        loadTenants();
      } else {
        throw new Error(response.message || 'Failed to update tenant status');
      }
    } catch (err) {
      console.error('Error updating tenant status:', err);
      toast.error(err.message);
    }
  };

  // Handle tenant deletion
  const handleDelete = async () => {
    if (!selectedTenant) return;
    
    try {
      const response = await adminService.deleteTenant(selectedTenant._id);
      
      if (response.success) {
        toast.success('Tenant deleted successfully');
        setShowDeleteModal(false);
        loadTenants();
      } else {
        throw new Error(response.message || 'Failed to delete tenant');
      }
    } catch (err) {
      console.error('Error deleting tenant:', err);
      toast.error(err.message);
    }
  };

  // Handle PDF export
  const handleExportPDF = async () => {
    try {
      const filters = {
        search: searchTerm,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        location: locationFilter !== 'all' ? locationFilter : undefined
      };
      
      await adminService.exportTenantsToPdf(filters);
      toast.success('PDF exported successfully');
    } catch (err) {
      console.error('Error exporting PDF:', err);
      toast.error('Failed to export PDF');
    }
  };

  // Handle pagination
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (e) => {
    setItemsPerPage(parseInt(e.target.value));
    setCurrentPage(1);
  };

  // Open modals
  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const openEditModal = (tenant) => {
    setSelectedTenant(tenant);
    setFormData({
      primaryEmail: tenant.adminEmail || '',
      name: tenant.name || '',
      location: tenant.location || ''
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (tenant) => {
    setSelectedTenant(tenant);
    setShowDeleteModal(true);
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  // Get pagination info
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalTenants);

  return (
    <div className="tenant-management">
      {/* Header */}
      <div className="tenant-header">
        <div className="header-left">
          <h1 className="page-title">Neurolex Tenants</h1>
          <p className="page-subtitle">Manage clinic tenants and their configurations</p>
        </div>
        <div className="header-actions">
          <button 
            className="btn-secondary"
            onClick={handleExportPDF}
            disabled={loading}
          >
            📄 Export PDF
          </button>
          <button 
            className="btn-primary"
            onClick={openAddModal}
          >
            ➕ Add a Tenant
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filters-row">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search by clinic name or tenant ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          
          <div className="filter-group">
            <label>Status:</label>
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label>Location:</label>
            <select 
              value={locationFilter} 
              onChange={(e) => setLocationFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All</option>
              {locations.map(location => (
                <option key={location} value={location}>{location}</option>
              ))}
            </select>
          </div>
          
          <div className="results-info">
            <span>Show: </span>
            <select 
              value={itemsPerPage} 
              onChange={handleItemsPerPageChange}
              className="items-per-page-select"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-message">
          <p>Error: {error}</p>
          <button onClick={loadTenants} className="btn-retry">Retry</button>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading tenants...</p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="table-container">
            <table className="tenants-table">
              <thead>
                <tr>
                  <th>Clinic Name</th>
                  <th>Tenant ID</th>
                  <th>Status</th>
                  <th># Doctors</th>
                  <th># Patients</th>
                  <th>Created Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenants.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="no-data">
                      No tenants found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  tenants.map(tenant => (
                    <tr key={tenant._id}>
                      <td className="clinic-name">{tenant.name}</td>
                      <td className="tenant-id">{tenant.tenantId}</td>
                      <td>
                        <span className={`status-badge ${tenant.active ? 'active' : 'inactive'}`}>
                          {tenant.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="count">{tenant.doctorCount || 0}</td>
                      <td className="count">{tenant.patientCount || 0}</td>
                      <td className="date">{formatDate(tenant.createdAt)}</td>
                      <td className="actions">
                        <button 
                          className="action-btn view-btn"
                          onClick={() => openEditModal(tenant)}
                          title="View Details"
                        >
                          👁️
                        </button>
                        <button 
                          className="action-btn edit-btn"
                          onClick={() => openEditModal(tenant)}
                          title="Edit Tenant"
                        >
                          ✏️
                        </button>
                        <button 
                          className={`action-btn ${tenant.active ? 'disable-btn' : 'enable-btn'}`}
                          onClick={() => handleStatusToggle(tenant)}
                          title={tenant.active ? 'Disable' : 'Enable'}
                        >
                          {tenant.active ? '🔴' : '🟢'}
                        </button>
                        <button 
                          className="action-btn delete-btn"
                          onClick={() => openDeleteModal(tenant)}
                          title="Delete Tenant"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="pagination-container">
            <div className="pagination-info">
              Showing {startItem} to {endItem} of {totalTenants} entries
            </div>
            
            <div className="pagination-controls">
              <button 
                className="pagination-btn"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                  onClick={() => handlePageChange(page)}
                >
                  {page}
                </button>
              ))}
              
              <button 
                className="pagination-btn"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {/* Add/Edit Tenant Modal */}
      {(showAddModal || showEditModal) && (
        <div className="modal-overlay" onClick={() => {
          setShowAddModal(false);
          setShowEditModal(false);
          resetForm();
        }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{showEditModal ? 'Edit Tenant' : 'Add New Tenant'}</h2>
              <button 
                className="modal-close"
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                  resetForm();
                }}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="tenant-form">
              <div className="form-group">
                <label htmlFor="primaryEmail">Primary Email *</label>
                <input
                  type="email"
                  id="primaryEmail"
                  value={formData.primaryEmail}
                  onChange={(e) => setFormData({...formData, primaryEmail: e.target.value})}
                  className={formErrors.primaryEmail ? 'error' : ''}
                  placeholder="admin@clinic.com"
                />
                {formErrors.primaryEmail && (
                  <span className="error-text">{formErrors.primaryEmail}</span>
                )}
                <small>A congratulatory email will be sent to this address</small>
              </div>
              
              <div className="form-group">
                <label htmlFor="clinicName">Clinic Name *</label>
                <input
                  type="text"
                  id="clinicName"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className={formErrors.name ? 'error' : ''}
                  placeholder="Enter clinic name"
                />
                {formErrors.name && (
                  <span className="error-text">{formErrors.name}</span>
                )}
                <small>This name will be used for the database and branding</small>
              </div>
              
              <div className="form-group">
                <label htmlFor="location">Clinic Location *</label>
                <input
                  type="text"
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  className={formErrors.location ? 'error' : ''}
                  placeholder="City, State"
                />
                {formErrors.location && (
                  <span className="error-text">{formErrors.location}</span>
                )}
                <small>Full address where the clinic is located</small>
              </div>
              
              <div className="form-actions">
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                    resetForm();
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Saving...' : (showEditModal ? 'Update Tenant' : 'Create Tenant')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedTenant && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content delete-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm Deletion</h2>
              <button 
                className="modal-close"
                onClick={() => setShowDeleteModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="delete-content">
              <p>Are you sure you want to permanently delete this tenant?</p>
              <div className="tenant-details">
                <strong>{selectedTenant.name}</strong>
                <br />
                <span>Tenant ID: {selectedTenant.tenantId}</span>
                <br />
                <span>Doctors: {selectedTenant.doctorCount || 0}</span>
                <br />
                <span>Patients: {selectedTenant.patientCount || 0}</span>
              </div>
              <p className="warning">
                ⚠️ This action cannot be undone. All associated data will be permanently removed.
              </p>
            </div>
            
            <div className="form-actions">
              <button 
                className="btn-secondary"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
              <button 
                className="btn-danger"
                onClick={handleDelete}
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TenantManagement;