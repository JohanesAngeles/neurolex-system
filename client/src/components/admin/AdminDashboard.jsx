// client/src/components/admin/DoctorDetailsModal.jsx - FINAL FIX
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import adminService from '../../services/adminService';
import '../../styles/components/admin/DoctorDetailsModal.css';

const DoctorDetailsModal = ({ doctorId, isOpen, onClose, onApprove, onReject }) => {
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processingAction, setProcessingAction] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen && doctorId) {
      setDoctor(null);
      setError(null);
      setProcessingAction(false);
      fetchDoctorDetails();
    } else {
      // Reset everything when modal closes
      setDoctor(null);
      setError(null);
      setProcessingAction(false);
      setLoading(true);
    }
  }, [isOpen, doctorId]);

  const fetchDoctorDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching doctor details for:', doctorId);
      
      const response = await adminService.getDoctorDetails(doctorId);
      
      console.log('Doctor details response:', response);
      
      if (response.success) {
        setDoctor(response.data);
      } else if (response.data) {
        setDoctor(response.data);
      } else {
        throw new Error(response.message || 'Failed to fetch doctor details');
      }
    } catch (error) {
      console.error('Error fetching doctor details:', error);
      setError(error.response?.data?.message || error.message || 'Failed to load doctor details');
      toast.error('Failed to load doctor details');
    } finally {
      setLoading(false);
    }
  };

  // Use useCallback to prevent function recreation
  const handleApprove = useCallback(async () => {
    // Prevent duplicate calls
    if (processingAction) {
      console.log('Already processing approve, ignoring duplicate call');
      return;
    }

    try {
      console.log('🔍 Modal handleApprove started for doctor:', doctorId);
      
      setProcessingAction(true);
      
      const verificationData = {
        verificationStatus: 'approved',
        verificationNotes: 'Approved from doctor details modal'
      };
      
      console.log('Calling adminService.verifyDoctor with:', verificationData);
      
      const result = await adminService.verifyDoctor(doctorId, verificationData);
      
      console.log('✅ AdminService response:', result);

      toast.success('Doctor approved successfully');
      
      // Call the callback to update the parent component
      if (onApprove) {
        onApprove(doctorId);
      }
      
      // Close the modal
      onClose();
    } catch (error) {
      console.error('❌ Error in modal handleApprove:', error);
      
      const errorMessage = error.response?.data?.message || error.message || 'Failed to approve doctor';
      toast.error(errorMessage);
    } finally {
      setProcessingAction(false);
    }
  }, [doctorId, processingAction, onApprove, onClose]);

  const handleReject = useCallback(async () => {
    // Prevent duplicate calls
    if (processingAction) {
      console.log('Already processing reject, ignoring duplicate call');
      return;
    }

    try {
      console.log('🔍 Modal handleReject started for doctor:', doctorId);
      
      setProcessingAction(true);
      
      const verificationData = {
        verificationStatus: 'rejected',
        rejectionReason: 'Application rejected after review'
      };
      
      console.log('Calling adminService.verifyDoctor with:', verificationData);
      
      const result = await adminService.verifyDoctor(doctorId, verificationData);
      
      console.log('✅ AdminService response:', result);

      toast.success('Doctor application rejected');
      
      // Call the callback to update the parent component
      if (onReject) {
        onReject(doctorId);
      }
      
      // Close the modal
      onClose();
    } catch (error) {
      console.error('❌ Error in modal handleReject:', error);
      
      const errorMessage = error.response?.data?.message || error.message || 'Failed to reject doctor application';
      toast.error(errorMessage);
    } finally {
      setProcessingAction(false);
    }
  }, [doctorId, processingAction, onReject, onClose]);

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

  const formatAvailability = (availability) => {
    if (!availability) return 'Not specified';
    
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const availableDays = days.filter(day => availability[day]?.available);
    
    if (availableDays.length === 0) return 'No availability set';
    
    return availableDays.map(day => 
      day.charAt(0).toUpperCase() + day.slice(1)
    ).join(', ');
  };

  const renderAvailabilitySchedule = (availability) => {
    if (!availability) return <p className="no-data">No availability information provided</p>;
    
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const dayLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    const availableDays = days.filter(day => availability[day]?.available);
    
    if (availableDays.length === 0) {
      return <p className="no-data">No available days set</p>;
    }
    
    return (
      <div className="availability-schedule">
        {days.map((day, index) => {
          const dayData = availability[day];
          if (!dayData?.available) return null;
          
          return (
            <div key={day} className="availability-day">
              <div className="day-name">{dayLabels[index]}</div>
              <div className="time-slots">
                {dayData.slots && dayData.slots.length > 0 ? (
                  dayData.slots.map((slot, slotIndex) => (
                    <div key={slotIndex} className="time-slot">
                      <span className="start-time">{slot.startTime || 'Not set'}</span>
                      <span className="time-separator">-</span>
                      <span className="end-time">{slot.endTime || 'Not set'}</span>
                    </div>
                  ))
                ) : (
                  <div className="time-slot">
                    <span className="no-times">No specific times set</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
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

  // Don't render anything if modal is not open
  if (!isOpen) return null;

  return (
    <div 
      className="modal-overlay" 
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div 
        className="doctor-modal" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <h2 className="modal-title">Doctor Application Review</h2>
          <button 
            className="modal-close" 
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
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
              {/* Personal Information Section */}
              <div className="details-section">
                <h3 className="section-title">Personal Information</h3>
                <div className="details-grid">
                  <div className="detail-item">
                    <label>First Name:</label>
                    <span>{doctor.firstName || 'Not provided'}</span>
                  </div>
                  <div className="detail-item">
                    <label>Last Name:</label>
                    <span>{doctor.lastName || 'Not provided'}</span>
                  </div>
                  <div className="detail-item">
                    <label>Email Address:</label>
                    <span>{doctor.email || 'Not provided'}</span>
                  </div>
                  <div className="detail-item">
                    <label>Personal Contact Number:</label>
                    <span>{doctor.personalContactNumber || 'Not provided'}</span>
                  </div>
                  <div className="detail-item">
                    <label>Clinic Location:</label>
                    <span>{doctor.clinicLocation || doctor.clinicAddress || 'Not provided'}</span>
                  </div>
                  <div className="detail-item">
                    <label>Clinic Contact Number:</label>
                    <span>{doctor.clinicContactNumber || 'Not provided'}</span>
                  </div>
                </div>
              </div>

              {/* Professional Information Section */}
              <div className="details-section">
                <h3 className="section-title">Professional Information</h3>
                <div className="details-grid">
                  <div className="detail-item">
                    <label>Specialty:</label>
                    <span>{doctor.specialty || doctor.specialization || 'Not provided'}</span>
                  </div>
                  <div className="detail-item">
                    <label>Professional Title:</label>
                    <span>{doctor.title || 'Not provided'}</span>
                  </div>
                  <div className="detail-item">
                    <label>Areas of Expertise:</label>
                    <span>{doctor.areasOfExpertise || 'Not provided'}</span>
                  </div>
                  <div className="detail-item">
                    <label>Experience:</label>
                    <span>{doctor.experience || doctor.yearsOfPractice ? `${doctor.yearsOfPractice} years` : 'Not provided'}</span>
                  </div>
                </div>
              </div>

              {/* Document Verification Section */}
              <div className="details-section">
                <h3 className="section-title">Document Verification</h3>
                <div className="documents-grid">
                  <div className="document-item">
                    <label>License Document:</label>
                    {renderDocumentLink(doctor.licenseDocumentUrl, 'License')}
                  </div>
                  <div className="document-item">
                    <label>Education Certificate:</label>
                    {renderDocumentLink(doctor.educationCertificateUrl, 'Education Certificate')}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button 
            className="modal-button secondary" 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            disabled={processingAction}
          >
            Close
          </button>
          <div className="action-buttons">
            <button 
              className="modal-button reject" 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🚨 BUTTON CLICKED - handleReject called');
                console.log('Current processingAction state:', processingAction);
                handleReject();
              }}
              disabled={processingAction}
            >
              {processingAction ? 'Processing...' : 'Reject'}
            </button>
            <button 
              className="modal-button approve" 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🚨 BUTTON CLICKED - handleApprove called');
                console.log('Current processingAction state:', processingAction);
                handleApprove();
              }}
              disabled={processingAction}
            >
              {processingAction ? 'Processing...' : 'Accept'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorDetailsModal;