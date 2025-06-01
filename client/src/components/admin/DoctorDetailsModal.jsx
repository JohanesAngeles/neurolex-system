// client/src/components/admin/DoctorDetailsModal.jsx - COMPLETE FIXED VERSION
import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import adminService from '../../services/adminService';
import '../../styles/components/admin/DoctorDetailsModal.css';

const DoctorDetailsModal = ({ doctorId, isOpen, onClose, onApprove, onReject }) => {
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processingAction, setProcessingAction] = useState(false);

  useEffect(() => {
    if (isOpen && doctorId) {
      fetchDoctorDetails();
    }
  }, [isOpen, doctorId]);

  const fetchDoctorDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching doctor details for:', doctorId);
      
      // ✅ FIXED: Use adminService instead of direct axios
      const response = await adminService.getDoctorDetails(doctorId);
      
      console.log('Doctor details response:', response);
      
      // Handle response structure properly
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

  const handleApprove = async () => {
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
  };

  const handleReject = async () => {
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

              {/* Availability Section */}
              <div className="details-section">
                <h3 className="section-title">Availability</h3>
                <div className="availability-content">
                  <div className="availability-summary">
                    <label>Summary:</label>
                    <span>{formatAvailability(doctor.availability)}</span>
                  </div>
                  
                  <div className="availability-details">
                    <label>Schedule Details:</label>
                    {renderAvailabilitySchedule(doctor.availability)}
                  </div>
                  
                  <div className="details-grid">
                    <div className="detail-item">
                      <label>In-Person Appointments:</label>
                      <span className={`status-badge ${doctor.inPerson || doctor.appointmentTypes?.inPerson ? 'available' : 'unavailable'}`}>
                        {doctor.inPerson || doctor.appointmentTypes?.inPerson ? 'Available' : 'Not Available'}
                      </span>
                    </div>
                    <div className="detail-item">
                      <label>Telehealth Appointments:</label>
                      <span className={`status-badge ${doctor.telehealth || doctor.appointmentTypes?.telehealth ? 'available' : 'unavailable'}`}>
                        {doctor.telehealth || doctor.appointmentTypes?.telehealth ? 'Available' : 'Not Available'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Credentials Section */}
              <div className="details-section">
                <h3 className="section-title">Credentials</h3>
                
                {/* Education */}
                <div className="credentials-subsection">
                  <h4 className="subsection-title">Education</h4>
                  {doctor.education && doctor.education.length > 0 ? (
                    <div className="credentials-list">
                      {doctor.education.map((edu, index) => (
                        <div key={index} className="credential-item">
                          <span className="credential-degree">{edu.degree || 'Degree not specified'}</span>
                          <span className="credential-institution">{edu.institution || 'Institution not specified'}</span>
                          <span className="credential-year">{edu.year || 'Year not specified'}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="no-data">No education information provided</p>
                  )}
                </div>

                {/* Licenses */}
                <div className="credentials-subsection">
                  <h4 className="subsection-title">Licenses</h4>
                  {doctor.licenses && doctor.licenses.length > 0 ? (
                    <div className="credentials-list">
                      {doctor.licenses.map((license, index) => (
                        <div key={index} className="credential-item">
                          <span className="credential-degree">{license.degree || 'License type not specified'}</span>
                          <span className="credential-number">#{license.licenseNumber || 'Number not specified'}</span>
                          <span className="credential-expiry">Expires: {license.expirationDate || 'Date not specified'}</span>
                        </div>
                      ))}
                    </div>
                  ) : doctor.licenseNumber ? (
                    <div className="credentials-list">
                      <div className="credential-item">
                        <span className="credential-number">#{doctor.licenseNumber}</span>
                        <span className="credential-institution">{doctor.licenseIssuingAuthority || 'Authority not specified'}</span>
                        <span className="credential-expiry">Expires: {formatDate(doctor.licenseExpiryDate)}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="no-data">No license information provided</p>
                  )}
                </div>

                {/* Certifications */}
                <div className="credentials-subsection">
                  <h4 className="subsection-title">Certifications</h4>
                  {doctor.certifications && doctor.certifications.length > 0 ? (
                    <div className="credentials-list">
                      {doctor.certifications.map((cert, index) => (
                        <div key={index} className="credential-item">
                          <span className="credential-degree">{cert.degree || 'Certification not specified'}</span>
                          <span className="credential-institution">{cert.issuingAuthority || 'Authority not specified'}</span>
                          <span className="credential-year">{cert.year || 'Year not specified'}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="no-data">No certification information provided</p>
                  )}
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
                  {doctor.additionalDocumentUrls && doctor.additionalDocumentUrls.length > 0 && (
                    <div className="document-item full-width">
                      <label>Additional Documents:</label>
                      <div className="additional-docs">
                        {doctor.additionalDocumentUrls.map((url, index) => (
                          <div key={index}>
                            {renderDocumentLink(url, `Document ${index + 1}`)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
                if (!processingAction) {
                  handleReject();
                }
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
                if (!processingAction) {
                  handleApprove();
                }
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