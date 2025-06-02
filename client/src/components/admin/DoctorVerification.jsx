// src/components/admin/DoctorVerification.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import adminService from '../../services/adminService'; // Import adminService

const DoctorVerification = () => {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [doctor, setDoctor] = useState(null);
  const [verificationAction, setVerificationAction] = useState('');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    console.log('🟢 WORKING PAGE - DoctorVerification:');
    console.log('  doctorId from useParams:', doctorId);
    console.log('  doctorId type:', typeof doctorId);
    console.log('  URL path:', window.location.pathname);
    
    const fetchDoctorDetails = async () => {
      try {
        setLoading(true);
        // Use adminService instead of direct axios call
        const response = await adminService.getDoctorDetails(doctorId);
        setDoctor(response.data);
      } catch (err) {
        setError('Failed to load doctor details. Please try again.');
        console.error('Error fetching doctor:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDoctorDetails();
  }, [doctorId]);

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
      
      // Use adminService instead of direct axios call
      await adminService.verifyDoctor(doctorId, {
        verificationStatus: verificationAction,
        verificationNotes,
        rejectionReason: verificationAction === 'rejected' ? rejectionReason : ''
      });
      
      setSuccess(`Doctor ${verificationAction === 'approved' ? 'approved' : 'rejected'} successfully!`);
      
      // Redirect after a delay - UPDATED PATH to match your current routing
      setTimeout(() => {
        navigate('/admin/professionals');
      }, 2000);
    } catch (err) {
      console.error('Verification error:', err);
      // More detailed error message from the response if available
      const errorMessage = err.response?.data?.message || 'Verification process failed. Please try again.';
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading doctor information...</div>;
  }

  if (!doctor) {
    return <div className="error-message">Doctor not found or you don't have permission to view this page.</div>;
  }

  return (
    <div className="doctor-verification-container">
      <h2>Verify Professional: {doctor.firstName} {doctor.lastName}</h2>
      
      {error && <div className="error-alert">{error}</div>}
      {success && <div className="success-alert">{success}</div>}
      
      <div className="verification-content">
        <div className="doctor-profile-section">
          <h3>Professional Information</h3>
          
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
              <span className="value">{doctor.specialization}</span>
            </div>
            
            <div className="detail-item">
              <span className="label">Years of Experience:</span>
              <span className="value">{doctor.yearsOfExperience}</span>
            </div>
            
            <div className="detail-item">
              <span className="label">Practice Address:</span>
              <span className="value">{doctor.practiceAddress || 'Not provided'}</span>
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
              <span className="value">{doctor.licenseNumber}</span>
            </div>
            
            <div className="detail-item">
              <span className="label">Issuing Authority:</span>
              <span className="value">{doctor.licenseIssuingAuthority}</span>
            </div>
            
            <div className="detail-item">
              <span className="label">Expiry Date:</span>
              <span className="value">{new Date(doctor.licenseExpiryDate).toLocaleDateString()}</span>
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
            <p>{doctor.bio}</p>
          </div>
        </div>
        
        <div className="verification-form-section">
          <h3>Verification Decision</h3>
          
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
                onClick={() => navigate('/admin/professionals')}
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
    </div>
  );
};

export default DoctorVerification;