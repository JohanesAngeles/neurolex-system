// client/src/components/admin/AdminDashboard.jsx - SIMPLE VERSION LIKE WORKING PAGE
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import DoctorDetailsModal from './DoctorDetailsModal';
import adminService from '../../services/adminService';
import '../../styles/components/admin/AdminDashboard.css';

const AdminDashboard = () => {
  const navigate = useNavigate();
  
  const [dashboardData, setDashboardData] = useState({
    totalUsers: 0,
    totalProfessionals: 0,
    pendingVerifications: 0,
    journalEntries: 0,
  });
  
  const [pendingDoctors, setPendingDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;
  
  // Modal state
  const [selectedDoctorId, setSelectedDoctorId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // ✅ EXACTLY like the working DoctorVerification page
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const adminToken = localStorage.getItem('adminToken');
        if (!adminToken) {
          navigate('/admin/login');
          return;
        }
        
        const response = await adminService.getDashboardData();
        
        if (response.success) {
          setDashboardData({
            totalUsers: response.totalUsers || 0,
            totalProfessionals: response.totalProfessionals || 0,
            pendingVerifications: response.pendingVerifications || 0,
            journalEntries: response.totalJournalEntries || response.journalEntries || 0,
          });
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        if (error.response?.status === 401) {
          navigate('/admin/login');
        }
      }
    };
    
    fetchDashboardData();
  }, [navigate]);
  
  // ✅ EXACTLY like the working DoctorVerification page
  useEffect(() => {
    const fetchPendingDoctors = async () => {
      try {
        setLoading(true);
        const adminToken = localStorage.getItem('adminToken');
        if (!adminToken) {
          navigate('/admin/login');
          return;
        }
        
        const response = await adminService.getPendingDoctors();
        
        if (response.success && response.data) {
          setPendingDoctors(response.data);
          setDashboardData(prev => ({
            ...prev,
            pendingVerifications: response.data.length
          }));
        } else if (response.data && Array.isArray(response.data)) {
          setPendingDoctors(response.data);
        } else {
          setPendingDoctors([]);
        }
      } catch (error) {
        console.error('Error fetching pending doctors:', error);
        if (error.response?.status === 401) {
          navigate('/admin/login');
        } else {
          toast.error('Failed to load doctor applications');
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchPendingDoctors();
  }, [navigate]);
  
  const handleAdminLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    localStorage.removeItem('adminTokenExpiry');
    toast.success('Logged out successfully');
    navigate('/admin/login');
  };
  
  // Modal handlers
  const handleViewDoctor = (id) => {
    setSelectedDoctorId(id);
    setIsModalOpen(true);
  };
  
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedDoctorId(null);
  };
  
  // ✅ These functions ONLY update UI - no API calls (modal handles that)
  const handleModalApprove = (doctorId) => {
    setPendingDoctors(prevDoctors => prevDoctors.filter(doctor => doctor._id !== doctorId));
    setDashboardData(prev => ({
      ...prev,
      pendingVerifications: Math.max(0, prev.pendingVerifications - 1)
    }));
  };
  
  const handleModalReject = (doctorId) => {
    setPendingDoctors(prevDoctors => prevDoctors.filter(doctor => doctor._id !== doctorId));
    setDashboardData(prev => ({
      ...prev,
      pendingVerifications: Math.max(0, prev.pendingVerifications - 1)
    }));
  };
  
  // ✅ EXACTLY like the working DoctorVerification page - simple direct calls
  const handleApproveDoctor = async (id) => {
    try {
      // ✅ EXACTLY like the working page
      await adminService.verifyDoctor(id, {
        verificationStatus: 'approved',
        verificationNotes: 'Approved from dashboard'
      });
      
      toast.success('Doctor approved successfully!');
      setPendingDoctors(prevDoctors => prevDoctors.filter(doctor => doctor._id !== id));
      setDashboardData(prev => ({
        ...prev,
        pendingVerifications: Math.max(0, prev.pendingVerifications - 1)
      }));
    } catch (err) {
      console.error('Verification error:', err);
      const errorMessage = err.response?.data?.message || 'Verification process failed. Please try again.';
      toast.error(errorMessage);
    }
  };

  const handleRejectDoctor = async (id) => {
    try {
      // ✅ EXACTLY like the working page
      await adminService.verifyDoctor(id, {
        verificationStatus: 'rejected',
        rejectionReason: 'Application rejected by admin'
      });
      
      toast.success('Doctor rejected successfully!');
      setPendingDoctors(prevDoctors => prevDoctors.filter(doctor => doctor._id !== id));
      setDashboardData(prev => ({
        ...prev,
        pendingVerifications: Math.max(0, prev.pendingVerifications - 1)
      }));
    } catch (err) {
      console.error('Verification error:', err);
      const errorMessage = err.response?.data?.message || 'Verification process failed. Please try again.';
      toast.error(errorMessage);
    }
  };
  
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
      {/* Dashboard header */}
      <div className="dashboard-header">
        <h1 className="dashboard-title">Admin Dashboard</h1>
        <button onClick={handleAdminLogout} className="logout-button">
          Logout
        </button>
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
            <h2 className="stat-value">{dashboardData.pendingVerifications}</h2>
          </div>
        </div>
        
        <div className="stat-card">
          <p className="stat-label">Journal Entries</p>
          <div className="stat-value-container">
            <h2 className="stat-value">{dashboardData.journalEntries}</h2>
          </div>
        </div>
      </div>
      
      {/* Divider */}
      <div className="admin-dashboard-divider"></div>
      
      {/* Doctor Applications */}
      <div className="dashboard-section">
        <h2 className="admin-section-title">Doctor Applications Under Review</h2>
        
        {/* Custom Table */}
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
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <span>Loading doctor applications...</span>
                </div>
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
                <div className="table-cell">
                  {doctor.firstName} {doctor.lastName}
                  {doctor.tenantName && (
                    <div className="tenant-info">
                      <small>({doctor.tenantName})</small>
                    </div>
                  )}
                </div>
                <div className="table-cell">{doctor.email}</div>
                <div className="table-cell">{doctor.specialization || doctor.specialty || 'Not specified'}</div>
                <div className="table-cell">{formatDate(doctor.createdAt)}</div>
                <div className="table-cell">
                  <div className="action-buttons">
                    <button 
                      className="btn-action view"
                      onClick={() => handleViewDoctor(doctor._id)}
                      title="View Details"
                    >
                      View
                    </button>
                    <button 
                      className="btn-action approve"
                      onClick={() => handleApproveDoctor(doctor._id)}
                      title="Approve Application"
                    >
                      Approve
                    </button>
                    <button 
                      className="btn-action reject"
                      onClick={() => handleRejectDoctor(doctor._id)}
                      title="Reject Application"
                    >
                      Reject
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
            <button 
              onClick={() => navigate('/admin/professionals')}
              className="view-all-link"
            >
              View All Applications
            </button>
          </div>
        )}
      </div>

      {/* Doctor Details Modal */}
      <DoctorDetailsModal
        doctorId={selectedDoctorId}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onApprove={handleModalApprove}
        onReject={handleModalReject}
      />
    </div>
  );
};

export default AdminDashboard;