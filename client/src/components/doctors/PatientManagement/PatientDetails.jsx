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

  // Journal-related states
  const [journalData, setJournalData] = useState([]);
  const [journalLoading, setJournalLoading] = useState(false);
  const [journalError, setJournalError] = useState(null);

  // Mood check-ins related states
  const [moodData, setMoodData] = useState(null);
  const [moodLoading, setMoodLoading] = useState(false);
  const [moodError, setMoodError] = useState(null);
  const [selectedDays, setSelectedDays] = useState(7);

  // Mood SVG URLs and colors
  const moodSvgUrls = {
    great: 'https://res.cloudinary.com/dm7qxemrt/image/upload/v1749199687/Face_Im_Great_anfp2e.svg',
    good: 'https://res.cloudinary.com/dm7qxemrt/image/upload/v1749199687/Face_Im_good_ldcpo4.svg',
    okay: 'https://res.cloudinary.com/dm7qxemrt/image/upload/v1749199687/Face_Im_okay_tcf9cp.svg',
    struggling: 'https://res.cloudinary.com/dm7qxemrt/image/upload/v1749199687/Face_Im_struggling_regocn.svg',
    upset: 'https://res.cloudinary.com/dm7qxemrt/image/upload/v1749199687/Face_Im_upset_pqskxp.svg'
  };

  const moodColors = {
    great: '#4CAF50',
    good: '#8BC34A', 
    okay: '#FFC107',
    struggling: '#FF9800',
    upset: '#F44336'
  };

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

  // Fetch patient journal data
  const fetchPatientJournalData = async () => {
    try {
      setJournalLoading(true);
      setJournalError(null);
      
      // Use the NEW individual patient journals method
      const response = await doctorService.getIndividualPatientJournals(id);
      
      if (response.success && response.data) {
        setJournalData(response.data);
      } else if (Array.isArray(response)) {
        setJournalData(response);
      } else {
        setJournalData([]);
      }
    } catch (error) {
      console.error('Error fetching patient journal data:', error);
      setJournalError('Failed to load journal entries');
      setJournalData([]);
    } finally {
      setJournalLoading(false);
    }
  };

  // Fetch patient mood data
  const fetchPatientMoodData = async () => {
    try {
      setMoodLoading(true);
      setMoodError(null);
      
      // Use the NEW individual patient mood analytics method
      const response = await doctorService.getIndividualPatientMoodAnalytics(id, selectedDays);
      
      if (response.success && response.data) {
        setMoodData(response.data);
      } else {
        setMoodData(null);
      }
    } catch (error) {
      console.error('Error fetching patient mood data:', error);
      setMoodError('Failed to load mood check-in data');
      setMoodData(null);
    } finally {
      setMoodLoading(false);
    }
  };

  // Fetch mood data when tab becomes active or days filter changes
  useEffect(() => {
    if (activeTab === 'mood-checkins' && patient) {
      fetchPatientMoodData();
    }
  }, [activeTab, patient, selectedDays]);

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
          className={`tab-button ${activeTab === 'mood-checkins' ? 'active' : ''}`}
          onClick={() => setActiveTab('mood-checkins')}
        >
          Mood Check-ins
        </button>
        <button 
          className={`tab-button ${activeTab === 'journals' ? 'active' : ''}`}
          onClick={() => setActiveTab('journals')}
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
          <MoodCheckinsTab 
            patient={patient}
            moodData={moodData}
            moodLoading={moodLoading}
            moodError={moodError}
            selectedDays={selectedDays}
            setSelectedDays={setSelectedDays}
            fetchPatientMoodData={fetchPatientMoodData}
            moodSvgUrls={moodSvgUrls}
            moodColors={moodColors}
          />
        )}
        {activeTab === 'journals' && (
          <JournalsTab 
            patient={patient} 
            displayValue={displayValue}
            journalData={journalData}
            journalLoading={journalLoading}
            journalError={journalError}
            fetchPatientJournalData={fetchPatientJournalData}
          />
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

// Journals Tab Component
const JournalsTab = ({ 
  patient, 
  displayValue, 
  journalData, 
  journalLoading, 
  journalError, 
  fetchPatientJournalData 
}) => {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSentimentColor = (sentiment) => {
    // Handle different sentiment data structures
    let sentimentValue = '';
    
    if (typeof sentiment === 'string') {
      sentimentValue = sentiment.toLowerCase();
    } else if (sentiment && typeof sentiment === 'object') {
      sentimentValue = (sentiment.type || sentiment.sentiment || '').toString().toLowerCase();
    } else {
      sentimentValue = '';
    }
    
    switch (sentimentValue) {
      case 'positive':
        return '#4CAF50';
      case 'negative':
        return '#F44336';
      case 'neutral':
        return '#FFD700';
      default:
        return '#9E9E9E';
    }
  };

  const getSentimentIcon = (sentiment) => {
    // Handle different sentiment data structures
    let sentimentValue = '';
    
    if (typeof sentiment === 'string') {
      sentimentValue = sentiment.toLowerCase();
    } else if (sentiment && typeof sentiment === 'object') {
      sentimentValue = (sentiment.type || sentiment.sentiment || '').toString().toLowerCase();
    } else {
      sentimentValue = '';
    }
    
    switch (sentimentValue) {
      case 'positive':
        return '😊';
      case 'negative':
        return '😔';
      case 'neutral':
        return '😐';
      default:
        return '😐';
    }
  };

  const truncateText = (text, maxLength = 100) => {
    if (!text) return 'No content';
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
  };

  if (journalLoading) {
    return (
      <div className="tab-panel">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading journal entries...</p>
        </div>
      </div>
    );
  }

  if (journalError) {
    return (
      <div className="tab-panel">
        <div className="error-container">
          <div className="error-alert">
            <span className="error-icon">⚠️</span>
            <span className="error-message">{journalError}</span>
          </div>
          <button className="retry-button" onClick={fetchPatientJournalData}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-panel">
      <div className="journal-content">
        <div className="journal-management-header">
          <h1>Journal Entries</h1>
          <p>View and track {patient.firstName}'s personal journal entries and emotional insights</p>
        </div>

        {journalData.length === 0 ? (
          <div className="empty-state">
            <h3>No Journal Entries Found</h3>
            <p>{patient.firstName} hasn't created any journal entries yet.</p>
          </div>
        ) : (
          <>
            {/* Journal Entries Table - Using Appointments Design */}
            <div className="appointments-table">
              {/* Table Header */}
              <div className="table-header">
                <div className="header-cell">Date</div>
                <div className="header-cell">Time</div>
                <div className="header-cell">Journal Entry</div>
                <div className="header-cell">Sentiment</div>
                <div className="header-cell">Emotions Detected</div>
                <div className="header-cell">Actions</div>
              </div>

              {/* Table Rows */}
              {journalData.map((entry, index) => (
                <div key={entry._id || index} className="table-row">
                  <div className="table-cell">
                    {formatDate(entry.createdAt || entry.timestamp)}
                  </div>
                  <div className="table-cell">
                    {formatTime(entry.createdAt || entry.timestamp)}
                  </div>
                  <div className="table-cell">
                    <div className="journal-entry-preview">
                      <div style={{ 
                        fontWeight: '600', 
                        marginBottom: '4px',
                        fontSize: '14px'
                      }}>
                        {entry.title || 'Untitled Entry'}
                      </div>
                      <div style={{ 
                        fontSize: '13px', 
                        color: '#666',
                        lineHeight: '1.4'
                      }}>
                        {truncateText(entry.content || entry.text)}
                      </div>
                    </div>
                  </div>
                  <div className="table-cell">
                    <div className="sentiment-indicator">
                      <div 
                        className="sentiment-dot"
                        style={{ 
                          backgroundColor: getSentimentColor(entry.sentiment || entry.sentimentAnalysis?.sentiment),
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          marginRight: '8px'
                        }}
                      ></div>
                      <span className="sentiment-text">
                        {(() => {
                          // Handle different sentiment structures
                          if (typeof entry.sentiment === 'string') {
                            return entry.sentiment;
                          } else if (entry.sentiment && typeof entry.sentiment === 'object') {
                            return entry.sentiment.type || entry.sentiment.sentiment || 'Unknown';
                          } else if (entry.sentimentAnalysis?.sentiment) {
                            return entry.sentimentAnalysis.sentiment;
                          } else {
                            return 'Unknown';
                          }
                        })()}
                      </span>
                    </div>
                  </div>
                  <div className="table-cell">
                    <div className="emotion-tags">
                      {entry.emotions || entry.sentimentAnalysis?.emotions ? (
                        (entry.emotions || entry.sentimentAnalysis.emotions).slice(0, 3).map((emotion, idx) => (
                          <span key={idx} className="emotion-tag">
                            {emotion}
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: '12px', color: '#999' }}>
                          No emotions detected
                        </span>
                      )}
                      {(entry.emotions || entry.sentimentAnalysis?.emotions)?.length > 3 && (
                        <span className="emotion-tag" style={{ background: '#f0f0f0' }}>
                          +{(entry.emotions || entry.sentimentAnalysis.emotions).length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="table-cell">
                    <div className="actions-cell">
                      <button
                        className="action-btn view-btn"
                        onClick={() => {
                          // You can implement a modal to view full journal entry
                          console.log('View full journal entry:', entry);
                        }}
                      >
                        👁️ View
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination (if needed) */}
            {journalData.length > 10 && (
              <div className="pagination">
                <div className="pagination-info">
                  Showing {journalData.length} entries
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Mood Check-ins Tab Component
const MoodCheckinsTab = ({ 
  patient,
  moodData,
  moodLoading,
  moodError,
  selectedDays,
  setSelectedDays,
  fetchPatientMoodData,
  moodSvgUrls,
  moodColors
}) => {
  // Helper functions
  const formatMoodLabel = (moodKey) => {
    return moodKey?.charAt(0).toUpperCase() + moodKey?.slice(1) || 'Unknown';
  };

  const getMoodSvg = (moodKey) => {
    return moodSvgUrls[moodKey] || moodSvgUrls['okay'];
  };

  const getMoodColor = (moodKey) => {
    return moodColors[moodKey] || '#FFC107';
  };

  const formatDayName = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  };

  if (moodLoading) {
    return (
      <div className="tab-panel">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading mood check-ins...</p>
        </div>
      </div>
    );
  }

  if (moodError) {
    return (
      <div className="tab-panel">
        <div className="error-container">
          <div className="error-alert">
            <span className="error-icon">⚠️</span>
            <span className="error-message">{moodError}</span>
          </div>
          <button className="retry-button" onClick={fetchPatientMoodData}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!moodData || !moodData.keyMetrics) {
    return (
      <div className="tab-panel">
        <div className="mood-checkins-container">
          {/* Header */}
          <div className="mood-checkins-header">
            <div className="header-left">
              <h1>{patient.firstName}'s Mood Check-Ins</h1>
              <p>Monitor {patient.firstName}'s mood patterns and emotional insights over time.</p>
            </div>
            <div className="header-right">
              <div className="time-filter">
                <label>Show data for</label>
                <select 
                  value={selectedDays} 
                  onChange={(e) => setSelectedDays(parseInt(e.target.value))}
                  className="days-select"
                >
                  <option value={7}>Last 7 days</option>
                  <option value={14}>Last 14 days</option>
                  <option value={30}>Last 30 days</option>
                </select>
              </div>
              <div className="rainbow-icon">🌈</div>
            </div>
          </div>

          <div className="empty-state">
            <h3>No Mood Check-ins Available</h3>
            <p>{patient.firstName} hasn't submitted any mood check-ins during the selected time period.</p>
            <p style={{ fontSize: '14px', color: '#666', marginTop: '8px' }}>
              Mood check-ins will appear here once {patient.firstName} starts using the mood tracking feature.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { keyMetrics, dailyOverview, moodDistribution, moodHistory } = moodData;

  return (
    <div className="tab-panel">
      <div className="mood-checkins-container">
        {/* Header */}
        <div className="mood-checkins-header">
          <div className="header-left">
            <h1>{patient.firstName}'s Mood Check-Ins</h1>
            <p>Monitor {patient.firstName}'s mood patterns and emotional insights over time.</p>
          </div>
          <div className="header-right">
            <div className="time-filter">
              <label>Show data for</label>
              <select 
                value={selectedDays} 
                onChange={(e) => setSelectedDays(parseInt(e.target.value))}
                className="days-select"
              >
                <option value={7}>Last 7 days</option>
                <option value={14}>Last 14 days</option>
                <option value={30}>Last 30 days</option>
              </select>
            </div>
            <div className="rainbow-icon">🌈</div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="key-metrics-section">
          <h2>Key Metrics</h2>
          <div className="metrics-grid">
            <div className="metric-card">
              <h3>Total Check-ins</h3>
              <div className="metric-card-inside">
                <div className="metric-value">{keyMetrics?.totalLogs || 0}</div>
                <div className="metric-label">This Period</div>
              </div>
            </div>
            <div className="metric-card">
              <h3>Average per Day</h3>
              <div className="metric-card-inside">
                <div className="metric-value">{keyMetrics?.averageLogsPerDay || 0}</div>
                <div className="metric-label">Check-ins / day</div>
              </div>
            </div>
            <div className="metric-card">
              <h3>Average Mood Score</h3>
              <div className="metric-card-inside">
                <div className="metric-value">{keyMetrics?.averageMoodScore || 0}</div>
                <div className="metric-label">out of 5</div>
              </div>
            </div>
            <div className="metric-card">
              <h3>Most Frequent Mood</h3>
              <div className="emotional-trends">
                {keyMetrics?.topEmotionalTrends?.length > 0 ? (
                  <div className="trend-item">
                    <div className="emotional-trends-conainer-inside-emoji">
                      <img 
                        src={getMoodSvg(keyMetrics.topEmotionalTrends[0].mood?.toLowerCase())} 
                        alt={keyMetrics.topEmotionalTrends[0].mood}
                        className="trend-svg"
                      />
                    </div>
                    <div className="emotional-trends-conainer-inside">
                      <span className="trend-label">{keyMetrics.topEmotionalTrends[0].mood}</span>
                    </div>
                  </div>
                ) : (
                  <div className="trend-item">
                    <div className="emotional-trends-conainer-inside-emoji">
                      <img src={getMoodSvg('okay')} alt="okay" className="trend-svg" />
                    </div>
                    <div className="emotional-trends-conainer-inside">
                      <span className="trend-label">No data</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Daily Overview */}
        {dailyOverview && dailyOverview.length > 0 && (
          <div className="daily-overview-section">
            <h2>Daily Overview</h2>
            <div className="daily-overview-grid">
              {dailyOverview.map((day, index) => (
                <div key={index} className="daily-item">
                  <div className="daily-date">{day.dateFormatted}</div>
                  <div className="daily-day-name">{formatDayName(day.date)}</div>
                  <div className="daily-mood-svg">
                    <img 
                      src={getMoodSvg(day.mostFrequentMood)} 
                      alt={day.mostFrequentMood}
                      className="daily-svg"
                    />
                  </div>
                  <div className="daily-stats">
                    <div className="daily-score">{day.averageMoodScore}</div>
                    <div className="daily-entries">{day.totalEntries} logs</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mood Distribution */}
        {moodDistribution && Object.keys(moodDistribution).length > 0 && (
          <div className="mood-distribution-section">
            <h2>Mood Distribution</h2>
            <div className="mood-distribution-grid">
              {Object.entries(moodDistribution).map(([moodKey, data]) => (
                <div key={moodKey} className="mood-distribution-item">
                  <div className="mood-info">
                    <span 
                      className="mood-dot"
                      style={{ backgroundColor: getMoodColor(moodKey) }}
                    ></span>
                    <span className="mood-label">{formatMoodLabel(moodKey)}</span>
                  </div>
                  <div className="mood-stats">
                    <div className="mood-count">{data.count} logs</div>
                    <div className="mood-percentage">{data.percentage}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mood History Table */}
        {moodHistory && moodHistory.length > 0 && (
          <div className="mood-history-section">
            <h2>Mood Check-in History</h2>
            
            <div className="appointments-table">
              {/* Table Header */}
              <div className="table-header">
                <div className="header-cell">Date</div>
                <div className="header-cell">Time</div>
                <div className="header-cell">Mood</div>
                <div className="header-cell">Rating</div>
                <div className="header-cell">Reflection</div>
                <div className="header-cell">Actions</div>
              </div>

              {/* Table Rows */}
              {moodHistory.map((entry, index) => (
                <div key={entry._id || index} className="table-row">
                  <div className="table-cell">
                    {new Date(entry.timestamp || entry.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </div>
                  <div className="table-cell">
                    {new Date(entry.timestamp || entry.createdAt).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                  <div className="table-cell">
                    <div className="mood-indicator">
                      <img 
                        src={getMoodSvg(entry.moodKey || 'okay')} 
                        alt={entry.moodKey || 'okay'}
                        className="mood-svg-small"
                        style={{ width: '20px', height: '20px', marginRight: '8px' }}
                      />
                      <span>{formatMoodLabel(entry.moodKey)}</span>
                    </div>
                  </div>
                  <div className="table-cell">
                    <div 
                      className="mood-rating"
                      style={{ 
                        background: `${getMoodColor(entry.moodKey)}20`,
                        color: getMoodColor(entry.moodKey),
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontWeight: '600',
                        display: 'inline-block'
                      }}
                    >
                      {entry.mood || entry.rating || 'N/A'}/5
                    </div>
                  </div>
                  <div className="table-cell">
                    <div className="reflection-preview">
                      {entry.reflection ? (
                        entry.reflection.length > 50 
                          ? `${entry.reflection.substring(0, 50)}...`
                          : entry.reflection
                      ) : (
                        <span style={{ color: '#999', fontSize: '12px' }}>No reflection</span>
                      )}
                    </div>
                  </div>
                  <div className="table-cell">
                    <div className="actions-cell">
                      <button
                        className="action-btn view-btn"
                        onClick={() => {
                          console.log('View mood entry details:', entry);
                        }}
                      >
                        👁️ View
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientDetails;