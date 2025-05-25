// client/src/components/doctors/PatientManagement/PatientDetails.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import doctorService from '../../../services/doctorService';
import '../../../styles/components/doctor/PatientDetails.css';

const PatientDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('registration');

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
      try {
        setLoading(true);
        const response = await doctorService.getPatient(id);
        
        console.log('🔍 FULL API RESPONSE:', response);
        console.log('🔍 RESPONSE TYPE:', typeof response);
        console.log('🔍 RESPONSE KEYS:', Object.keys(response || {}));
        
        if (response.success && response.data) {
          console.log('✅ Using response.data:', response.data);
          console.log('🔍 PATIENT DATA KEYS:', Object.keys(response.data || {}));
          setPatient(response.data);
        } else if (response.patient) {
          console.log('✅ Using response.patient:', response.patient);
          console.log('🔍 PATIENT KEYS:', Object.keys(response.patient || {}));
          setPatient(response.patient);
        } else if (response._id) {
          console.log('✅ Using response directly:', response);
          console.log('🔍 DIRECT RESPONSE KEYS:', Object.keys(response || {}));
          setPatient(response);
        } else {
          console.error('❌ Unexpected response structure:', response);
          setError('Patient not found or unexpected response format');
        }
        
        setLoading(false);
      } catch (error) {
        console.error('❌ Error fetching patient details:', error);
        setError('Failed to load patient details. Please try again.');
        setLoading(false);
      }
    };

    if (id) {
      fetchPatientDetails();
    }
  }, [id]);

  const handleBack = () => {
    navigate('/doctor/patients');
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-alert">
          <span className="error-icon">⚠️</span>
          <span className="error-message">{error}</span>
        </div>
        <button className="primary-button" onClick={handleBack}>
          Back to Patients
        </button>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="error-container">
        <div className="error-alert">
          <span className="error-icon">❌</span>
          <span className="error-message">Patient not found</span>
        </div>
        <button className="primary-button" onClick={handleBack}>
          Back to Patients
        </button>
      </div>
    );
  }

  return (
    <div className="patient-details-container">

      {/* Header */}
      <div className="patient-header">
        <div className="header-left">
          <button className="back-button" onClick={handleBack}>
            <span className="back-icon">←</span>
          </button>
          <div className="patient-info">
            <h1 className="patient-name">
              {patient.firstName} {patient.lastName}
            </h1>
            <p className="patient-email">{patient.email}</p>
          </div>
        </div>
        <div className="header-right">
          <div className="status-badge active">
            ● Active
          </div>
          <div className="registration-date">
            Registration Date: {patient.createdAt ? new Date(patient.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }) : 'Unknown'}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button 
          className={`tab-button ${activeTab === 'registration' ? 'active' : ''}`}
          onClick={() => setActiveTab('registration')}
        >
          Registration
        </button>
        <button 
          className={`tab-button ${activeTab === 'onboarding' ? 'active' : ''}`}
          onClick={() => setActiveTab('onboarding')}
        >
          Onboarding
        </button>
        <button 
          className={`tab-button ${activeTab === 'mood-checkins' ? 'active' : ''} disabled`}
          onClick={() => setActiveTab('mood-checkins')}
          disabled
        >
          Mood Check-ins
        </button>
        <button 
          className={`tab-button ${activeTab === 'journals' ? 'active' : ''} disabled`}
          onClick={() => setActiveTab('journals')}
          disabled
        >
          Journals
        </button>
        <button 
          className={`tab-button ${activeTab === 'appointments' ? 'active' : ''} disabled`}
          onClick={() => setActiveTab('appointments')}
          disabled
        >
          Doctor & Appointments
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'registration' && (
          <RegistrationTab patient={patient} displayValue={displayValue} />
        )}
        {activeTab === 'onboarding' && (
          <OnboardingTab patient={patient} displayValue={displayValue} />
        )}
        {activeTab === 'mood-checkins' && (
          <div className="coming-soon">
            <h3>Mood Check-ins</h3>
            <p>This section will be implemented later.</p>
          </div>
        )}
        {activeTab === 'journals' && (
          <div className="coming-soon">
            <h3>Journals</h3>
            <p>This section will be implemented later.</p>
          </div>
        )}
        {activeTab === 'appointments' && (
          <div className="coming-soon">
            <h3>Doctor & Appointments</h3>
            <p>This section will be implemented later.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Registration Tab Component
const RegistrationTab = ({ patient, displayValue }) => {
  return (
    <div className="tab-panel">
      <div className="section-card">
        <h3 className="section-title">Profile Information</h3>
        
        <div className="profile-section">
          <div className="profile-photo-section">
            <div className="profile-photo">
              {patient.profilePicture && patient.profilePicture !== 'default-profile.png' ? (
                <img 
                  src={patient.profilePicture} 
                  alt="Profile" 
                  className="profile-image"
                />
              ) : (
                <div className="default-avatar">
                  {patient.firstName?.[0] || 'P'}
                </div>
              )}
            </div>
            <p className="photo-label">Profile Photo</p>
          </div>

          <div className="profile-details">
            <div className="detail-row">
              <div className="detail-group">
                <label className="detail-label">First Name</label>
                <div className="detail-value">{displayValue(patient.firstName)}</div>
              </div>
              <div className="detail-group">
                <label className="detail-label">Last Name</label>
                <div className="detail-value">{displayValue(patient.lastName)}</div>
              </div>
            </div>

            <div className="detail-row">
              <div className="detail-group">
                <label className="detail-label">Email Address</label>
                <div className="detail-value">{displayValue(patient.email)}</div>
              </div>
              <div className="detail-group">
                <label className="detail-label">Linked Google Account</label>
                <div className="detail-value">
                  {patient.googleId ? patient.email : 'Not connected'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Onboarding Tab Component
const OnboardingTab = ({ patient, displayValue }) => {
  return (
    <div className="tab-panel">
      {/* Part 1: Personal Information */}
      <div className="section-card">
        <h3 className="section-title">Part 1: Personal Information</h3>
        <div className="onboarding-grid">
          <div className="detail-group">
            <label className="detail-label">Middle Name</label>
            <div className="detail-value">{displayValue(patient.middleName)}</div>
          </div>
          <div className="detail-group">
            <label className="detail-label">Nickname</label>
            <div className="detail-value">{displayValue(patient.nickname)}</div>
          </div>
          <div className="detail-group">
            <label className="detail-label">Birthdate</label>
            <div className="detail-value">
              {patient.birthdate ? new Date(patient.birthdate).toLocaleDateString() : 'Not provided'}
            </div>
          </div>
          <div className="detail-group">
            <label className="detail-label">Age</label>
            <div className="detail-value">{displayValue(patient.age)}</div>
          </div>
          <div className="detail-group">
            <label className="detail-label">Gender</label>
            <div className="detail-value">{displayValue(patient.gender)}</div>
          </div>
          <div className="detail-group">
            <label className="detail-label">Pronouns</label>
            <div className="detail-value">{displayValue(patient.pronouns)}</div>
          </div>
          <div className="detail-group">
            <label className="detail-label">Location</label>
            <div className="detail-value">{displayValue(patient.location)}</div>
          </div>
        </div>
      </div>

      {/* Part 2: Mental Health History */}
      <div className="section-card">
        <h3 className="section-title">Part 2: Mental Health History</h3>
        <div className="onboarding-grid">
          <div className="detail-group full-width">
            <label className="detail-label">Diagnosis</label>
            <div className="detail-value">{displayValue(patient.diagnosis)}</div>
          </div>
          <div className="detail-group full-width">
            <label className="detail-label">Treatment History</label>
            <div className="detail-value">{displayValue(patient.treatmentHistory)}</div>
          </div>
          <div className="detail-group">
            <label className="detail-label">Symptoms Frequency</label>
            <div className="detail-value">{displayValue(patient.symptomsFrequency)}</div>
          </div>
        </div>
      </div>

      {/* Part 3: Doctor & Care Options */}
      <div className="section-card">
        <h3 className="section-title">Part 3: Doctor & Care Options</h3>
        <div className="onboarding-grid">
          <div className="detail-group">
            <label className="detail-label">Has Mental Health Doctor</label>
            <div className="detail-value">{displayValue(patient.hasMentalHealthDoctor)}</div>
          </div>
          <div className="detail-group">
            <label className="detail-label">Primary Doctor</label>
            <div className="detail-value">{displayValue(patient.primaryDoctor)}</div>
          </div>
          <div className="detail-group">
            <label className="detail-label">Doctor Contact</label>
            <div className="detail-value">{displayValue(patient.doctorContact)}</div>
          </div>
          <div className="detail-group">
            <label className="detail-label">Therapist Name</label>
            <div className="detail-value">{displayValue(patient.therapistName)}</div>
          </div>
          <div className="detail-group">
            <label className="detail-label">Therapist Contact</label>
            <div className="detail-value">{displayValue(patient.therapistContact)}</div>
          </div>
          <div className="detail-group">
            <label className="detail-label">Psychiatrist Name</label>
            <div className="detail-value">{displayValue(patient.psychiatristName)}</div>
          </div>
          <div className="detail-group">
            <label className="detail-label">Psychiatrist Contact</label>
            <div className="detail-value">{displayValue(patient.psychiatristContact)}</div>
          </div>
          <div className="detail-group">
            <label className="detail-label">Clinic Location</label>
            <div className="detail-value">{displayValue(patient.clinicLocation)}</div>
          </div>
          <div className="detail-group">
            <label className="detail-label">Doctor Contact Number</label>
            <div className="detail-value">{displayValue(patient.doctorContactNumber)}</div>
          </div>
          <div className="detail-group">
            <label className="detail-label">Doctor Email</label>
            <div className="detail-value">{displayValue(patient.doctorEmail)}</div>
          </div>
          <div className="detail-group">
            <label className="detail-label">Need Doctor Help</label>
            <div className="detail-value">{displayValue(patient.needDoctorHelp)}</div>
          </div>
          <div className="detail-group">
            <label className="detail-label">Preferred Hospital</label>
            <div className="detail-value">{displayValue(patient.preferredHospital)}</div>
          </div>
          <div className="detail-group">
            <label className="detail-label">Insurance Provider</label>
            <div className="detail-value">{displayValue(patient.insuranceProvider)}</div>
          </div>
          <div className="detail-group">
            <label className="detail-label">Insurance Number</label>
            <div className="detail-value">{displayValue(patient.insuranceNumber)}</div>
          </div>
        </div>
      </div>

      {/* Part 4: Daily Life & Lifestyle */}
      <div className="section-card">
        <h3 className="section-title">Part 4: Daily Life & Lifestyle</h3>
        <div className="onboarding-grid">
          <div className="detail-group">
            <label className="detail-label">Occupation</label>
            <div className="detail-value">{displayValue(patient.occupation)}</div>
          </div>
          <div className="detail-group">
            <label className="detail-label">Work Status</label>
            <div className="detail-value">{displayValue(patient.workStatus)}</div>
          </div>
          <div className="detail-group">
            <label className="detail-label">Living Arrangement</label>
            <div className="detail-value">{displayValue(patient.livingArrangement)}</div>
          </div>
          <div className="detail-group">
            <label className="detail-label">Exercise Frequency</label>
            <div className="detail-value">{displayValue(patient.exerciseFrequency)}</div>
          </div>
          <div className="detail-group full-width">
            <label className="detail-label">Dietary Patterns</label>
            <div className="detail-value">{displayValue(patient.dietaryPatterns)}</div>
          </div>
          <div className="detail-group full-width">
            <label className="detail-label">Sleep Patterns</label>
            <div className="detail-value">{displayValue(patient.sleepPatterns)}</div>
          </div>
          <div className="detail-group full-width">
            <label className="detail-label">Substance Use</label>
            <div className="detail-value">{displayValue(patient.substanceUse)}</div>
          </div>
          <div className="detail-group">
            <label className="detail-label">Religious Beliefs</label>
            <div className="detail-value">{displayValue(patient.religiousBeliefs)}</div>
          </div>
          <div className="detail-group full-width">
            <label className="detail-label">Hobbies</label>
            <div className="detail-value">{displayValue(patient.hobbies)}</div>
          </div>
        </div>
      </div>

      {/* Part 5: Emergency Contact Person */}
      <div className="section-card">
        <h3 className="section-title">Part 5: Emergency Contact Person</h3>
        <div className="onboarding-grid">
          <div className="detail-group">
            <label className="detail-label">Emergency Contact Name</label>
            <div className="detail-value">{displayValue(patient.emergencyName)}</div>
          </div>
          <div className="detail-group">
            <label className="detail-label">Relationship</label>
            <div className="detail-value">{displayValue(patient.emergencyRelationship)}</div>
          </div>
          <div className="detail-group">
            <label className="detail-label">Phone Number</label>
            <div className="detail-value">{displayValue(patient.emergencyPhone)}</div>
          </div>
          <div className="detail-group">
            <label className="detail-label">Email Address</label>
            <div className="detail-value">{displayValue(patient.emergencyEmail)}</div>
          </div>
          <div className="detail-group full-width">
            <label className="detail-label">Address</label>
            <div className="detail-value">{displayValue(patient.emergencyAddress)}</div>
          </div>
          <div className="detail-group">
            <label className="detail-label">Contact Aware of Emergency Role</label>
            <div className="detail-value">{displayValue(patient.emergencyAware)}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientDetails;