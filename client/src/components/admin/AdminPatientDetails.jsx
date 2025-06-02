// client/src/components/admin/PatientManagement/AdminPatientDetails.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import adminService from '../../services/adminService';
import '../../styles/components/admin/AdminPatientDetails.css';

const AdminPatientDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenantId');
  
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('registration');
  const [tenant, setTenant] = useState(null);

  // Helper function to safely display values
  const displayValue = (value) => {
    if (value === null || value === undefined || value === '' || value === 'null') {
      return 'Not provided';
    }
    // Handle boolean values
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    // Handle numbers (including 0)
    if (typeof value === 'number') {
      return value.toString();
    }
    // Handle strings
    return value.toString().trim() || 'Not provided';
  };

  // Fetch patient details
  useEffect(() => {
    const fetchPatientDetails = async () => {
      if (!id) {
        setError('Patient ID is required');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // First, get tenant info if tenantId is provided
        if (tenantId) {
          try {
            const tenantResponse = await adminService.getTenantById(tenantId);
            if (tenantResponse.success && tenantResponse.data) {
              setTenant(tenantResponse.data);
            }
          } catch (tenantError) {
            console.warn('Could not fetch tenant details:', tenantError);
          }
        }

        // Fetch patient details - we need to add this method to adminService
        const response = await adminService.getPatientById(id, tenantId);
        
        console.log('🔍 ADMIN PATIENT DETAILS RESPONSE:', response);
        
        if (response.success && response.data) {
          console.log('✅ Using response.data:', response.data);
          setPatient(response.data);
        } else if (response.patient) {
          console.log('✅ Using response.patient:', response.patient);
          setPatient(response.patient);
        } else if (response._id) {
          console.log('✅ Using response directly:', response);
          setPatient(response);
        } else {
          console.error('❌ Unexpected response structure:', response);
          setError('Patient not found or unexpected response format');
        }
        
        setLoading(false);
      } catch (error) {
        console.error('❌ Error fetching admin patient details:', error);
        setError('Failed to load patient details. Please try again.');
        setLoading(false);
      }
    };

    fetchPatientDetails();
  }, [id, tenantId]);

  const handleBack = () => {
    navigate('/admin/users');
  };

  const handleEdit = () => {
    navigate(`/admin/users/${id}/edit${tenantId ? `?tenantId=${tenantId}` : ''}`);
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this patient? This action cannot be undone.')) {
      return;
    }
    
    try {
      const response = await adminService.deletePatient(id, tenantId);
      
      if (response.success) {
        alert('Patient deleted successfully');
        navigate('/admin/users');
      } else {
        throw new Error(response.message || 'Failed to delete patient');
      }
    } catch (err) {
      console.error('Error deleting patient:', err);
      alert(`Error: ${err.message || 'An error occurred while deleting the patient'}`);
    }
  };

  if (loading) {
    return (
      <div className="admin-loading-container">
        <div className="admin-loading-spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-error-container">
        <div className="admin-error-alert">
          <span className="admin-error-icon">⚠️</span>
          <span className="admin-error-message">{error}</span>
        </div>
        <button className="admin-primary-button" onClick={handleBack}>
          Back to Patient Management
        </button>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="admin-error-container">
        <div className="admin-error-alert">
          <span className="admin-error-icon">❌</span>
          <span className="admin-error-message">Patient not found</span>
        </div>
        <button className="admin-primary-button" onClick={handleBack}>
          Back to Patient Management
        </button>
      </div>
    );
  }

  return (
    <div className="admin-patient-details-container">
      {/* Header */}
      <div className="admin-patient-header">
        <div className="admin-header-left">
          <button className="admin-back-button" onClick={handleBack}>
            <span className="admin-back-icon">←</span>
          </button>
          <div className="admin-patient-info">
            <h1 className="admin-patient-name">
              {patient.firstName} {patient.lastName}
            </h1>
            <p className="admin-patient-email">{patient.email}</p>
            {tenant && (
              <p className="admin-patient-clinic">
                📍 {tenant.name}
              </p>
            )}
          </div>
        </div>
        <div className="admin-header-right">
          <div className="admin-status-badge admin-active">
            ● {patient.accountStatus || 'Active'}
          </div>
          <div className="admin-registration-date">
            Registration Date: {patient.createdAt ? new Date(patient.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }) : 'Unknown'}
          </div>
          <div className="admin-action-buttons">
            <button className="admin-edit-button" onClick={handleEdit}>
              ✏️ Edit Patient
            </button>
            <button className="admin-delete-button" onClick={handleDelete}>
              🗑️ Delete Patient
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="admin-tab-navigation">
        <button 
          className={`admin-tab-button ${activeTab === 'registration' ? 'active' : ''}`}
          onClick={() => setActiveTab('registration')}
        >
          Registration
        </button>
        <button 
          className={`admin-tab-button ${activeTab === 'onboarding' ? 'active' : ''}`}
          onClick={() => setActiveTab('onboarding')}
        >
          Onboarding
        </button>
        <button 
          className={`admin-tab-button ${activeTab === 'activity' ? 'active' : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          Activity
        </button>
        <button 
          className={`admin-tab-button ${activeTab === 'system' ? 'active' : ''}`}
          onClick={() => setActiveTab('system')}
        >
          System Info
        </button>
      </div>

      {/* Tab Content */}
      <div className="admin-tab-content">
        {activeTab === 'registration' && (
          <AdminRegistrationTab patient={patient} displayValue={displayValue} />
        )}
        {activeTab === 'onboarding' && (
          <AdminOnboardingTab patient={patient} displayValue={displayValue} />
        )}
        {activeTab === 'activity' && (
          <AdminActivityTab patient={patient} displayValue={displayValue} />
        )}
        {activeTab === 'system' && (
          <AdminSystemTab patient={patient} tenant={tenant} displayValue={displayValue} />
        )}
      </div>
    </div>
  );
};

// Registration Tab Component
const AdminRegistrationTab = ({ patient, displayValue }) => {
  return (
    <div className="admin-tab-panel">
      <div className="admin-section-card">
        <h3 className="admin-section-title">Profile Information</h3>
        
        <div className="admin-profile-section">
          <div className="admin-profile-photo-section">
            <div className="admin-profile-photo">
              {patient.profilePicture && patient.profilePicture !== 'default-profile.png' ? (
                <img 
                  src={patient.profilePicture} 
                  alt="Profile" 
                  className="admin-profile-image"
                />
              ) : (
                <div className="admin-default-avatar">
                  {patient.firstName?.[0] || 'P'}
                </div>
              )}
            </div>
            <p className="admin-photo-label">Profile Photo</p>
          </div>

          <div className="admin-profile-details">
            <div className="admin-detail-row">
              <div className="admin-detail-group">
                <label className="admin-detail-label">First Name</label>
                <div className="admin-detail-value">{displayValue(patient.firstName)}</div>
              </div>
              <div className="admin-detail-group">
                <label className="admin-detail-label">Last Name</label>
                <div className="admin-detail-value">{displayValue(patient.lastName)}</div>
              </div>
            </div>

            <div className="admin-detail-row">
              <div className="admin-detail-group">
                <label className="admin-detail-label">Email Address</label>
                <div className="admin-detail-value">{displayValue(patient.email)}</div>
              </div>
              <div className="admin-detail-group">
                <label className="admin-detail-label">Linked Google Account</label>
                <div className="admin-detail-value">
                  {patient.googleId ? patient.email : 'Not connected'}
                </div>
              </div>
            </div>

            <div className="admin-detail-row">
              <div className="admin-detail-group">
                <label className="admin-detail-label">Account Status</label>
                <div className="admin-detail-value">
                  <span className={`admin-status-indicator ${patient.accountStatus || 'active'}`}>
                    {displayValue(patient.accountStatus) || 'Active'}
                  </span>
                </div>
              </div>
              <div className="admin-detail-group">
                <label className="admin-detail-label">Email Verified</label>
                <div className="admin-detail-value">
                  <span className={`admin-verification-badge ${patient.isEmailVerified ? 'verified' : 'unverified'}`}>
                    {patient.isEmailVerified ? '✅ Verified' : '❌ Unverified'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Onboarding Tab Component (same as doctor side but with admin styling)
const AdminOnboardingTab = ({ patient, displayValue }) => {
  return (
    <div className="admin-tab-panel">
      {/* Part 1: Personal Information */}
      <div className="admin-section-card">
        <h3 className="admin-section-title">Part 1: Personal Information</h3>
        <div className="admin-onboarding-grid">
          <div className="admin-detail-group">
            <label className="admin-detail-label">Middle Name</label>
            <div className="admin-detail-value">{displayValue(patient.middleName)}</div>
          </div>
          <div className="admin-detail-group">
            <label className="admin-detail-label">Nickname</label>
            <div className="admin-detail-value">{displayValue(patient.nickname)}</div>
          </div>
          <div className="admin-detail-group">
            <label className="admin-detail-label">Birthdate</label>
            <div className="admin-detail-value">
              {patient.birthdate ? new Date(patient.birthdate).toLocaleDateString() : 'Not provided'}
            </div>
          </div>
          <div className="admin-detail-group">
            <label className="admin-detail-label">Age</label>
            <div className="admin-detail-value">{displayValue(patient.age)}</div>
          </div>
          <div className="admin-detail-group">
            <label className="admin-detail-label">Gender</label>
            <div className="admin-detail-value">{displayValue(patient.gender)}</div>
          </div>
          <div className="admin-detail-group">
            <label className="admin-detail-label">Pronouns</label>
            <div className="admin-detail-value">{displayValue(patient.pronouns)}</div>
          </div>
          <div className="admin-detail-group">
            <label className="admin-detail-label">Location</label>
            <div className="admin-detail-value">{displayValue(patient.location)}</div>
          </div>
        </div>
      </div>

      {/* Part 2: Mental Health History */}
      <div className="admin-section-card">
        <h3 className="admin-section-title">Part 2: Mental Health History</h3>
        <div className="admin-onboarding-grid">
          <div className="admin-detail-group admin-full-width">
            <label className="admin-detail-label">Diagnosis</label>
            <div className="admin-detail-value">{displayValue(patient.diagnosis)}</div>
          </div>
          <div className="admin-detail-group admin-full-width">
            <label className="admin-detail-label">Treatment History</label>
            <div className="admin-detail-value">{displayValue(patient.treatmentHistory)}</div>
          </div>
          <div className="admin-detail-group">
            <label className="admin-detail-label">Symptoms Frequency</label>
            <div className="admin-detail-value">{displayValue(patient.symptomsFrequency)}</div>
          </div>
        </div>
      </div>

      {/* Part 3: Doctor & Care Options */}
      <div className="admin-section-card">
        <h3 className="admin-section-title">Part 3: Doctor & Care Options</h3>
        <div className="admin-onboarding-grid">
          <div className="admin-detail-group">
            <label className="admin-detail-label">Has Mental Health Doctor</label>
            <div className="admin-detail-value">{displayValue(patient.hasMentalHealthDoctor)}</div>
          </div>
          <div className="admin-detail-group">
            <label className="admin-detail-label">Primary Doctor</label>
            <div className="admin-detail-value">{displayValue(patient.primaryDoctor)}</div>
          </div>
          <div className="admin-detail-group">
            <label className="admin-detail-label">Doctor Contact</label>
            <div className="admin-detail-value">{displayValue(patient.doctorContact)}</div>
          </div>
          <div className="admin-detail-group">
            <label className="admin-detail-label">Therapist Name</label>
            <div className="admin-detail-value">{displayValue(patient.therapistName)}</div>
          </div>
          <div className="admin-detail-group">
            <label className="admin-detail-label">Therapist Contact</label>
            <div className="admin-detail-value">{displayValue(patient.therapistContact)}</div>
          </div>
          <div className="admin-detail-group">
            <label className="admin-detail-label">Insurance Provider</label>
            <div className="admin-detail-value">{displayValue(patient.insuranceProvider)}</div>
          </div>
        </div>
      </div>

      {/* Part 4: Daily Life & Lifestyle */}
      <div className="admin-section-card">
        <h3 className="admin-section-title">Part 4: Daily Life & Lifestyle</h3>
        <div className="admin-onboarding-grid">
          <div className="admin-detail-group">
            <label className="admin-detail-label">Occupation</label>
            <div className="admin-detail-value">{displayValue(patient.occupation)}</div>
          </div>
          <div className="admin-detail-group">
            <label className="admin-detail-label">Work Status</label>
            <div className="admin-detail-value">{displayValue(patient.workStatus)}</div>
          </div>
          <div className="admin-detail-group">
            <label className="admin-detail-label">Living Arrangement</label>
            <div className="admin-detail-value">{displayValue(patient.livingArrangement)}</div>
          </div>
          <div className="admin-detail-group">
            <label className="admin-detail-label">Exercise Frequency</label>
            <div className="admin-detail-value">{displayValue(patient.exerciseFrequency)}</div>
          </div>
          <div className="admin-detail-group admin-full-width">
            <label className="admin-detail-label">Dietary Patterns</label>
            <div className="admin-detail-value">{displayValue(patient.dietaryPatterns)}</div>
          </div>
          <div className="admin-detail-group admin-full-width">
            <label className="admin-detail-label">Sleep Patterns</label>
            <div className="admin-detail-value">{displayValue(patient.sleepPatterns)}</div>
          </div>
        </div>
      </div>

      {/* Part 5: Emergency Contact Person */}
      <div className="admin-section-card">
        <h3 className="admin-section-title">Part 5: Emergency Contact Person</h3>
        <div className="admin-onboarding-grid">
          <div className="admin-detail-group">
            <label className="admin-detail-label">Emergency Contact Name</label>
            <div className="admin-detail-value">{displayValue(patient.emergencyName)}</div>
          </div>
          <div className="admin-detail-group">
            <label className="admin-detail-label">Relationship</label>
            <div className="admin-detail-value">{displayValue(patient.emergencyRelationship)}</div>
          </div>
          <div className="admin-detail-group">
            <label className="admin-detail-label">Phone Number</label>
            <div className="admin-detail-value">{displayValue(patient.emergencyPhone)}</div>
          </div>
          <div className="admin-detail-group">
            <label className="admin-detail-label">Email Address</label>
            <div className="admin-detail-value">{displayValue(patient.emergencyEmail)}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Activity Tab Component
const AdminActivityTab = ({ patient, displayValue }) => {
  return (
    <div className="admin-tab-panel">
      <div className="admin-section-card">
        <h3 className="admin-section-title">Account Activity</h3>
        <div className="admin-activity-grid">
          <div className="admin-detail-group">
            <label className="admin-detail-label">Last Login</label>
            <div className="admin-detail-value">
              {patient.lastLogin ? new Date(patient.lastLogin).toLocaleString() : 'Never'}
            </div>
          </div>
          <div className="admin-detail-group">
            <label className="admin-detail-label">Login Count</label>
            <div className="admin-detail-value">{displayValue(patient.loginCount || 0)}</div>
          </div>
          <div className="admin-detail-group">
            <label className="admin-detail-label">Journal Entries</label>
            <div className="admin-detail-value">{displayValue(patient.journalCount || 0)}</div>
          </div>
          <div className="admin-detail-group">
            <label className="admin-detail-label">Appointments Scheduled</label>
            <div className="admin-detail-value">{displayValue(patient.appointmentCount || 0)}</div>
          </div>
        </div>
      </div>
      
      <div className="admin-section-card">
        <h3 className="admin-section-title">Coming Soon</h3>
        <p className="admin-coming-soon-text">
          Additional activity metrics and detailed logs will be available in future updates.
        </p>
      </div>
    </div>
  );
};

// System Tab Component
const AdminSystemTab = ({ patient, tenant, displayValue }) => {
  return (
    <div className="admin-tab-panel">
      <div className="admin-section-card">
        <h3 className="admin-section-title">System Information</h3>
        <div className="admin-system-grid">
          <div className="admin-detail-group">
            <label className="admin-detail-label">Patient ID</label>
            <div className="admin-detail-value admin-code">{patient._id}</div>
          </div>
          <div className="admin-detail-group">
            <label className="admin-detail-label">Tenant ID</label>
            <div className="admin-detail-value admin-code">{patient.tenantId || 'N/A'}</div>
          </div>
          <div className="admin-detail-group">
            <label className="admin-detail-label">Database Collection</label>
            <div className="admin-detail-value admin-code">users</div>
          </div>
          <div className="admin-detail-group">
            <label className="admin-detail-label">User Role</label>
            <div className="admin-detail-value">{displayValue(patient.role || 'patient')}</div>
          </div>
          <div className="admin-detail-group">
            <label className="admin-detail-label">Created At</label>
            <div className="admin-detail-value">
              {patient.createdAt ? new Date(patient.createdAt).toLocaleString() : 'Unknown'}
            </div>
          </div>
          <div className="admin-detail-group">
            <label className="admin-detail-label">Last Updated</label>
            <div className="admin-detail-value">
              {patient.updatedAt ? new Date(patient.updatedAt).toLocaleString() : 'Unknown'}
            </div>
          </div>
        </div>
      </div>

      {tenant && (
        <div className="admin-section-card">
          <h3 className="admin-section-title">Clinic Information</h3>
          <div className="admin-system-grid">
            <div className="admin-detail-group">
              <label className="admin-detail-label">Clinic Name</label>
              <div className="admin-detail-value">{tenant.name}</div>
            </div>
            <div className="admin-detail-group">
              <label className="admin-detail-label">Admin Email</label>
              <div className="admin-detail-value">{tenant.adminEmail}</div>
            </div>
            <div className="admin-detail-group">
              <label className="admin-detail-label">Location</label>
              <div className="admin-detail-value">{tenant.location}</div>
            </div>
            <div className="admin-detail-group">
              <label className="admin-detail-label">Database Name</label>
              <div className="admin-detail-value admin-code">{tenant.dbName}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPatientDetails;