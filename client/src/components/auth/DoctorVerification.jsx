import React, { useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import AuthLayout from '../../layouts/auth/authLayout';
import '../../styles/components/auth/auth_forms.css';

const DoctorVerification = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { email } = location.state || {};
  
  // If no email is provided, redirect to registration
  useEffect(() => {
    if (!email) {
      navigate('/register');
    }
  }, [email, navigate]);

  if (!email) {
    return null; // Will redirect via useEffect
  }

  return (
    <AuthLayout>
      <div className="auth-form-container">
        <div className="verification-container">
          <div className="verification-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#4caf50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          
          <h2>Registration Submitted</h2>
          
          <div className="verification-message">
            <p>Thank you for registering as a healthcare professional with Neurolex.</p>
            <p>Your account is pending verification. We need to verify your professional credentials before activating your account.</p>
            
            <div className="verification-steps">
              <h3>Next Steps:</h3>
              <ol>
                <li>Our team will review your registration information.</li>
                <li>You will receive an email at <strong>{email}</strong> with further instructions.</li>
                <li>You may be asked to provide additional documentation to verify your credentials.</li>
                <li>Once verified, you'll have full access to the doctor dashboard.</li>
              </ol>
            </div>
            
            <p className="verification-note">
              This process typically takes 1-2 business days. If you have any questions, please contact our support team.
            </p>
          </div>
          
          <div className="verification-actions">
            <Link to="/login" className="button-link">Return to Login</Link>
            <a href="mailto:support@neurolex.com" className="text-link">Contact Support</a>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
};

export default DoctorVerification;