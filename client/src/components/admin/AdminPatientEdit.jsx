// client/src/components/admin/PatientManagement/AdminPatientEdit.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import adminService from '../../services/adminService';
import '../../styles/components/admin/AdminPatientEdit.css';

const AdminPatientEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenantId');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patient, setPatient] = useState(null);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({});
  const [activeTab, setActiveTab] = useState('personal');
  const [tenant, setTenant] = useState(null);

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

        // Fetch patient details
        const response = await adminService.getPatientById(id, tenantId);
        
        if (response.success && response.data) {
          setPatient(response.data);
          setFormData(response.data);
        } else if (response.patient) {
          setPatient(response.patient);
          setFormData(response.patient);
        } else if (response._id) {
          setPatient(response);
          setFormData(response);
        } else {
          setError('Patient not found or unexpected response format');
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching patient details:', error);
        setError('Failed to load patient details. Please try again.');
        setLoading(false);
      }
    };

    fetchPatientDetails();
  }, [id, tenantId]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // Remove read-only fields
      const updateData = { ...formData };
      delete updateData._id;
      delete updateData.createdAt;
      delete updateData.updatedAt;
      delete updateData.tenantId;
      delete updateData.password;
      delete updateData.role;

      const response = await adminService.updatePatient(id, updateData, tenantId);
      
      if (response.success) {
        alert('Patient updated successfully!');
        navigate(`/admin/patients/${id}${tenantId ? `?tenantId=${tenantId}` : ''}`);
      } else {
        throw new Error(response.message || 'Failed to update patient');
      }
    } catch (error) {
      console.error('Error updating patient:', error);
      setError(error.message || 'Failed to update patient. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate(`/admin/patients/${id}${tenantId ? `?tenantId=${tenantId}` : ''}`);
  };

  if (loading) {
    return (
      <div className="admin-edit-loading-container">
        <div className="admin-edit-loading-spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-edit-error-container">
        <div className="admin-edit-error-alert">
          <span className="admin-edit-error-icon">⚠️</span>
          <span className="admin-edit-error-message">{error}</span>
        </div>
        <button className="admin-edit-primary-button" onClick={() => navigate('/admin/users')}>
          Back to Patient Management
        </button>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="admin-edit-error-container">
        <div className="admin-edit-error-alert">
          <span className="admin-edit-error-icon">❌</span>
          <span className="admin-edit-error-message">Patient not found</span>
        </div>
        <button className="admin-edit-primary-button" onClick={() => navigate('/admin/users')}>
          Back to Patient Management
        </button>
      </div>
    );
  }

  return (
    <div className="admin-edit-container">
      {/* Header */}
      <div className="admin-edit-header">
        <div className="admin-edit-header-left">
          <button className="admin-edit-back-button" onClick={handleCancel}>
            <span className="admin-edit-back-icon">←</span>
          </button>
          <div className="admin-edit-patient-info">
            <h1 className="admin-edit-patient-name">
              Edit Patient: {patient.firstName} {patient.lastName}
            </h1>
            <p className="admin-edit-patient-email">{patient.email}</p>
            {tenant && (
              <p className="admin-edit-patient-clinic">
                📍 {tenant.name}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="admin-edit-tab-navigation">
        <button 
          className={`admin-edit-tab-button ${activeTab === 'personal' ? 'active' : ''}`}
          onClick={() => setActiveTab('personal')}
        >
          Personal Info
        </button>
        <button 
          className={`admin-edit-tab-button ${activeTab === 'medical' ? 'active' : ''}`}
          onClick={() => setActiveTab('medical')}
        >
          Medical History
        </button>
        <button 
          className={`admin-edit-tab-button ${activeTab === 'care' ? 'active' : ''}`}
          onClick={() => setActiveTab('care')}
        >
          Care Team
        </button>
        <button 
          className={`admin-edit-tab-button ${activeTab === 'lifestyle' ? 'active' : ''}`}
          onClick={() => setActiveTab('lifestyle')}
        >
          Lifestyle
        </button>
        <button 
          className={`admin-edit-tab-button ${activeTab === 'emergency' ? 'active' : ''}`}
          onClick={() => setActiveTab('emergency')}
        >
          Emergency Contact
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="admin-edit-form">
        {/* Tab Content */}
        <div className="admin-edit-tab-content">
          {activeTab === 'personal' && (
            <PersonalInfoTab formData={formData} handleInputChange={handleInputChange} />
          )}
          {activeTab === 'medical' && (
            <MedicalHistoryTab formData={formData} handleInputChange={handleInputChange} />
          )}
          {activeTab === 'care' && (
            <CareTeamTab formData={formData} handleInputChange={handleInputChange} />
          )}
          {activeTab === 'lifestyle' && (
            <LifestyleTab formData={formData} handleInputChange={handleInputChange} />
          )}
          {activeTab === 'emergency' && (
            <EmergencyContactTab formData={formData} handleInputChange={handleInputChange} />
          )}
        </div>

        {/* Form Actions */}
        <div className="admin-edit-form-actions">
          <button 
            type="button" 
            className="admin-edit-cancel-button"
            onClick={handleCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="admin-edit-save-button"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

// Personal Info Tab Component
const PersonalInfoTab = ({ formData, handleInputChange }) => {
  return (
    <div className="admin-edit-tab-panel">
      <div className="admin-edit-section-card">
        <h3 className="admin-edit-section-title">Basic Information</h3>
        
        <div className="admin-edit-form-grid">
          <div className="admin-edit-form-group">
            <label className="admin-edit-form-label">First Name</label>
            <input
              type="text"
              name="firstName"
              value={formData.firstName || ''}
              onChange={handleInputChange}
              className="admin-edit-form-input"
            />
          </div>
          
          <div className="admin-edit-form-group">
            <label className="admin-edit-form-label">Last Name</label>
            <input
              type="text"
              name="lastName"
              value={formData.lastName || ''}
              onChange={handleInputChange}
              className="admin-edit-form-input"
            />
          </div>
          
          <div className="admin-edit-form-group">
            <label className="admin-edit-form-label">Middle Name</label>
            <input
              type="text"
              name="middleName"
              value={formData.middleName || ''}
              onChange={handleInputChange}
              className="admin-edit-form-input"
            />
          </div>
          
          <div className="admin-edit-form-group">
            <label className="admin-edit-form-label">Nickname</label>
            <input
              type="text"
              name="nickname"
              value={formData.nickname || ''}
              onChange={handleInputChange}
              className="admin-edit-form-input"
            />
          </div>
          
          <div className="admin-edit-form-group">
            <label className="admin-edit-form-label">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email || ''}
              onChange={handleInputChange}
              className="admin-edit-form-input"
            />
          </div>
          
          <div className="admin-edit-form-group">
            <label className="admin-edit-form-label">Birthdate</label>
            <input
              type="date"
              name="birthdate"
              value={formData.birthdate ? new Date(formData.birthdate).toISOString().split('T')[0] : ''}
              onChange={handleInputChange}
              className="admin-edit-form-input"
            />
          </div>
          
          <div className="admin-edit-form-group">
            <label className="admin-edit-form-label">Age</label>
            <input
              type="number"
              name="age"
              value={formData.age || ''}
              onChange={handleInputChange}
              className="admin-edit-form-input"
            />
          </div>
          
          <div className="admin-edit-form-group">
            <label className="admin-edit-form-label">Gender</label>
            <select
              name="gender"
              value={formData.gender || ''}
              onChange={handleInputChange}
              className="admin-edit-form-select"
            >
              <option value="">Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Non-Binary">Non-Binary</option>
              <option value="Other">Other</option>
            </select>
          </div>
          
          <div className="admin-edit-form-group">
            <label className="admin-edit-form-label">Pronouns</label>
            <input
              type="text"
              name="pronouns"
              value={formData.pronouns || ''}
              onChange={handleInputChange}
              className="admin-edit-form-input"
              placeholder="e.g., he/him, she/her, they/them"
            />
          </div>
          
          <div className="admin-edit-form-group admin-edit-full-width">
            <label className="admin-edit-form-label">Location</label>
            <input
              type="text"
              name="location"
              value={formData.location || ''}
              onChange={handleInputChange}
              className="admin-edit-form-input"
            />
          </div>

          <div className="admin-edit-form-group">
            <label className="admin-edit-form-label">Account Status</label>
            <select
              name="accountStatus"
              value={formData.accountStatus || 'active'}
              onChange={handleInputChange}
              className="admin-edit-form-select"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

// Medical History Tab Component
const MedicalHistoryTab = ({ formData, handleInputChange }) => {
  return (
    <div className="admin-edit-tab-panel">
      <div className="admin-edit-section-card">
        <h3 className="admin-edit-section-title">Mental Health History</h3>
        
        <div className="admin-edit-form-grid">
          <div className="admin-edit-form-group admin-edit-full-width">
            <label className="admin-edit-form-label">Diagnosis</label>
            <textarea
              name="diagnosis"
              value={formData.diagnosis || ''}
              onChange={handleInputChange}
              className="admin-edit-form-textarea"
              rows="3"
            />
          </div>
          
          <div className="admin-edit-form-group admin-edit-full-width">
            <label className="admin-edit-form-label">Treatment History</label>
            <textarea
              name="treatmentHistory"
              value={formData.treatmentHistory || ''}
              onChange={handleInputChange}
              className="admin-edit-form-textarea"
              rows="3"
            />
          </div>
          
          <div className="admin-edit-form-group">
            <label className="admin-edit-form-label">Symptoms Frequency</label>
            <select
              name="symptomsFrequency"
              value={formData.symptomsFrequency || ''}
              onChange={handleInputChange}
              className="admin-edit-form-select"
            >
              <option value="">Select Frequency</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="rarely">Rarely</option>
              <option value="never">Never</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

// Care Team Tab Component
const CareTeamTab = ({ formData, handleInputChange }) => {
  return (
    <div className="admin-edit-tab-panel">
      <div className="admin-edit-section-card">
        <h3 className="admin-edit-section-title">Care Team Information</h3>
        
        <div className="admin-edit-form-grid">
          <div className="admin-edit-form-group">
            <label className="admin-edit-form-label">Has Mental Health Doctor</label>
            <select
              name="hasMentalHealthDoctor"
              value={formData.hasMentalHealthDoctor || ''}
              onChange={handleInputChange}
              className="admin-edit-form-select"
            >
              <option value="">Select</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
          
          <div className="admin-edit-form-group">
            <label className="admin-edit-form-label">Primary Doctor</label>
            <input
              type="text"
              name="primaryDoctor"
              value={formData.primaryDoctor || ''}
              onChange={handleInputChange}
              className="admin-edit-form-input"
            />
          </div>
          
          <div className="admin-edit-form-group">
            <label className="admin-edit-form-label">Doctor Contact</label>
            <input
              type="text"
              name="doctorContact"
              value={formData.doctorContact || ''}
              onChange={handleInputChange}
              className="admin-edit-form-input"
            />
          </div>
          
          <div className="admin-edit-form-group">
            <label className="admin-edit-form-label">Therapist Name</label>
            <input
              type="text"
              name="therapistName"
              value={formData.therapistName || ''}
              onChange={handleInputChange}
              className="admin-edit-form-input"
            />
          </div>
          
          <div className="admin-edit-form-group">
            <label className="admin-edit-form-label">Therapist Contact</label>
            <input
              type="text"
              name="therapistContact"
              value={formData.therapistContact || ''}
              onChange={handleInputChange}
              className="admin-edit-form-input"
            />
          </div>
          
          <div className="admin-edit-form-group">
            <label className="admin-edit-form-label">Insurance Provider</label>
            <input
              type="text"
              name="insuranceProvider"
              value={formData.insuranceProvider || ''}
              onChange={handleInputChange}
              className="admin-edit-form-input"
            />
          </div>
          
          <div className="admin-edit-form-group">
            <label className="admin-edit-form-label">Insurance Number</label>
            <input
              type="text"
              name="insuranceNumber"
              value={formData.insuranceNumber || ''}
              onChange={handleInputChange}
              className="admin-edit-form-input"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Lifestyle Tab Component
const LifestyleTab = ({ formData, handleInputChange }) => {
  return (
    <div className="admin-edit-tab-panel">
      <div className="admin-edit-section-card">
        <h3 className="admin-edit-section-title">Lifestyle Information</h3>
        
        <div className="admin-edit-form-grid">
          <div className="admin-edit-form-group">
            <label className="admin-edit-form-label">Occupation</label>
            <input
              type="text"
              name="occupation"
              value={formData.occupation || ''}
              onChange={handleInputChange}
              className="admin-edit-form-input"
            />
          </div>
          
          <div className="admin-edit-form-group">
            <label className="admin-edit-form-label">Work Status</label>
            <select
              name="workStatus"
              value={formData.workStatus || ''}
              onChange={handleInputChange}
              className="admin-edit-form-select"
            >
              <option value="">Select Status</option>
              <option value="full-time">Full-time</option>
              <option value="part-time">Part-time</option>
              <option value="unemployed">Unemployed</option>
              <option value="student">Student</option>
              <option value="retired">Retired</option>
            </select>
          </div>
          
          <div className="admin-edit-form-group">
            <label className="admin-edit-form-label">Living Arrangement</label>
            <input
              type="text"
              name="livingArrangement"
              value={formData.livingArrangement || ''}
              onChange={handleInputChange}
              className="admin-edit-form-input"
            />
          </div>
          
          <div className="admin-edit-form-group">
            <label className="admin-edit-form-label">Exercise Frequency</label>
            <select
              name="exerciseFrequency"
              value={formData.exerciseFrequency || ''}
              onChange={handleInputChange}
              className="admin-edit-form-select"
            >
              <option value="">Select Frequency</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="rarely">Rarely</option>
              <option value="never">Never</option>
            </select>
          </div>
          
          <div className="admin-edit-form-group admin-edit-full-width">
            <label className="admin-edit-form-label">Dietary Patterns</label>
            <textarea
              name="dietaryPatterns"
              value={formData.dietaryPatterns || ''}
              onChange={handleInputChange}
              className="admin-edit-form-textarea"
              rows="2"
            />
          </div>
          
          <div className="admin-edit-form-group admin-edit-full-width">
            <label className="admin-edit-form-label">Sleep Patterns</label>
            <textarea
              name="sleepPatterns"
              value={formData.sleepPatterns || ''}
              onChange={handleInputChange}
              className="admin-edit-form-textarea"
              rows="2"
            />
          </div>
          
          <div className="admin-edit-form-group admin-edit-full-width">
            <label className="admin-edit-form-label">Hobbies</label>
            <textarea
              name="hobbies"
              value={formData.hobbies || ''}
              onChange={handleInputChange}
              className="admin-edit-form-textarea"
              rows="2"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Emergency Contact Tab Component
const EmergencyContactTab = ({ formData, handleInputChange }) => {
  return (
    <div className="admin-edit-tab-panel">
      <div className="admin-edit-section-card">
        <h3 className="admin-edit-section-title">Emergency Contact Information</h3>
        
        <div className="admin-edit-form-grid">
          <div className="admin-edit-form-group">
            <label className="admin-edit-form-label">Emergency Contact Name</label>
            <input
              type="text"
              name="emergencyName"
              value={formData.emergencyName || ''}
              onChange={handleInputChange}
              className="admin-edit-form-input"
            />
          </div>
          
          <div className="admin-edit-form-group">
            <label className="admin-edit-form-label">Relationship</label>
            <input
              type="text"
              name="emergencyRelationship"
              value={formData.emergencyRelationship || ''}
              onChange={handleInputChange}
              className="admin-edit-form-input"
            />
          </div>
          
          <div className="admin-edit-form-group">
            <label className="admin-edit-form-label">Phone Number</label>
            <input
              type="tel"
              name="emergencyPhone"
              value={formData.emergencyPhone || ''}
              onChange={handleInputChange}
              className="admin-edit-form-input"
            />
          </div>
          
          <div className="admin-edit-form-group">
            <label className="admin-edit-form-label">Email Address</label>
            <input
              type="email"
              name="emergencyEmail"
              value={formData.emergencyEmail || ''}
              onChange={handleInputChange}
              className="admin-edit-form-input"
            />
          </div>
          
          <div className="admin-edit-form-group admin-edit-full-width">
            <label className="admin-edit-form-label">Address</label>
            <textarea
              name="emergencyAddress"
              value={formData.emergencyAddress || ''}
              onChange={handleInputChange}
              className="admin-edit-form-textarea"
              rows="2"
            />
          </div>
          
          <div className="admin-edit-form-group">
            <label className="admin-edit-form-label">Contact Aware of Emergency Role</label>
            <select
              name="emergencyAware"
              value={formData.emergencyAware || ''}
              onChange={handleInputChange}
              className="admin-edit-form-select"
            >
              <option value="">Select</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPatientEdit;