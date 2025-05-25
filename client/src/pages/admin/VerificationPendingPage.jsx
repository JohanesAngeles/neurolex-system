// src/pages/VerificationPendingPage.jsx
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';

const VerificationPendingPage = () => {
  const location = useLocation();
  const [doctorId, setDoctorId] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('pending');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Get doctor ID from URL query params or state
    const params = new URLSearchParams(location.search);
    const id = params.get('id') || (location.state && location.state.doctorId);
    
    if (id) {
      setDoctorId(id);
      checkVerificationStatus(id);
    }
  }, [location]);

  // Check verification status periodically
  useEffect(() => {
    if (!doctorId) return;
    
    const intervalId = setInterval(() => {
      checkVerificationStatus(doctorId);
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(intervalId);
  }, [doctorId]);

  const checkVerificationStatus = async (id) => {
    if (!id) return;
    
    try {
      setLoading(true);
      const response = await axios.get(`/api/doctors/verification-status/${id}`);
      setVerificationStatus(response.data.data.verificationStatus);
    } catch (err) {
      console.error('Error checking verification status:', err);
      setError('Failed to check verification status');
    } finally {
      setLoading(false);
    }
  };

  // Render appropriate message based on verification status
  const renderMessage = () => {
    switch (verificationStatus) {
      case 'approved':
        return (
          <div className="approved-message">
            <h3>Your Account Has Been Approved!</h3>
            <p>
              Great news! Your professional account has been verified and approved.
              You can now log in to your account and start using all the professional features.
            </p>
            <div className="action-buttons">
              <Link to="/login" className="btn-primary">
                Log In to Your Account
              </Link>
            </div>
          </div>
        );
      
      case 'rejected':
        return (
          <div className="rejected-message">
            <h3>Verification Not Approved</h3>
            <p>
              We regret to inform you that your professional verification application was not approved.
              Please check your email for detailed information about why your application was not approved
              and what steps you can take next.
            </p>
            <div className="action-buttons">
              <Link to="/contact-support" className="btn-secondary">
                Contact Support
              </Link>
            </div>
          </div>
        );
      
      case 'pending':
      default:
        return (
          <div className="pending-message">
            <h3>Verification in Progress</h3>
            <p>
              Thank you for applying to join the Neurolex professional network.
              Your application is currently being reviewed by our administrative team.
            </p>
            <div className="verification-info">
              <h4>What happens next?</h4>
              <ul>
                <li>Our team is reviewing your professional credentials and information</li>
                <li>This process typically takes 1-3 business days</li>
                <li>You'll receive an email notification once your account is verified</li>
                <li>You can also check this page for updates on your verification status</li>
              </ul>
            </div>
            <p>
              If you have any questions or need assistance, please don't hesitate to contact our support team.
            </p>
            <div className="action-buttons">
              <Link to="/contact-support" className="btn-secondary">
                Contact Support
              </Link>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="verification-pending-container">
      <div className="verification-pending-card">
        <div className="card-header">
          <h2>Professional Account Verification</h2>
        </div>
        
        {error ? (
          <div className="error-message">
            {error}
            <button 
              onClick={() => checkVerificationStatus(doctorId)} 
              className="btn-refresh"
              disabled={loading}
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="card-content">
            <div className={`verification-status ${verificationStatus}`}>
              {verificationStatus === 'pending' && (
                <>
                  <div className="status-icon pending"></div>
                  <span>Verification in Progress</span>
                </>
              )}
              {verificationStatus === 'approved' && (
                <>
                  <div className="status-icon approved"></div>
                  <span>Verified & Approved</span>
                </>
              )}
              {verificationStatus === 'rejected' && (
                <>
                  <div className="status-icon rejected"></div>
                  <span>Verification Not Approved</span>
                </>
              )}
            </div>
            
            {renderMessage()}
          </div>
        )}
      </div>
    </div>
  );
};

export default VerificationPendingPage;