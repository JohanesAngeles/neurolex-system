import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Tab, Tabs, Box, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Select, MenuItem, FormControl, InputLabel, FormHelperText, CircularProgress,
  Pagination, Stack, Alert, Typography
} from '@mui/material';
import { toast } from 'react-toastify';
import adminService from '../../services/adminService';
import AddDoctorModal from './AddDoctorModal';
import '../../styles/components/admin/AdminLayout.css';
import '../../styles/components/admin/UserManagement.css';
import '../../styles/components/admin/ProfessionalVerification.css';

// Import icons from assets
import PlusIcon from '../../assets/icons/appointment_icon.svg';
import SearchIcon from '../../assets/icons/search_icon.svg';
import EditIcon from '../../assets/icons/edit_icon.svg';
import TrashIcon from '../../assets/icons/delete_icon.svg';
import EyeIcon from '../../assets/icons/view_icon.svg';
import DownloadIcon from '../../assets/icons/appointment_icon.svg';
import CheckCircleIcon from '../../assets/icons/view_icon.svg';
import XCircleIcon from '../../assets/icons/DoctorManagement_Icon.svg';

// Tab panel component
function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

// A11y props for tabs
function a11yProps(index) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}

const ProfessionalVerification = () => {
  const navigate = useNavigate();
  
  // State variables
  const [pendingDoctors, setPendingDoctors] = useState([]);
  const [approvedDoctors, setApprovedDoctors] = useState([]);
  const [rejectedDoctors, setRejectedDoctors] = useState([]);
  const [currentDoctor, setCurrentDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    counts: { pendingDoctors: 0, approvedDoctors: 0, rejectedDoctors: 0 }
  });
  
  // Tabs
  const [tabValue, setTabValue] = useState(0);
  
  // Modals
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showAddDoctorModal, setShowAddDoctorModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [approving, setApproving] = useState(false);
  
  // Form fields
  const [verificationStatus, setVerificationStatus] = useState('approved');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [formError, setFormError] = useState('');
  
  // DELETE STATES
  const [doctorToDelete, setDoctorToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  
  // Filters for registered professionals
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [specializationFilter, setSpecializationFilter] = useState('All');
  
  // Pagination
  const [currentTabPage, setCurrentTabPage] = useState(1);
  const [currentApprovedPage, setCurrentApprovedPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [tabTotalPages, setTabTotalPages] = useState(1);
  const [approvedTotalPages, setApprovedTotalPages] = useState(1);
  
  // Available specializations
  const specializations = [
    'Psychiatrist',
    'Psychologist',
    'Mental Health Counselor',
    'Clinical Social Worker',
    'Marriage and Family Therapist',
    'Other'
  ];
  
  // Load data
  useEffect(() => {
    loadData();
  }, [currentTabPage, currentApprovedPage, searchTerm, statusFilter, specializationFilter]);
  
  const loadData = async () => {
    setLoading(true);
    try {
      // Get verification stats
      const statsRes = await adminService.getDoctorVerificationStats();
      setStats(statsRes.data);
      
      // Get pending doctors
      const pendingRes = await adminService.getPendingDoctors({
        page: tabValue === 0 ? currentTabPage : 1,
        limit: itemsPerPage
      });
      setPendingDoctors(pendingRes.data);
      
      if (pendingRes.pagination) {
        setTabTotalPages(pendingRes.pagination.pages);
      }
      
      // Get approved doctors with filters
      const approvedRes = await adminService.getApprovedDoctors({
        page: currentApprovedPage,
        limit: itemsPerPage,
        search: searchTerm || undefined,
        status: statusFilter !== 'All' ? statusFilter.toLowerCase() : undefined,
        specialization: specializationFilter !== 'All' ? specializationFilter : undefined
      });
      setApprovedDoctors(approvedRes.data);
      
      if (approvedRes.pagination) {
        setApprovedTotalPages(approvedRes.pagination.pages);
      }
      
      // Get rejected doctors
      const rejectedRes = await adminService.getRejectedDoctors({
        page: tabValue === 1 ? currentTabPage : 1,
        limit: itemsPerPage
      });
      setRejectedDoctors(rejectedRes.data);
      
      if (rejectedRes.pagination && tabValue === 1) {
        setTabTotalPages(rejectedRes.pagination.pages);
      }
      
    } catch (error) {
      console.error('Error loading verification data:', error);
      
      if (error.response) {
        const status = error.response.status;
        if (status === 401) {
          toast.error('Session expired. Please log in again.');
        } else if (status === 403) {
          toast.error('You do not have permission to access this page.');
        } else {
          toast.error(`Error: ${error.response.data?.message || 'Failed to load verification data'}`);
        }
      } else {
        toast.error('Network error. Please check your connection.');
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    setCurrentTabPage(1);
  };
  
  const viewDoctorDetails = (doctorId, tenantId) => {
    console.log('🔍 Navigating to doctor details:', doctorId);
    navigate(`/admin/professionals/${doctorId}`);
  };

  const handleEditDoctor = (doctorId, tenantId) => {
    console.log('🔧 Navigating to edit doctor:', doctorId);
    navigate(`/admin/professionals/${doctorId}/edit`);
  };
  
  const openVerifyModal = (doctor) => {
    setCurrentDoctor(doctor);
    setVerificationStatus('approved');
    setVerificationNotes('');
    setRejectionReason('');
    setFormError('');
    setShowVerifyModal(true);
  };
  
  const handleVerifyDoctor = async (e) => {
    e.preventDefault();
    setFormError('');
    
    if (verificationStatus === 'rejected' && !rejectionReason.trim()) {
      setFormError('Rejection reason is required');
      return;
    }
    
    setApproving(true);
    
    try {
      const verificationData = {
        verificationStatus,
        verificationNotes,
        rejectionReason: verificationStatus === 'rejected' ? rejectionReason : ''
      };
      
      console.log('Verifying doctor:', {
        doctorId: currentDoctor._id,
        status: verificationStatus,
        tenantId: currentDoctor.tenantId || null
      });
      
      const tenantId = currentDoctor.tenantId || null;
      
      await adminService.verifyDoctor(currentDoctor._id, verificationData, tenantId);
      
      toast.success(`Doctor ${verificationStatus === 'approved' ? 'approved' : 'rejected'} successfully`);
      setShowVerifyModal(false);
      
      loadData();
      
    } catch (error) {
      console.error('Error verifying doctor:', error);
      
      if (error.response) {
        const status = error.response.status;
        if (status === 404) {
          toast.error('Doctor not found. They may have been deleted or moved to a different tenant.');
        } else {
          toast.error(`Failed to update doctor verification status: ${error.response.data?.message || 'Server error'}`);
        }
      } else {
        toast.error('Network error. Please check your connection and try again.');
      }
    } finally {
      setApproving(false);
    }
  };

  // DELETE DOCTOR FUNCTIONS
  const openDeleteModal = (doctor) => {
    console.log('🗑️ Opening delete modal for doctor:', doctor);
    setDoctorToDelete(doctor);
    setShowDeleteModal(true);
  };

  const handleDeleteDoctor = async () => {
    if (!doctorToDelete) return;
    
    setDeleting(true);
    
    try {
      console.log('🗑️ Deleting doctor:', doctorToDelete._id);
      
      await adminService.deleteDoctor(doctorToDelete._id, doctorToDelete.tenantId);
      
      toast.success(`Doctor ${doctorToDelete.firstName} ${doctorToDelete.lastName} deleted successfully`);
      setShowDeleteModal(false);
      setDoctorToDelete(null);
      
      // Refresh the data
      loadData();
      
    } catch (error) {
      console.error('❌ Error deleting doctor:', error);
      
      if (error.response) {
        const status = error.response.status;
        if (status === 404) {
          toast.error('Doctor not found. They may have already been deleted.');
        } else {
          toast.error(`Failed to delete doctor: ${error.response.data?.message || 'Server error'}`);
        }
      } else {
        toast.error('Network error. Please check your connection and try again.');
      }
    } finally {
      setDeleting(false);
    }
  };

  const closeDeleteModal = () => {
    if (!deleting) {
      setShowDeleteModal(false);
      setDoctorToDelete(null);
    }
  };
  
  // Format date to local string
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  
  // Helper function to get status color
  const getStatusColor = (status) => {
    if (!status) return 'default';
    
    const statusLower = String(status).toLowerCase();
    
    switch(statusLower) {
      case 'approved':
        return 'success';
      case 'rejected':
        return 'error';
      case 'pending':
      default:
        return 'warning';
    }
  };
  
  // Helper function to get status display text
  const getStatusDisplayText = (status) => {
    if (!status) return 'PENDING';
    return String(status).toUpperCase();
  };
  
  // Pagination handlers
  const paginateTab = (pageNumber) => {
    setCurrentTabPage(pageNumber);
  };
  
  const paginateApproved = (pageNumber) => {
    setCurrentApprovedPage(pageNumber);
  };
  
  // Handle add new doctor
  const handleAddDoctor = () => {
    console.log('Opening Add Doctor modal');
    setShowAddDoctorModal(true);
  };

  // Handle when a doctor is successfully added
  const handleDoctorAdded = () => {
    console.log('Doctor added successfully, refreshing data...');
    loadData(); // Refresh the data to show the new doctor
  };
  
  if (loading && !pendingDoctors.length && !approvedDoctors.length && !rejectedDoctors.length) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
        <CircularProgress />
        <Typography variant="body1" sx={{ mt: 2 }}>Loading verification data...</Typography>
      </Box>
    );
  }
  
  return (
    <div className="professional-verification">
      <div className="pv-dashboard-header">
        <h1 className="pv-dashboard-title">Doctor Verification Dashboard</h1>
        <p className="pv-dashboard-subtitle">Easily verify, manage, and monitor all mental health professionals in the system.</p>
      </div>

      {/* Doctor Application Under Review Section */}
      <div className="pv-dashboard-section">
        <h2 className="pv-admin-section-title">Doctor Application Under Review</h2>
        
        {/* Tab Navigation */}
        <div className="pv-tab-navigation">
          <button 
            className={`pv-tab-button ${tabValue === 0 ? 'active' : ''}`}
            onClick={(e) => handleTabChange(e, 0)}
          >
            PENDING ({pendingDoctors.length})
          </button>
          <button 
            className={`pv-tab-button ${tabValue === 1 ? 'active' : ''}`}
            onClick={(e) => handleTabChange(e, 1)}
          >
            REJECTED ({rejectedDoctors.length})
          </button>
        </div>
        
        {/* Tab Content */}
        {tabValue === 0 && (
          <div className="pv-tab-content">
            {pendingDoctors.length === 0 ? (
              <div className="pv-no-data-message">
                No pending doctor applications
              </div>
            ) : (
              <div className="pv-custom-table">
                <div className="pv-table-row pv-header-row">
                  <div className="pv-table-cell">Name</div>
                  <div className="pv-table-cell">Email</div>
                  <div className="pv-table-cell">Specialization</div>
                  <div className="pv-table-cell">Registration Date</div>
                  <div className="pv-table-cell">Actions</div>
                </div>
                
                {pendingDoctors.map((doctor, index) => (
                  <div 
                    key={doctor._id} 
                    className={`pv-table-row ${index % 2 === 0 ? 'pv-odd-row' : 'pv-even-row'}`}
                  >
                    <div className="pv-table-cell">
                      <div className="pv-user-name-cell">
                        <div className="pv-user-avatar">
                          {doctor.profilePicture ? (
                            <img src={doctor.profilePicture} alt={`${doctor.firstName} ${doctor.lastName}`} />
                          ) : (
                            <div className="pv-user-initials">
                              {doctor.firstName?.[0]}{doctor.lastName?.[0]}
                            </div>
                          )}
                        </div>
                        <div className="pv-user-info">
                          <div className="pv-user-fullname">
                            {doctor.firstName} {doctor.lastName}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="pv-table-cell">{doctor.email}</div>
                    <div className="pv-table-cell">{doctor.specialization || 'Not specified'}</div>
                    <div className="pv-table-cell">{formatDate(doctor.createdAt)}</div>
                    <div className="pv-table-cell">
                      <div className="pv-action-buttons">
                        <button 
                          className="pv-btn-icon view"
                          onClick={() => viewDoctorDetails(doctor._id, doctor.tenantId)}
                          title="View Doctor Details"
                        >
                          <div className="pv-view-icon"></div>
                        </button>
                        <button 
                          className="pv-btn-icon approve"
                          onClick={() => openVerifyModal(doctor)}
                          title="Verify Doctor"
                        >
                          <div className="pv-approve-icon"></div>
                        </button>
                        <button 
                          className="pv-btn-icon reject"
                          onClick={() => openVerifyModal(doctor)}
                          title="Reject Doctor"
                        >
                          <div className="pv-reject-icon"></div>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {tabTotalPages > 1 && (
              <div className="pv-pagination">
                <button 
                  className="pv-page-nav prev"
                  onClick={() => paginateTab(currentTabPage - 1)}
                  disabled={currentTabPage === 1}
                >
                  &lt;
                </button>
                
                <div className="pv-page-numbers">
                  {[...Array(tabTotalPages)].map((_, index) => (
                    <button
                      key={index}
                      className={`pv-page-number ${currentTabPage === index + 1 ? 'active' : ''}`}
                      onClick={() => paginateTab(index + 1)}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
                
                <button 
                  className="pv-page-nav next"
                  onClick={() => paginateTab(currentTabPage + 1)}
                  disabled={currentTabPage === tabTotalPages}
                >
                  &gt;
                </button>
              </div>
            )}
          </div>
        )}
        
        {tabValue === 1 && (
          <div className="pv-tab-content">
            {rejectedDoctors.length === 0 ? (
              <div className="pv-no-data-message">
                No rejected doctors found
              </div>
            ) : (
              <div className="pv-custom-table">
                <div className="pv-table-row pv-header-row">
                  <div className="pv-table-cell">Name</div>
                  <div className="pv-table-cell">Email</div>
                  <div className="pv-table-cell">Specialization</div>
                  <div className="pv-table-cell">Registration Date</div>
                  <div className="pv-table-cell">Actions</div>
                </div>
                
                {rejectedDoctors.map((doctor, index) => (
                  <div 
                    key={doctor._id} 
                    className={`pv-table-row ${index % 2 === 0 ? 'pv-odd-row' : 'pv-even-row'}`}
                  >
                    <div className="pv-table-cell">
                      <div className="pv-user-name-cell">
                        <div className="pv-user-avatar">
                          {doctor.profilePicture ? (
                            <img src={doctor.profilePicture} alt={`${doctor.firstName} ${doctor.lastName}`} />
                          ) : (
                            <div className="pv-user-initials">
                              {doctor.firstName?.[0]}{doctor.lastName?.[0]}
                            </div>
                          )}
                        </div>
                        <div className="pv-user-info">
                          <div className="pv-user-fullname">
                            {doctor.firstName} {doctor.lastName}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="pv-table-cell">{doctor.email}</div>
                    <div className="pv-table-cell">{doctor.specialization || 'Not specified'}</div>
                    <div className="pv-table-cell">{formatDate(doctor.verificationDate)}</div>
                    <div className="pv-table-cell">
                      <div className="pv-action-buttons">
                        <button 
                          className="pv-btn-icon view"
                          onClick={() => viewDoctorDetails(doctor._id, doctor.tenantId)}
                          title="View Doctor Details"
                        >
                          <div className="pv-view-icon"></div>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {tabTotalPages > 1 && (
              <div className="pv-pagination">
                <button 
                  className="pv-page-nav prev"
                  onClick={() => paginateTab(currentTabPage - 1)}
                  disabled={currentTabPage === 1}
                >
                  &lt;
                </button>
                
                <div className="pv-page-numbers">
                  {[...Array(tabTotalPages)].map((_, index) => (
                    <button
                      key={index}
                      className={`pv-page-number ${currentTabPage === index + 1 ? 'active' : ''}`}
                      onClick={() => paginateTab(index + 1)}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
                
                <button 
                  className="pv-page-nav next"
                  onClick={() => paginateTab(currentTabPage + 1)}
                  disabled={currentTabPage === tabTotalPages}
                >
                  &gt;
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Registered Mental Health Professionals Section */}
      <div className="pv-registered-professionals-section">
        <h2 className="pv-admin-section-title">Registered Mental Health Professionals</h2>
        
        {/* Search and Filter Bar */}
        <div className="pv-admin-actions-bar">
          <div className="pv-top-actions-row">
            <div className="pv-search-box">
              <img src={SearchIcon} alt="Search" className="pv-search-icon" />
              <input 
                type="text" 
                placeholder="Search professionals by name or email" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>
          
            <button className="pv-Add-Patient-Button" onClick={handleAddDoctor}>
              Add a Doctor
            </button>
          </div>
          
          <div className="pv-bottom-actions-row">
            <div className="pv-filter-box">
              <div className="pv-filter-item">
                <label htmlFor="status-filter">Status:</label>
                <select 
                  id="status-filter" 
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="All">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              
              <div className="pv-filter-item">
                <label htmlFor="specialization-filter">Specialization:</label>
                <select 
                  id="specialization-filter" 
                  value={specializationFilter} 
                  onChange={(e) => setSpecializationFilter(e.target.value)}
                >
                  <option value="All">All Specializations</option>
                  {specializations.map(spec => (
                    <option key={spec} value={spec}>{spec}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
        
        {/* Approved Doctors Table */}
        {approvedDoctors.length === 0 ? (
          <div className="pv-no-data-message">
            No approved doctors found
          </div>
        ) : (
          <div className="pv-custom-table">
            <div className="pv-table-row pv-header-row">
              <div className="pv-table-cell">Name</div>
              <div className="pv-table-cell">Email</div>
              <div className="pv-table-cell">Specialization</div>
              <div className="pv-table-cell">Verification Date</div>
              <div className="pv-table-cell">Status</div>
              <div className="pv-table-cell">Actions</div>
            </div>
            
            {approvedDoctors.map((doctor, index) => (
              <div 
                key={doctor._id} 
                className={`pv-table-row ${index % 2 === 0 ? 'pv-odd-row' : 'pv-even-row'}`}
              >
                <div className="pv-table-cell">
                  <div className="pv-user-name-cell">
                    <div className="pv-user-avatar">
                      {doctor.profilePicture ? (
                        <img src={doctor.profilePicture} alt={`${doctor.firstName} ${doctor.lastName}`} />
                      ) : (
                        <div className="pv-user-initials">
                          {doctor.firstName?.[0]}{doctor.lastName?.[0]}
                        </div>
                      )}
                    </div>
                    <div className="pv-user-info">
                      <div className="pv-user-fullname">
                        {doctor.firstName} {doctor.lastName}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="pv-table-cell">{doctor.email}</div>
                <div className="pv-table-cell">{doctor.specialization || 'Not specified'}</div>
                <div className="pv-table-cell">{formatDate(doctor.verificationDate)}</div>
                <div className="pv-table-cell">
                  <span className={`pv-status-badge ${doctor.accountStatus || 'active'}`}>
                    {doctor.accountStatus === 'inactive' ? 'INACTIVE' : 'ACTIVE'}
                  </span>
                </div>
                <div className="pv-table-cell">
                  <div className="pv-action-buttons">
                    <button 
                      className="pv-btn-icon view"
                      onClick={() => viewDoctorDetails(doctor._id, doctor.tenantId)}
                      title="View Doctor Details"
                    >
                      <div className="pv-view-icon"></div>
                    </button>
                    <button 
                      className="pv-btn-icon edit"
                      onClick={() => handleEditDoctor(doctor._id, doctor.tenantId)}
                      title="Edit Doctor"
                    >
                      <div className="pv-edit-icon"></div>
                    </button>
                    <button 
                      className="pv-btn-icon delete"
                      onClick={() => openDeleteModal(doctor)}
                      title="Delete Doctor"
                    >
                      <div className="pv-delete-icon"></div>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {approvedTotalPages > 1 && (
          <div className="pv-pagination">
            <button 
              className="pv-page-nav prev"
              onClick={() => paginateApproved(currentApprovedPage - 1)}
              disabled={currentApprovedPage === 1}
            >
              &lt;
            </button>
            
            <div className="pv-page-numbers">
              {[...Array(approvedTotalPages)].map((_, index) => (
                <button
                  key={index}
                  className={`pv-page-number ${currentApprovedPage === index + 1 ? 'active' : ''}`}
                  onClick={() => paginateApproved(index + 1)}
                >
                  {index + 1}
                </button>
              ))}
            </div>
            
            <button 
              className="pv-page-nav next"
              onClick={() => paginateApproved(currentApprovedPage + 1)}
              disabled={currentApprovedPage === approvedTotalPages}
            >
              &gt;
            </button>
          </div>
        )}
      </div>
      
      {/* Verification Dialog */}
      <Dialog
        open={showVerifyModal}
        onClose={() => !approving && setShowVerifyModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Verify Doctor</DialogTitle>
        <DialogContent>
          {currentDoctor && (
            <Box component="form" noValidate onSubmit={handleVerifyDoctor} sx={{ mt: 1 }}>
              <Typography variant="body1" sx={{ mb: 2 }}>
                You are about to verify: <strong>{currentDoctor.firstName} {currentDoctor.lastName}</strong>
              </Typography>
              
              <FormControl fullWidth margin="normal">
                <InputLabel id="verification-status-label">Verification Status</InputLabel>
                <Select
                  labelId="verification-status-label"
                  id="verification-status"
                  value={verificationStatus}
                  label="Verification Status"
                  onChange={(e) => setVerificationStatus(e.target.value)}
                  required
                  disabled={approving}
                >
                  <MenuItem value="approved">Approve</MenuItem>
                  <MenuItem value="rejected">Reject</MenuItem>
                </Select>
              </FormControl>
              
              <TextField
                margin="normal"
                fullWidth
                id="verification-notes"
                label="Verification Notes (Optional)"
                multiline
                rows={2}
                value={verificationNotes}
                onChange={(e) => setVerificationNotes(e.target.value)}
                placeholder="Add any notes about this verification"
                helperText="These notes are for admin purposes only."
                disabled={approving}
              />
              
              {verificationStatus === 'rejected' && (
                <TextField
                  margin="normal"
                  fullWidth
                  id="rejection-reason"
                  label="Rejection Reason"
                  multiline
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this doctor is being rejected"
                  required={verificationStatus === 'rejected'}
                  error={!!formError}
                  helperText={formError || "This reason will be sent to the doctor."}
                  disabled={approving}
                />
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowVerifyModal(false)} color="inherit" disabled={approving}>
            Cancel
          </Button>
          <Button 
            onClick={handleVerifyDoctor}
            color={verificationStatus === 'approved' ? 'success' : 'error'}
            variant="contained"
            disabled={approving}
            startIcon={
              approving ? <CircularProgress size={20} color="inherit" /> : null
            }
          >
            {approving ? 'Processing...' : verificationStatus === 'approved' ? 'Approve Doctor' : 'Reject Doctor'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteModal}
        onClose={closeDeleteModal}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ textAlign: 'center', color: '#d32f2f' }}>
          DELETE DOCTOR ACCOUNT?
        </DialogTitle>
        <DialogContent>
          {doctorToDelete && (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              {/* Doctor Icon */}
              <Box sx={{ mb: 2 }}>
                <div style={{ 
                  width: '60px', 
                  height: '60px', 
                  margin: '0 auto', 
                  backgroundColor: '#5B8C7E', 
                  borderRadius: '50%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}>
                  <span style={{ color: 'white', fontSize: '24px' }}>👨‍⚕️</span>
                </div>
              </Box>
              
              {/* Doctor Info Box */}
              <Box sx={{ 
                backgroundColor: '#f5f5f5', 
                padding: '16px', 
                borderRadius: '8px', 
                mb: 2 
              }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                  {doctorToDelete.firstName} {doctorToDelete.lastName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {doctorToDelete.email}
                </Typography>
              </Box>
              
              <Typography variant="body1" color="text.secondary">
                Deleting this account is permanent. The professional will lose all access to patient data and records.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', gap: 2, pb: 3 }}>
          <Button 
            onClick={closeDeleteModal} 
            variant="outlined"
            color="inherit"
            disabled={deleting}
            sx={{ 
              minWidth: '120px',
              color: '#666',
              borderColor: '#ddd',
              '&:hover': {
                borderColor: '#999',
                backgroundColor: '#f5f5f5'
              }
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteDoctor}
            variant="contained"
            color="error"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={20} color="inherit" /> : null}
            sx={{ 
              minWidth: '120px',
              backgroundColor: '#ff6b6b',
              '&:hover': {
                backgroundColor: '#ff5252'
              }
            }}
          >
            {deleting ? 'Deleting...' : 'Yes, Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Doctor Modal */}
      <AddDoctorModal
        isOpen={showAddDoctorModal}
        onClose={() => setShowAddDoctorModal(false)}
        onDoctorAdded={handleDoctorAdded}
      />
    </div>
  );
};

export default ProfessionalVerification;