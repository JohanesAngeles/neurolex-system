// client/src/components/admin/DoctorDetailsModal.jsx - SIMPLE VERSION LIKE WORKING PAGE
import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import adminService from '../../services/adminService';
import '../../styles/components/admin/DoctorDetailsModal.css';

const DoctorDetailsModal = ({ doctorId, isOpen, onClose, onApprove, onReject }) => {
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && doctorId) {
      fetchDoctorDetails();
    }
  }, [isOpen, doctorId]);

  const fetchDoctorDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // ✅ EXACTLY like the working DoctorVerification page
      const response = await adminService.getDoctorDetails(doctorId);
      setDoctor(response.data);
    } catch (err) {
      setError('Failed to load doctor details. Please try again.');
      console.error('Error fetching doctor:', err);
    } finally {
      setLoading(false);
    }
  };

  // ✅ EXACTLY like the working DoctorVerification page - simple approve
  const handleApprove = async () => {
    try {
      setSubmitting(true);
      
      // ✅ EXACTLY like the working page
      await adminService.verifyDoctor(doctorId, {
        verificationStatus: 'approved',
        verificationNotes: 'Approved from doctor details modal'
      });
      
      toast.success('Doctor approved successfully!');
      
      // Call parent callback and close modal
      onApprove?.(doctorId);
      onClose();
    } catch (err) {
      console.error('Verification error:', err);
      const errorMessage = err.response?.data?.message || 'Verification process failed. Please try again.';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // ✅ EXACTLY like the working DoctorVerification page - simple reject
  const handleReject = async () => {
    try {
      setSubmitting(true);
      
      // ✅ EXACTLY like the working page
      await adminService.verifyDoctor(doctorId, {
        verificationStatus: 'rejected',
        rejectionReason: 'Application rejected after review'
      });
      
      toast.success('Doctor rejected successfully!');
      
      // Call parent callback and close modal
      onReject?.(doctorId);
      onClose();
    } catch (err) {
      console.error('Verification error:', err);
      const errorMessage = err.response?.data?.message || 'Verification process failed. Please try again.';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not provided';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return 'Invalid date';
    }
  };

  const renderDocumentLink = (url, label) => {
    if (!url) return <span className="no-document">Not provided</span>;
    
    return (
      <a 
        href={url} 
        target="_blank" 
        rel="noopener noreferrer" 
        className="document-link"
      >
        View {label}
      </a>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="doctor-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <h2 className="modal-title">Doctor Application Review</h2>
          <button className="modal-close" onClick={onClose}>
            <span className="close-icon">×</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="modal-content">
          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Loading doctor details...</p>
            </div>
          ) : error ? (
            <div className="error-container">
              <p className="error-message">{error}</p>
              <button className="retry-button" onClick={fetchDoctorDetails}>
                Retry
              </button>
            </div>
          ) : doctor ? (
            <div className="doctor-details">
              {/* ✅ EXACTLY like the working DoctorVerification page */}
              <div className="details-section">
                <h3 className="section-title">Professional Information</h3>
                
                <div className="profile-image">
                  {doctor.profilePhotoUrl ? (
                    <img src={doctor.profilePhotoUrl} alt={`${doctor.firstName} ${doctor.lastName}`} />
                  ) : (
                    <div className="no-profile-image">No profile image</div>
                  )}
                </div>
                
                <div className="professional-details">
                  <div className="detail-item">
                    <span className="label">Full Name:</span>
                    <span className="value">{doctor.title} {doctor.firstName} {doctor.lastName}</span>
                  </div>
                  
                  <div className="detail-item">
                    <span className="label">Email:</span>
                    <span className="value">{doctor.email}</span>
                  </div>
                  
                  <div className="detail-item">
                    <span className="label">Specialization:</span>
                    <span className="value">{doctor.specialization || doctor.specialty || 'Not specified'}</span>
                  </div>
                  
                  <div className="detail-item">
                    <span className="label">Years of Experience:</span>
                    <span className="value">{doctor.yearsOfExperience || 'Not specified'}</span>
                  </div>
                  
                  <div className="detail-item">
                    <span className="label">Practice Address:</span>
                    <span className="value">{doctor.practiceAddress || doctor.clinicLocation || 'Not provided'}</span>
                  </div>
                  
                  <div className="detail-item">
                    <span className="label">Languages:</span>
                    <span className="value">{doctor.languages && doctor.languages.length > 0 ? doctor.languages.join(', ') : 'Not specified'}</span>
                  </div>
                  
                  <div className="detail-item">
                    <span className="label">Consultation Fee:</span>
                    <span className="value">{doctor.consultationFee ? `$${doctor.consultationFee}` : 'Not specified'}</span>
                  </div>
                  
                  <div className="detail-item">
                    <span className="label">Consultation Options:</span>
                    <span className="value">
                      {(doctor.telehealth || doctor.inPerson) ? (
                        <>
                          {doctor.telehealth && 'Telehealth'}
                          {doctor.telehealth && doctor.inPerson && ' & '}
                          {doctor.inPerson && 'In-Person'}
                        </>
                      ) : 'Not specified'}
                    </span>
                  </div>
                </div>
                
                <div className="license-details">
                  <h4>License Information</h4>
                  
                  <div className="detail-item">
                    <span className="label">License Number:</span>
                    <span className="value">{doctor.licenseNumber || 'Not provided'}</span>
                  </div>
                  
                  <div className="detail-item">
                    <span className="label">Issuing Authority:</span>
                    <span className="value">{doctor.licenseIssuingAuthority || 'Not provided'}</span>
                  </div>
                  
                  <div className="detail-item">
                    <span className="label">Expiry Date:</span>
                    <span className="value">{doctor.licenseExpiryDate ? formatDate(doctor.licenseExpiryDate) : 'Not provided'}</span>
                  </div>
                  
                  <div className="license-document">
                    <h5>License Document</h5>
                    {doctor.licenseDocumentUrl ? (
                      <div className="document-preview">
                        <a href={doctor.licenseDocumentUrl} target="_blank" rel="noopener noreferrer" className="preview-button">
                          View License Document
                        </a>
                      </div>
                    ) : (
                      <div className="no-document">No license document provided</div>
                    )}
                  </div>
                </div>
                
                <div className="professional-bio">
                  <h4>Professional Bio</h4>
                  <p>{doctor.bio || 'No bio provided'}</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Modal Footer - ✅ SIMPLE like the working page */}
        <div className="modal-footer">
          <button 
            className="modal-button secondary" 
            onClick={onClose}
            disabled={submitting}
          >
            Close
          </button>
          <div className="action-buttons">
            <button 
              className="modal-button reject" 
              onClick={handleReject}
              disabled={submitting}
            >
              {submitting ? 'Processing...' : 'Reject'}
            </button>
            <button 
              className="modal-button approve" 
              onClick={handleApprove}
              disabled={submitting}
            >
              {submitting ? 'Processing...' : 'Accept'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorDetailsModal;