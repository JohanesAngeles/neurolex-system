// client/src/components/admin/AdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '../../context/AdminContext';
import adminService from '../../services/adminService';
import { toast } from 'react-toastify';
import '../../styles/components/admin/AdminDashboard.css';

const AdminDashboard = () => {
  // Add navigate for redirection
  const navigate = useNavigate();
  
  // Context and state
  const adminContext = useAdmin();
  const dashboardData = adminContext?.dashboardData || {
    totalUsers: 0,
    totalProfessionals: 2,
    pendingVerifications: 1,
    journalEntries: 234,
  };
  
  const [pendingDoctors, setPendingDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;
  
  // Fetch pending doctors
  useEffect(() => {
    const fetchPendingDoctors = async () => {
      try {
        setLoading(true);
        const response = await adminService.getPendingDoctors();
        
        if (response && response.data) {
          setPendingDoctors(response.data);
        } else if (response && Array.isArray(response)) {
          setPendingDoctors(response);
        } else {
          setPendingDoctors([]);
        }
      } catch (error) {
        console.error('Error fetching pending doctors:', error);
        toast.error('Failed to load doctor applications');
      } finally {
        setLoading(false);
      }
    };
    
    fetchPendingDoctors();
  }, []);
  
  // Handle admin logout with improved logout function
  const handleAdminLogout = () => {
    // First clear all tokens
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    localStorage.removeItem('adminTokenExpiry');
    
    // Also clear any regular user tokens to prevent confusion
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('tokenExpiry');
    
    // Show success message
    toast.success('Logged out successfully');
    
    // Primary method: Use React Router navigation
    navigate('/admin/login');
    
    // Fallback method: Use direct URL navigation with a slight delay
    // This ensures we get to the login page even if there are issues with React Router
    setTimeout(() => {
      if (window.location.pathname.includes('/admin') && 
          !window.location.pathname.includes('/login')) {
        window.location.href = '/admin/login';
      }
    }, 100);
  };
  
  // Action handlers
  const handleViewDoctor = (id) => {
    navigate(`/admin/professionals?doctorId=${id}`);
  };
  
  const handleApproveDoctor = async (id) => {
    try {
      await adminService.verifyDoctor(id, { 
        verificationStatus: 'approved',
        verificationNotes: 'Approved from dashboard'
      });
      
      toast.success('Doctor approved successfully');
      setPendingDoctors(prevDoctors => prevDoctors.filter(doctor => doctor._id !== id));
    } catch (error) {
      console.error('Error approving doctor:', error);
      toast.error('Failed to approve doctor');
    }
  };
  
  const handleRejectDoctor = async (id) => {
    try {
      await adminService.verifyDoctor(id, { 
        verificationStatus: 'rejected',
        rejectionReason: 'Application rejected by admin'
      });
      
      toast.success('Doctor rejected successfully');
      setPendingDoctors(prevDoctors => prevDoctors.filter(doctor => doctor._id !== id));
    } catch (error) {
      console.error('Error rejecting doctor:', error);
      toast.error('Failed to reject doctor');
    }
  };
  
  // Helper functions
  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return 'Invalid date';
    }
  };
  
  // Pagination
  const indexOfLastDoctor = currentPage * rowsPerPage;
  const indexOfFirstDoctor = indexOfLastDoctor - rowsPerPage;
  const currentDoctors = pendingDoctors.slice(indexOfFirstDoctor, indexOfLastDoctor);
  
  const totalPages = Math.ceil(pendingDoctors.length / rowsPerPage);
  
  const paginate = (pageNumber) => setCurrentPage(pageNumber);
  
  return (
    <div className="dashboard">
      {/* Add a header with title and logout button */}
      <div className="dashboard-header">
        <h1 className="dashboard-title">Dashboard</h1>
        <button onClick={handleAdminLogout} className="logout-button">Logout</button>
      </div>
      
      {/* Stats cards */}
      <div className="stats-container">
        <div className="stat-card">
          <p className="stat-label">Total Users</p>
          <div className="stat-value-container">
            <h2 className="stat-value">{dashboardData.totalUsers}</h2>
          </div>
        </div>
        
        <div className="stat-card">
          <p className="stat-label">Total Professionals</p>
          <div className="stat-value-container">
            <h2 className="stat-value">{dashboardData.totalProfessionals}</h2>
          </div>
        </div>
        
        <div className="stat-card">
          <p className="stat-label">Pending Verifications</p>
          <div className="stat-value-container">
            <h2 className="stat-value">{pendingDoctors.length || dashboardData.pendingVerifications}</h2>
          </div>
        </div>
        
        <div className="stat-card">
          <p className="stat-label">Journal Entries Logged</p>
          <div className="stat-value-container">
            <h2 className="stat-value">{dashboardData.journalEntries}</h2>
          </div>
        </div>
      </div>
      
      {/* Divider */}
      <div className="admin-dashboard-divider"></div>
      
      {/* Doctor Applications */}
      <div className="dashboard-section">
        <h2 className="admin-section-title">Doctor Application Under Review</h2>
        
        {/* Custom Table with DIVs instead of TABLE elements */}
        <div className="custom-table">
          {/* Table Header */}
          <div className="table-row header-row">
            <div className="table-cell">Name</div>
            <div className="table-cell">Email</div>
            <div className="table-cell">Specialization</div>
            <div className="table-cell">Registration Date</div>
            <div className="table-cell">Actions</div>
          </div>
          
          {/* Table Body */}
          {loading ? (
            <div className="table-row loading-row">
              <div className="table-cell" style={{ gridColumn: '1 / -1' }}>
                <div className="loading-spinner"></div>
              </div>
            </div>
          ) : currentDoctors.length === 0 ? (
            <div className="table-row empty-row">
              <div className="table-cell" style={{ gridColumn: '1 / -1' }}>
                <p className="no-data">No pending doctor applications</p>
              </div>
            </div>
          ) : (
            currentDoctors.map((doctor, index) => (
              <div 
                key={doctor._id} 
                className={`table-row ${index % 2 === 0 ? 'odd-row' : 'even-row'}`}
              >
                <div className="table-cell">{doctor.firstName} {doctor.lastName}</div>
                <div className="table-cell">{doctor.email}</div>
                <div className="table-cell">{doctor.specialization || 'Not specified'}</div>
                <div className="table-cell">{formatDate(doctor.createdAt)}</div>
                <div className="table-cell">
                  <div className="action-buttons">
                    <button 
                      className="btn-icon view"
                      onClick={() => handleViewDoctor(doctor._id)}
                      title="View"
                    >
                      <i className="icon-view"></i>
                    </button>
                    <button 
                      className="btn-icon approve"
                      onClick={() => handleApproveDoctor(doctor._id)}
                      title="Approve"
                    >
                      <i className="icon-approve"></i>
                    </button>
                    <button 
                      className="btn-icon reject"
                      onClick={() => handleRejectDoctor(doctor._id)}
                      title="Reject"
                    >
                      <i className="icon-reject"></i>
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
        
        {pendingDoctors.length > 0 && (
          <div className="view-all">
            <a href="/admin/professionals" className="view-all-link">View All Applications</a>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;