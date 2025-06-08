// src/components/admin/DoctorVerificationDetails.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import adminService from '../../services/adminService';
import '../../styles/components/admin/DoctorVerificationDetails.css';

const DoctorVerificationDetails = () => {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [verificationAction, setVerificationAction] = useState('');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    console.log('🟢 DoctorVerificationDetails - Loading doctor:', doctorId);
    fetchDoctorDetails();
  }, [doctorId]);

  const fetchDoctorDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await adminService.getDoctorDetails(doctorId);
      console.log('✅ Doctor details loaded:', response.data);
      
      // 🔧 DEBUG: Check for problematic data
      console.log('🔍 Debugging doctor data structure:');
      console.log('verificationNotes:', response.data.verificationNotes);
      console.log('education:', response.data.education);
      console.log('certifications:', response.data.certifications);
      console.log('languages:', response.data.languages);
      
      setDoctor(response.data);
    } catch (err) {
      console.error('❌ Error fetching doctor details:', err);
      setError('Failed to load doctor details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
      
      await adminService.verifyDoctor(doctorId, {
        verificationStatus: verificationAction,
        verificationNotes,
        rejectionReason: verificationAction === 'rejected' ? rejectionReason : ''
      });
      
      const successMessage = `Doctor ${verificationAction === 'approved' ? 'approved' : 'rejected'} successfully!`;
      toast.success(successMessage);
      
      // Navigate back to pending doctors list
      navigate('/admin/professionals');
      
    } catch (err) {
      console.error('❌ Verification error:', err);
      const errorMessage = err.response?.data?.message || 'Verification process failed. Please try again.';
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // 🔧 SAFE: Helper function to safely render any value
  const safeRender = (value, fallback = 'Not provided') => {
    if (value === null || value === undefined || value === '') {
      return fallback;
    }
    
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return value.length > 0 ? value.join(', ') : fallback;
      }
      return JSON.stringify(value);
    }
    
    return String(value);
  };

  // 🔧 SAFE: Helper function to safely render array data
  const safeRenderArray = (array, fallback = 'Not specified') => {
    if (!Array.isArray(array) || array.length === 0) {
      return fallback;
    }
    
    return array.map((item, index) => {
      if (typeof item === 'string') {
        return item;
      }
      if (typeof item === 'object' && item.name) {
        return item.name;
      }
      if (typeof item === 'object' && item.content) {
        return item.content;
      }
      return String(item);
    }).join(', ');
  };

  // 🔧 SAFE: Helper function to safely render verification notes
  const safeRenderVerificationNotes = (notes) => {
    if (!notes) return null;
    
    if (Array.isArray(notes)) {
      return notes.map((note, index) => (
        <p key={index}>
          {typeof note === 'object' ? (note.note || note.content || JSON.stringify(note)) : String(note)}
        </p>
      ));
    }
    
    if (typeof notes === 'object') {
      return <p>{notes.note || notes.content || JSON.stringify(notes)}</p>;
    }
    
    return <p>{String(notes)}</p>;
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
                      <span className="start-time">{safeRender(slot.startTime, 'Not set')}</span>
                      <span className="time-separator">-</span>
                      <span className="end-time">{safeRender(slot.endTime, 'Not set')}</span>
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
        📄 View {label}
      </a>
    );
  };

  // Helper function to determine if doctor needs verification
  const isPendingVerification = () => {
    if (!doctor) return false;
    return !doctor.verificationStatus || doctor.verificationStatus === 'pending';
  };

  // Helper function to get status badge style
  const getStatusBadgeClass = (status) => {
    switch(status) {
      case 'approved':
        return 'status-verified-approved';
      case 'rejected':
        return 'status-verified-rejected';
      default:
        return 'status-pending';
    }
  };

  // Update header text based on doctor status
  const getHeaderText = () => {
    if (!doctor) return { title: 'Doctor Details', subtitle: 'Loading...' };
    
    if (isPendingVerification()) {
      return {
        title: 'Doctor Verification Review',
        subtitle: 'Review and verify the professional application details below'
      };
    } else {
      return {
        title: 'Doctor Profile Details',
        subtitle: `Viewing profile for ${safeRender(doctor.firstName)} ${safeRender(doctor.lastName)}`
      };
    }
  };

  if (loading) {
    return (
      <div className="doctor-verification-details">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading doctor details...</p>
        </div>
      </div>
    );
  }

  if (error && !doctor) {
    return (
      <div className="doctor-verification-details">
        <div className="error-container">
          <div className="error-header">
            <button 
              className="back-button"
              onClick={() => navigate('/admin/professionals')}
            >
              ← Back to Professionals
            </button>
          </div>
          <div className="error-message">
            <h2>Error Loading Doctor Details</h2>
            <p>{error}</p>
            <button className="retry-button" onClick={fetchDoctorDetails}>
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const headerText = getHeaderText();

  return (
    <div className="doctor-verification-details">
      {/* Header with back button */}
      <div className="verification-header">
        <button 
          className="back-button"
          onClick={() => navigate('/admin/professionals')}
        >
          ← Back to Professionals
        </button>
        <div className="header-info">
          <h1>{headerText.title}</h1>
          <p>{headerText.subtitle}</p>
        </div>
      </div>

      {error && (
        <div className="error-alert">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {doctor && (
        <div className="verification-content">
          {/* Show verification status for already-verified doctors */}
          {!isPendingVerification() && (
            <div className="verification-status-card">
              <div className="status-header">
                <h3>Verification Status</h3>
                <span className={`status-badge ${getStatusBadgeClass(doctor.verificationStatus)}`}>
                  {doctor.verificationStatus === 'approved' ? '✅ APPROVED' : '❌ REJECTED'}
                </span>
              </div>
              
              {doctor.verificationDate && (
                <div className="verification-info">
                  <p><strong>Verification Date:</strong> {formatDate(doctor.verificationDate)}</p>
                </div>
              )}
              
              {doctor.rejectionReason && doctor.verificationStatus === 'rejected' && (
                <div className="rejection-reason">
                  <p><strong>Rejection Reason:</strong></p>
                  <p>{safeRender(doctor.rejectionReason)}</p>
                </div>
              )}
              
              {doctor.verificationNotes && (
                <div className="verification-notes">
                  <p><strong>Admin Notes:</strong></p>
                  {safeRenderVerificationNotes(doctor.verificationNotes)}
                </div>
              )}
            </div>
          )}

          <div className="doctor-info-section">
            {/* Personal Information */}
            <div className="info-card">
              <h3 className="card-title">Personal Information</h3>
              <div className="info-grid">
                <div className="info-item">
                  <label>Full Name:</label>
                  <span>{safeRender(doctor.title)} {safeRender(doctor.firstName)} {safeRender(doctor.lastName)}</span>
                </div>
                <div className="info-item">
                  <label>Email Address:</label>
                  <span>{safeRender(doctor.email)}</span>
                </div>
                <div className="info-item">
                  <label>Personal Contact:</label>
                  <span>{safeRender(doctor.personalContactNumber)}</span>
                </div>
                <div className="info-item">
                  <label>Clinic Location:</label>
                  <span>{safeRender(doctor.clinicLocation || doctor.clinicAddress)}</span>
                </div>
                <div className="info-item">
                  <label>Clinic Contact:</label>
                  <span>{safeRender(doctor.clinicContactNumber)}</span>
                </div>
              </div>
            </div>

            {/* Professional Information */}
            <div className="info-card">
              <h3 className="card-title">Professional Information</h3>
              <div className="info-grid">
                <div className="info-item">
                  <label>Specialization:</label>
                  <span>{safeRender(doctor.specialty || doctor.specialization)}</span>
                </div>
                <div className="info-item">
                  <label>Professional Title:</label>
                  <span>{safeRender(doctor.title)}</span>
                </div>
                <div className="info-item">
                  <label>Years of Experience:</label>
                  <span>{safeRender(doctor.experience || doctor.yearsOfPractice)}</span>
                </div>
                <div className="info-item">
                  <label>Areas of Expertise:</label>
                  <span>{safeRender(doctor.areasOfExpertise)}</span>
                </div>
                <div className="info-item">
                  <label>Languages:</label>
                  <span>{safeRenderArray(doctor.languages)}</span>
                </div>
                <div className="info-item">
                  <label>Consultation Fee:</label>
                  <span>{doctor.consultationFee ? `$${safeRender(doctor.consultationFee)}` : 'Not specified'}</span>
                </div>
              </div>
              
              {doctor.bio && (
                <div className="bio-section">
                  <label>Professional Bio:</label>
                  <p className="bio-text">{safeRender(doctor.bio)}</p>
                </div>
              )}
            </div>

            {/* Service Availability */}
            <div className="info-card">
              <h3 className="card-title">Service Availability</h3>
              <div className="availability-info">
                <div className="service-types">
                  <div className="service-type">
                    <label>In-Person Consultations:</label>
                    <span className={`status-badge ${doctor.inPerson || doctor.appointmentTypes?.inPerson ? 'available' : 'unavailable'}`}>
                      {doctor.inPerson || doctor.appointmentTypes?.inPerson ? 'Available' : 'Not Available'}
                    </span>
                  </div>
                  <div className="service-type">
                    <label>Telehealth Consultations:</label>
                    <span className={`status-badge ${doctor.telehealth || doctor.appointmentTypes?.telehealth ? 'available' : 'unavailable'}`}>
                      {doctor.telehealth || doctor.appointmentTypes?.telehealth ? 'Available' : 'Not Available'}
                    </span>
                  </div>
                </div>
                
                <div className="schedule-section">
                  <label>Weekly Schedule:</label>
                  {renderAvailabilitySchedule(doctor.availability)}
                </div>
              </div>
            </div>

            {/* Credentials */}
            <div className="info-card">
              <h3 className="card-title">Credentials & Licenses</h3>
              
              {/* License Information */}
              <div className="credentials-section">
                <h4>Medical License</h4>
                <div className="info-grid">
                  <div className="info-item">
                    <label>License Number:</label>
                    <span>{safeRender(doctor.licenseNumber)}</span>
                  </div>
                  <div className="info-item">
                    <label>Issuing Authority:</label>
                    <span>{safeRender(doctor.licenseIssuingAuthority)}</span>
                  </div>
                  <div className="info-item">
                    <label>Expiry Date:</label>
                    <span>{formatDate(doctor.licenseExpiryDate)}</span>
                  </div>
                </div>
              </div>

              {/* Education */}
              {doctor.education && doctor.education.length > 0 && (
                <div className="credentials-section">
                  <h4>Education</h4>
                  <div className="credentials-list">
                    {doctor.education.map((edu, index) => (
                      <div key={index} className="credential-item">
                        <span className="credential-degree">{safeRender(edu.degree, 'Degree not specified')}</span>
                        <span className="credential-institution">{safeRender(edu.institution, 'Institution not specified')}</span>
                        <span className="credential-year">{safeRender(edu.year, 'Year not specified')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Certifications */}
              {doctor.certifications && doctor.certifications.length > 0 && (
                <div className="credentials-section">
                  <h4>Certifications</h4>
                  <div className="credentials-list">
                    {doctor.certifications.map((cert, index) => (
                      <div key={index} className="credential-item">
                        <span className="credential-degree">{safeRender(cert.degree, 'Certification not specified')}</span>
                        <span className="credential-institution">{safeRender(cert.issuingAuthority, 'Authority not specified')}</span>
                        <span className="credential-year">{safeRender(cert.year, 'Year not specified')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Documents */}
            <div className="info-card">
              <h3 className="card-title">Supporting Documents</h3>
              <div className="documents-grid">
                <div className="document-item">
                  <label>Medical License Document:</label>
                  {renderDocumentLink(doctor.licenseDocumentUrl, 'License')}
                </div>
                <div className="document-item">
                  <label>Education Certificate:</label>
                  {renderDocumentLink(doctor.educationCertificateUrl, 'Education Certificate')}
                </div>
                {doctor.additionalDocumentUrls && doctor.additionalDocumentUrls.length > 0 && (
                  <div className="document-item">
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

          {/* CONDITIONAL: Only show verification form for pending doctors */}
          {isPendingVerification() && (
            <div className="verification-form-section">
              <div className="form-card">
                <h3 className="card-title">Verification Decision</h3>
                
                <form onSubmit={handleVerification} className="verification-form">
                  <div className="form-group radio-group">
                    <label>Select Action:</label>
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
                        <label htmlFor="approve">✅ Approve Application</label>
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
                        <label htmlFor="reject">❌ Reject Application</label>
                      </div>
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="verificationNotes">Internal Notes (Admin Only):</label>
                    <textarea
                      id="verificationNotes"
                      name="verificationNotes"
                      value={verificationNotes}
                      onChange={(e) => setVerificationNotes(e.target.value)}
                      placeholder="Add any internal notes for reference..."
                      rows={3}
                    />
                  </div>
                  
                  {verificationAction === 'rejected' && (
                    <div className="form-group">
                      <label htmlFor="rejectionReason">Rejection Reason (Will be sent to applicant): *</label>
                      <textarea
                        id="rejectionReason"
                        name="rejectionReason"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Provide a detailed reason for the rejection..."
                        rows={4}
                        required
                      />
                    </div>
                  )}
                  
                  <div className="form-actions">
                    <button 
                      type="button" 
                      className="btn-secondary" 
                      onClick={() => navigate('/admin/professionals')}
                      disabled={submitting}
                    >
                      Cancel
                    </button>
                    
                    <button 
                      type="submit" 
                      className={`btn-primary ${verificationAction === 'approved' ? 'btn-approve' : verificationAction === 'rejected' ? 'btn-reject' : ''}`}
                      disabled={submitting || !verificationAction}
                    >
                      {submitting 
                        ? 'Processing...' 
                        : verificationAction === 'approved' 
                          ? 'Approve Doctor' 
                          : verificationAction === 'rejected' 
                            ? 'Reject Application' 
                            : 'Submit Decision'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DoctorVerificationDetails;