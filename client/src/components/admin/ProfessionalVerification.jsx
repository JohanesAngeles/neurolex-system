import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Tab, Tabs, Box, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Select, MenuItem, FormControl, InputLabel, FormHelperText, CircularProgress,
  Pagination, Stack, Alert, Typography
} from '@mui/material';
import { toast } from 'react-toastify';
import adminService from '../../services/adminService';
import AddDoctorModal from './AddDoctorModal'; // 🆕 NEW IMPORT
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
  const [showAddDoctorModal, setShowAddDoctorModal] = useState(false); // 🆕 NEW STATE
  const [approving, setApproving] = useState(false);
  
  // Form fields
  const [verificationStatus, setVerificationStatus] = useState('approved');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [formError, setFormError] = useState('');
  
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
  
  // 🆕 UPDATED: Handle add new doctor
  const handleAddDoctor = () => {
    console.log('Opening Add Doctor modal');
    setShowAddDoctorModal(true);
  };

  // 🆕 NEW: Handle when a doctor is successfully added
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
    <div className="admin-content">
      <div className="user-management-header">
        <h1>Doctor Verification Dashboard</h1>
        <p>Easily verify, manage, and monitor all mental health professionals in the system.</p>
      </div>

      {/* MUI Tab Panel */}
      <Box sx={{ width: '100%', mb: 4 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange}
            aria-label="doctor verification tabs"
            sx={{
              '& .MuiTab-root': {
                textTransform: 'uppercase',
                fontFamily: '"IBM Plex Mono", monospace',
                fontWeight: 600,
                fontSize: '14px',
                color: '#6C6C6C',
                padding: '8px 16px',
                minWidth: 'auto',
                marginRight: '20px'
              },
              '& .Mui-selected': {
                color: '#5B8C7E',
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#5B8C7E',
                height: '2px'
              }
            }}
          >
            <Tab label={`Pending (${pendingDoctors.length})`} {...a11yProps(0)} />
            <Tab label={`Rejected (${rejectedDoctors.length})`} {...a11yProps(1)} />
          </Tabs>
        </Box>
        
        {/* Pending Tab Panel */}
        <TabPanel value={tabValue} index={0}>
          {pendingDoctors.length === 0 ? (
            <Alert severity="info" sx={{ my: 2 }}>
              No pending verifications at this time
            </Alert>
          ) : (
            <div className="table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Specialization</th>
                    <th>Registration Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingDoctors.map(doctor => (
                    <tr key={doctor._id}>
                      <td data-label="Name">
                        <div className="user-name-cell">
                          <div className="user-avatar">
                            {doctor.profilePicture ? (
                              <img src={doctor.profilePicture} alt={`${doctor.firstName} ${doctor.lastName}`} />
                            ) : (
                              <div className="user-initials">
                                {doctor.firstName?.[0]}{doctor.lastName?.[0]}
                              </div>
                            )}
                          </div>
                          <div className="user-info">
                            <div className="user-fullname">
                              {doctor.firstName} {doctor.lastName}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td data-label="Email">{doctor.email}</td>
                      <td data-label="Specialization">{doctor.specialization || 'Not specified'}</td>
                      <td data-label="Registration Date">{formatDate(doctor.createdAt)}</td>
                      <td data-label="Actions">
                        <div className="action-icons">
                          <img 
                            src={EyeIcon} 
                            className="action-icon view" 
                            onClick={() => viewDoctorDetails(doctor._id, doctor.tenantId)} 
                            title="View Doctor" 
                            alt="View"
                          />
                          <img 
                            src={CheckCircleIcon} 
                            className="action-icon edit" 
                            onClick={() => openVerifyModal(doctor)} 
                            title="Verify Doctor" 
                            alt="Verify"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {tabTotalPages > 1 && (
            <Stack spacing={2} sx={{ mt: 3, display: 'flex', alignItems: 'center' }}>
              <Pagination 
                count={tabTotalPages} 
                page={currentTabPage} 
                onChange={(e, page) => paginateTab(page)}
                color="primary"
              />
            </Stack>
          )}
        </TabPanel>
        
        {/* Rejected Tab Panel */}
        <TabPanel value={tabValue} index={1}>
          {rejectedDoctors.length === 0 ? (
            <Alert severity="info" sx={{ my: 2 }}>
              No rejected doctors found
            </Alert>
          ) : (
            <div className="table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Specialization</th>
                    <th>Rejection Date</th>
                    <th>Reason</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rejectedDoctors.map(doctor => (
                    <tr key={doctor._id}>
                      <td data-label="Name">
                        <div className="user-name-cell">
                          <div className="user-avatar">
                            {doctor.profilePicture ? (
                              <img src={doctor.profilePicture} alt={`${doctor.firstName} ${doctor.lastName}`} />
                            ) : (
                              <div className="user-initials">
                                {doctor.firstName?.[0]}{doctor.lastName?.[0]}
                              </div>
                            )}
                          </div>
                          <div className="user-info">
                            <div className="user-fullname">
                              {doctor.firstName} {doctor.lastName}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td data-label="Email">{doctor.email}</td>
                      <td data-label="Specialization">{doctor.specialization || 'Not specified'}</td>
                      <td data-label="Rejection Date">{formatDate(doctor.verificationDate)}</td>
                      <td data-label="Reason">{doctor.rejectionReason || 'Not specified'}</td>
                      <td data-label="Actions">
                        <div className="action-icons">
                          <img 
                            src={EyeIcon} 
                            className="action-icon view" 
                            onClick={() => viewDoctorDetails(doctor._id, doctor.tenantId)} 
                            title="View Doctor" 
                            alt="View"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {tabTotalPages > 1 && (
            <Stack spacing={2} sx={{ mt: 3, display: 'flex', alignItems: 'center' }}>
              <Pagination 
                count={tabTotalPages} 
                page={currentTabPage} 
                onChange={(e, page) => paginateTab(page)}
                color="primary"
              />
            </Stack>
          )}
        </TabPanel>
      </Box>
      
      {/* Registered Mental Health Professionals Section */}
      <div className="registered-professionals-section">
        <h2 className="section-title">Registered Mental Health Professionals</h2>
        
        {/* Search and Filter Bar */}
        <div className="admin-actions-bar">
          <div className="top-actions-row">
            <div className="search-box">
              <img src={SearchIcon} alt="Search" className="search-icon" />
              <input 
                type="text" 
                placeholder="Search professionals by name or email" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>
          
            <button className="Add-Patient-Button" onClick={handleAddDoctor}>
              Add a Doctor
            </button>
          </div>
          
          <div className="bottom-actions-row">
            <div className="filter-box">
              <div className="filter-item">
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
              
              <div className="filter-item">
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
          <Alert severity="info" sx={{ my: 2 }}>
            No approved doctors found
          </Alert>
        ) : (
          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Specialization</th>
                  <th>Verification Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {approvedDoctors.map(doctor => (
                  <tr key={doctor._id}>
                    <td data-label="Name">
                      <div className="user-name-cell">
                        <div className="user-avatar">
                          {doctor.profilePicture ? (
                            <img src={doctor.profilePicture} alt={`${doctor.firstName} ${doctor.lastName}`} />
                          ) : (
                            <div className="user-initials">
                              {doctor.firstName?.[0]}{doctor.lastName?.[0]}
                            </div>
                          )}
                        </div>
                        <div className="user-info">
                          <div className="user-fullname">
                            {doctor.firstName} {doctor.lastName}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td data-label="Email">{doctor.email}</td>
                    <td data-label="Specialization">{doctor.specialization || 'Not specified'}</td>
                    <td data-label="Verification Date">{formatDate(doctor.verificationDate)}</td>
                    <td data-label="Status">
                      <span className={`status-badge ${doctor.accountStatus || 'active'}`}>
                        {doctor.accountStatus === 'inactive' ? (
                          <>
                            <img src={XCircleIcon} alt="Inactive" className="status-icon" /> Inactive
                          </>
                        ) : (
                          <>
                            <img src={CheckCircleIcon} alt="Active" className="status-icon" /> Active
                          </>
                        )}
                      </span>
                    </td>
                    <td data-label="Actions">
                      <div className="action-icons">
                        <img 
                          src={EyeIcon} 
                          className="action-icon view" 
                          onClick={() => viewDoctorDetails(doctor._id, doctor.tenantId)} 
                          title="View Doctor" 
                          alt="View"
                        />
                        <img 
                          src={EditIcon} 
                          className="action-icon edit" 
                          onClick={() => handleEditDoctor(doctor._id, doctor.tenantId)}
                          title="Edit Doctor" 
                          alt="Edit"
                          style={{ cursor: 'pointer' }}
                        />
                        <img 
                          src={TrashIcon} 
                          className="action-icon delete" 
                          title="Delete Doctor" 
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
        
        {approvedTotalPages > 1 && (
          <Stack spacing={2} sx={{ mt: 3, display: 'flex', alignItems: 'center' }}>
            <Pagination 
              count={approvedTotalPages} 
              page={currentApprovedPage} 
              onChange={(e, page) => paginateApproved(page)}
              color="primary"
            />
          </Stack>
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

      {/* 🆕 Add Doctor Modal */}
      <AddDoctorModal
        isOpen={showAddDoctorModal}
        onClose={() => setShowAddDoctorModal(false)}
        onDoctorAdded={handleDoctorAdded}
      />
    </div>
  );
};

export default ProfessionalVerification;