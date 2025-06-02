// Updated DoctorDetailsModal.jsx with verification form like the working page

import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import '../../styles/components/admin/DoctorDetailsModal.css';
import adminService from '../../services/adminService';

const DoctorDetailsModal = ({ doctorId, isOpen, onClose, onApprove, onReject }) => {
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // ✅ ADD: Verification form states (same as working DoctorVerification page)
  const [verificationAction, setVerificationAction] = useState('');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && doctorId) {

      console.log('🔴 MODAL - NOT WORKING:');
      console.log('  doctorId from props:', doctorId);
      console.log('  doctorId type:', typeof doctorId);
      console.log('  URL path:', window.location.pathname);
      
      fetchDoctorDetails();
    }
  }, [isOpen, doctorId]);

  const fetchDoctorDetails = async () => {
    console.log('🔍 Modal fetching details for Doctor ID:', doctorId);
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await adminService.getDoctorDetails(doctorId);
      console.log('✅ Modal getDoctorDetails response:', response);
      setDoctor(response.data);
    } catch (err) {
      console.error('❌ Modal getDoctorDetails error:', err);
      setError('Failed to load doctor details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ ADD: Verification handler (same as working DoctorVerification page)
  const handleVerification = async (e) => {
  e.preventDefault();
  
  if (!verificationAction) {
    setError('Please select an action (Approve or Reject)');
    return;
  }
  
  if (verificationAction === 'rejected' && !rejectionReason) {
    setError('Please provide a reason for rejection');
    return;
  }
  
  try {
    setSubmitting(true);
    console.log('🔍 Modal verifying doctor:', doctorId);
    
    // ✅ EXACT COPY from working DoctorVerification page - WORD FOR WORD
    await adminService.verifyDoctor(doctorId, {
      verificationStatus: verificationAction,
      verificationNotes,
      rejectionReason: verificationAction === 'rejected' ? rejectionReason : ''
    });
    
    console.log('✅ Modal verification SUCCESS');
    
    // ✅ EXACT success message format from working page
    const successMessage = `Doctor ${verificationAction === 'approved' ? 'approved' : 'rejected'} successfully!`;
    toast.success(successMessage);
    
    // Call the appropriate callback
    if (verificationAction === 'approved') {
      onApprove?.(doctorId);
    } else {
      onReject?.(doctorId);
    }
    
    onClose();
  } catch (err) {
    console.error('❌ Modal verification ERROR:', err);
    // ✅ EXACT error handling from working page
    const errorMessage = err.response?.data?.message || 'Verification process failed. Please try again.';
    setError(errorMessage);
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

              {/* ✅ ADD: Verification Form Section (same as working DoctorVerification page) */}
              <div className="details-section">
                <h3 className="section-title">Verification Decision</h3>
                
                <form onSubmit={handleVerification} className="verification-form">
                  <div className="form-group radio-group">
                    <label>Verification Action:</label>
                    <div className="radio-options">
                      <div className="radio-option">
                        <input
                          type="radio"
                          id="approve"
                          name="verificationAction"
                          value="approved"
                          checked={verificationAction === 'approved'}
                          onChange={(e) => setVerificationAction(e.target.value)}
                        />
                        <label htmlFor="approve">Approve</label>
                      </div>
                      
                      <div className="radio-option">
                        <input
                          type="radio"
                          id="reject"
                          name="verificationAction"
                          value="rejected"
                          checked={verificationAction === 'rejected'}
                          onChange={(e) => setVerificationAction(e.target.value)}
                        />
                        <label htmlFor="reject">Reject</label>
                      </div>
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="verificationNotes">Internal Notes (visible to administrators only):</label>
                    <textarea
                      id="verificationNotes"
                      name="verificationNotes"
                      value={verificationNotes}
                      onChange={(e) => setVerificationNotes(e.target.value)}
                      placeholder="Add any internal notes for reference"
                      rows={3}
                    />
                  </div>
                  
                  {verificationAction === 'rejected' && (
                    <div className="form-group">
                      <label htmlFor="rejectionReason">Rejection Reason (will be sent to the applicant):</label>
                      <textarea
                        id="rejectionReason"
                        name="rejectionReason"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Provide a detailed reason for the rejection"
                        rows={4}
                        required
                      />
                    </div>
                  )}
                  
                  <div className="verification-actions">
                    <button 
                      type="button" 
                      className="btn-secondary" 
                      onClick={onClose}
                      disabled={submitting}
                    >
                      Cancel
                    </button>
                    
                    <button 
                      type="submit" 
                      className={`btn-primary ${verificationAction === 'approved' ? 'btn-approve' : ''} ${verificationAction === 'rejected' ? 'btn-reject' : ''}`}
                      disabled={submitting || !verificationAction}
                    >
                      {submitting 
                        ? 'Processing...' 
                        : verificationAction === 'approved' 
                          ? 'Approve Professional' 
                          : verificationAction === 'rejected' 
                            ? 'Reject Professional' 
                            : 'Submit Decision'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default DoctorDetailsModal;