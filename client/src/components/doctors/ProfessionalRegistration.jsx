// ProfessionalRegistration.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import '../../styles/components/doctor/ProfessionalRegistration.css';
// Import the logo image
import neurolexLogo from '../../assets/images/NeurolexLogo_White.png';

const ProfessionalRegistration = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [tenants, setTenants] = useState([]);
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    // Step 1: Personal Information
    tenantId: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    personalContactNumber: '',
    clinicLocation: '',
    clinicContactNumber: '',
    
    // Step 2: Professional Information
    specialty: '',
    title: '',
    areasOfExpertise: '',
    experience: '',
    
    // Step 3: Availability
    availability: {
      monday: { available: false, slots: [] },
      tuesday: { available: false, slots: [] },
      wednesday: { available: false, slots: [] },
      thursday: { available: false, slots: [] },
      friday: { available: false, slots: [] },
      saturday: { available: false, slots: [] },
      sunday: { available: false, slots: [] }
    },
    appointmentTypes: {
      inPerson: false,
      telehealth: false
    },
    
    // Step 4: Credentials
    education: [],
    licenses: [],
    certifications: [],
    
    // Document uploads
    licenseDocument: null,
    educationCertificate: null,
    additionalDocuments: [],
    
    // Terms
    termsAccepted: false,
  });

  // Fetch available tenants on component mount
  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const response = await axios.get('/api/auth/tenants');
        if (response.data.success) {
          setTenants(response.data.data);
          
          // Check for tenant ID in URL query params (if provided)
          const params = new URLSearchParams(location.search);
          const tenantParam = params.get('tenant');
          
          if (tenantParam && response.data.data.some(t => t._id === tenantParam)) {
            setFormData(prev => ({ ...prev, tenantId: tenantParam }));
          } else if (response.data.data.length > 0) {
            // Set first tenant as default if no tenant specified
            setFormData(prev => ({ ...prev, tenantId: response.data.data[0]._id }));
          }
        }
      } catch (error) {
        console.error('Error fetching tenants:', error);
      }
    };
    
    fetchTenants();
  }, [location]);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (type === 'checkbox') {
      if (name.includes('appointmentTypes.')) {
        const appointmentType = name.split('.')[1];
        setFormData(prev => ({
          ...prev,
          appointmentTypes: {
            ...prev.appointmentTypes,
            [appointmentType]: checked
          }
        }));
      } else {
        setFormData({ ...formData, [name]: checked });
      }
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  // Handle availability changes
  const handleAvailabilityChange = (day, field, value) => {
    setFormData(prev => ({
      ...prev,
      availability: {
        ...prev.availability,
        [day]: {
          ...prev.availability[day],
          [field]: value
        }
      }
    }));
  };

  // Add time slot for availability
  const addTimeSlot = (day) => {
    setFormData(prev => ({
      ...prev,
      availability: {
        ...prev.availability,
        [day]: {
          ...prev.availability[day],
          slots: [...prev.availability[day].slots, { startTime: '', endTime: '' }]
        }
      }
    }));
  };

  // Handle time slot changes
  const handleTimeSlotChange = (day, slotIndex, field, value) => {
    setFormData(prev => {
      const newSlots = [...prev.availability[day].slots];
      newSlots[slotIndex] = { ...newSlots[slotIndex], [field]: value };
      return {
        ...prev,
        availability: {
          ...prev.availability,
          [day]: {
            ...prev.availability[day],
            slots: newSlots
          }
        }
      };
    });
  };

  // Add credential entry
  const addCredential = (type) => {
    const newCredential = {
      id: Date.now(),
      institution: '',
      degree: '',
      year: '',
      licenseNumber: '',
      issuingAuthority: '',
      expirationDate: ''
    };
    
    setFormData(prev => ({
      ...prev,
      [type]: [...prev[type], newCredential]
    }));
  };

  // Handle credential changes
  const handleCredentialChange = (type, id, field, value) => {
    setFormData(prev => ({
      ...prev,
      [type]: prev[type].map(item => 
        item.id === id ? { ...item, [field]: value } : item
      )
    }));
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Create FormData object
      const submitData = new FormData();
      
      // Append non-file form fields
      Object.keys(formData).forEach(key => {
        // Skip file fields as they're handled separately
        if (!['licenseDocument', 'educationCertificate', 'additionalDocuments'].includes(key)) {
          if (typeof formData[key] === 'object' && formData[key] !== null) {
            submitData.append(key, JSON.stringify(formData[key]));
          } else if (formData[key] !== null && formData[key] !== undefined && formData[key] !== '') {
            submitData.append(key, formData[key]);
          }
        }
      });
      
      // Explicitly add role (tenantId is already added above)
      submitData.append('role', 'doctor');
      
      // Append file fields
      if (formData.licenseDocument) {
        submitData.append('licenseDocument', formData.licenseDocument);
      }
      
      if (formData.educationCertificate) {
        submitData.append('educationCertificate', formData.educationCertificate);
      }
      
      // Handle additional documents array
      if (formData.additionalDocuments && formData.additionalDocuments.length > 0) {
        formData.additionalDocuments.forEach((file, index) => {
          if (file) {
            submitData.append(`additionalDocuments`, file);
          }
        });
      }
      
      // Submit to server
      const response = await axios.post('/api/auth/register', submitData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (response.data.success) {
        navigate('/verification-pending');
      }
    } catch (error) {
      console.error('Registration failed:', error);
      // Handle error display here
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Move to next step in multi-step form
  const nextStep = () => {
    setStep(step + 1);
  };
  
  // Move to previous step in multi-step form
  const prevStep = () => {
    setStep(step - 1);
  };
  
  // Render step 1: Personal Information
  const renderStepOne = () => (
    <div className="registration-step">
      <h3>Personal Information</h3>
      
      <div className="form-group">
        <label htmlFor="tenantId">Clinic Location *</label>
        <select
          id="tenantId"
          name="tenantId"
          value={formData.tenantId}
          onChange={handleChange}
          required
        >
          <option value="">Select a clinic</option>
          {tenants.map(tenant => (
            <option key={tenant._id} value={tenant._id}>
              {tenant.name}
            </option>
          ))}
        </select>
      </div>
      
      <div className="form-group">
        <label htmlFor="firstName">First Name *</label>
        <input
          type="text"
          id="firstName"
          name="firstName"
          value={formData.firstName}
          onChange={handleChange}
          required
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="lastName">Last Name *</label>
        <input
          type="text"
          id="lastName"
          name="lastName"
          value={formData.lastName}
          onChange={handleChange}
          required
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="email">Email Address *</label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          required
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="password">Password *</label>
        <input
          type="password"
          id="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          required
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="confirmPassword">Confirm Password *</label>
        <input
          type="password"
          id="confirmPassword"
          name="confirmPassword"
          value={formData.confirmPassword}
          onChange={handleChange}
          required
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="personalContactNumber">Personal Contact Number</label>
        <input
          type="tel"
          id="personalContactNumber"
          name="personalContactNumber"
          value={formData.personalContactNumber}
          onChange={handleChange}
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="clinicLocation">Clinic Location</label>
        <input
          type="text"
          id="clinicLocation"
          name="clinicLocation"
          value={formData.clinicLocation}
          onChange={handleChange}
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="clinicContactNumber">Clinic Contact Number</label>
        <input
          type="tel"
          id="clinicContactNumber"
          name="clinicContactNumber"
          value={formData.clinicContactNumber}
          onChange={handleChange}
        />
      </div>
      
      <div className="form-actions">
        <button type="button" onClick={nextStep} className="btn-primary">
          Next Step
        </button>
      </div>
    </div>
  );
  
  // Render step 2: Professional Information
  const renderStepTwo = () => (
    <div className="registration-step">
      <h3>Professional Information</h3>
      
      <div className="form-group">
        <label htmlFor="specialty">Specialty *</label>
        <select
          id="specialty"
          name="specialty"
          value={formData.specialty}
          onChange={handleChange}
          required
        >
          <option value="">Select specialization</option>
          <option value="Psychiatrist">Psychiatrist</option>
          <option value="Psychologist">Psychologist</option>
          <option value="Clinical Psychologist">Clinical Psychologist</option>
          <option value="Therapist">Therapist</option>
          <option value="Counselor">Counselor</option>
          <option value="Social Worker">Social Worker</option>
          <option value="Psychiatric Nurse">Psychiatric Nurse</option>
          <option value="Other">Other</option>
        </select>
      </div>
      
      <div className="form-group">
        <label htmlFor="title">Professional Title</label>
        <select
          id="title"
          name="title"
          value={formData.title}
          onChange={handleChange}
        >
          <option value="">Select a title</option>
          <option value="Dr.">Dr.</option>
          <option value="Professor">Professor</option>
          <option value="Therapist">Therapist</option>
          <option value="Counselor">Counselor</option>
          <option value="Other">Other</option>
        </select>
      </div>
      
      <div className="form-group">
        <label htmlFor="areasOfExpertise">Areas of Expertise</label>
        <input
          type="text"
          id="areasOfExpertise"
          name="areasOfExpertise"
          value={formData.areasOfExpertise}
          onChange={handleChange}
          placeholder="e.g., Anxiety Disorders, Depression, PTSD"
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="experience">Experience *</label>
        <input
          type="text"
          id="experience"
          name="experience"
          value={formData.experience}
          onChange={handleChange}
          placeholder="e.g., 5 years, 10+ years"
          required
        />
      </div>
      
      <div className="form-actions">
        <button type="button" onClick={prevStep} className="btn-secondary">
          Back
        </button>
        <button type="button" onClick={nextStep} className="btn-primary">
          Next Step
        </button>
      </div>
    </div>
  );
  
  // Render step 3: Availability
  const renderStepThree = () => (
    <div className="registration-step">
      <h3>Availability</h3>
      
      <div className="form-group">
        <label>Select days you're available and set specific hours for each day *</label>
        <div className="availability-section">
          {Object.keys(formData.availability).map(day => (
            <div key={day} className="day-availability">
              <div className="day-header">
                <input
                  type="checkbox"
                  id={`${day}-available`}
                  checked={formData.availability[day].available}
                  onChange={(e) => handleAvailabilityChange(day, 'available', e.target.checked)}
                />
                <label htmlFor={`${day}-available`} className="day-label">
                  {day.charAt(0).toUpperCase() + day.slice(1)}
                </label>
              </div>
              
              {formData.availability[day].available && (
                <div className="time-slots">
                  {formData.availability[day].slots.map((slot, index) => (
                    <div key={index} className="time-slot">
                      <input
                        type="time"
                        value={slot.startTime}
                        onChange={(e) => handleTimeSlotChange(day, index, 'startTime', e.target.value)}
                        placeholder="Start time"
                      />
                      <span>to</span>
                      <input
                        type="time"
                        value={slot.endTime}
                        onChange={(e) => handleTimeSlotChange(day, index, 'endTime', e.target.value)}
                        placeholder="End time"
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addTimeSlot(day)}
                    className="btn-add-slot"
                  >
                    + Add Time Slot
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      
      <div className="form-group">
        <label>Appointment Types *</label>
        <div className="checkbox-group">
          <div>
            <input
              type="checkbox"
              id="inPerson"
              name="appointmentTypes.inPerson"
              checked={formData.appointmentTypes.inPerson}
              onChange={handleChange}
            />
            <label htmlFor="inPerson">In-Person</label>
          </div>
          <div>
            <input
              type="checkbox"
              id="telehealth"
              name="appointmentTypes.telehealth"
              checked={formData.appointmentTypes.telehealth}
              onChange={handleChange}
            />
            <label htmlFor="telehealth">Telehealth</label>
          </div>
        </div>
      </div>
      
      <div className="form-actions">
        <button type="button" onClick={prevStep} className="btn-secondary">
          Back
        </button>
        <button type="button" onClick={nextStep} className="btn-primary">
          Next Step
        </button>
      </div>
    </div>
  );
  
  // Render step 4: Credentials
  const renderStepFour = () => (
    <div className="registration-step">
      <h3>Credentials</h3>
      
      {/* Education Section */}
      <div className="form-group">
        <label>Education *</label>
        <div className="credentials-section">
          {formData.education.map((edu, index) => (
            <div key={edu.id} className="credential-item">
              <input
                type="text"
                placeholder="Degree / Qualification"
                value={edu.degree}
                onChange={(e) => handleCredentialChange('education', edu.id, 'degree', e.target.value)}
              />
              <input
                type="text"
                placeholder="Institution"
                value={edu.institution}
                onChange={(e) => handleCredentialChange('education', edu.id, 'institution', e.target.value)}
              />
              <input
                type="number"
                placeholder="Year"
                value={edu.year}
                onChange={(e) => handleCredentialChange('education', edu.id, 'year', e.target.value)}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => addCredential('education')}
            className="btn-add-credential"
          >
            + Add Education
          </button>
        </div>
      </div>
      
      {/* Licenses Section */}
      <div className="form-group">
        <label>Licenses *</label>
        <div className="credentials-section">
          {formData.licenses.map((license, index) => (
            <div key={license.id} className="credential-item">
              <input
                type="text"
                placeholder="License Type"
                value={license.degree}
                onChange={(e) => handleCredentialChange('licenses', license.id, 'degree', e.target.value)}
              />
              <input
                type="text"
                placeholder="License #"
                value={license.licenseNumber}
                onChange={(e) => handleCredentialChange('licenses', license.id, 'licenseNumber', e.target.value)}
              />
              <input
                type="date"
                placeholder="Expiration Date"
                value={license.expirationDate}
                onChange={(e) => handleCredentialChange('licenses', license.id, 'expirationDate', e.target.value)}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => addCredential('licenses')}
            className="btn-add-credential"
          >
            + Add License
          </button>
        </div>
      </div>
      
      {/* Certifications Section */}
      <div className="form-group">
        <label>Certifications</label>
        <div className="credentials-section">
          {formData.certifications.map((cert, index) => (
            <div key={cert.id} className="credential-item">
              <input
                type="text"
                placeholder="Certification Name"
                value={cert.degree}
                onChange={(e) => handleCredentialChange('certifications', cert.id, 'degree', e.target.value)}
              />
              <input
                type="text"
                placeholder="Issuing Authority"
                value={cert.issuingAuthority}
                onChange={(e) => handleCredentialChange('certifications', cert.id, 'issuingAuthority', e.target.value)}
              />
              <input
                type="number"
                placeholder="Year"
                value={cert.year}
                onChange={(e) => handleCredentialChange('certifications', cert.id, 'year', e.target.value)}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => addCredential('certifications')}
            className="btn-add-credential"
          >
            + Add Certification
          </button>
        </div>
      </div>
      
      {/* Proof of Documents Section */}
      <div className="form-group">
        <label>Proof of Credentials</label>
        
        {/* License Document */}
        <div className="document-section">
          <label>License Document *</label>
          <div className="file-upload-area">
            <input
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={(e) => setFormData(prev => ({ ...prev, licenseDocument: e.target.files[0] }))}
              id="licenseDocument"
              required
            />
            <label htmlFor="licenseDocument" className="file-upload-button">
              Choose File
            </label>
            <span className="file-name">
              {formData.licenseDocument ? formData.licenseDocument.name : 'No file chosen'}
            </span>
          </div>
        </div>
        
        {/* Education Certificate */}
        <div className="document-section">
          <label>Education Certificate *</label>
          <div className="file-upload-area">
            <input
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={(e) => setFormData(prev => ({ ...prev, educationCertificate: e.target.files[0] }))}
              id="educationCertificate"
              required
            />
            <label htmlFor="educationCertificate" className="file-upload-button">
              Choose File
            </label>
            <span className="file-name">
              {formData.educationCertificate ? formData.educationCertificate.name : 'No file chosen'}
            </span>
          </div>
        </div>
        
        {/* Additional Documents */}
        <div className="document-section">
          <label>Additional Documents</label>
          <small>You can select multiple files</small>
          <div className="additional-documents">
            {formData.additionalDocuments.map((doc, index) => (
              <div key={index} className="file-upload-area">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const newDocs = [...formData.additionalDocuments];
                    newDocs[index] = e.target.files[0];
                    setFormData(prev => ({ ...prev, additionalDocuments: newDocs }));
                  }}
                  id={`additionalDoc-${index}`}
                />
                <label htmlFor={`additionalDoc-${index}`} className="file-upload-button">
                  Choose File
                </label>
                <span className="file-name">
                  {doc ? doc.name : 'No file chosen'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const newDocs = formData.additionalDocuments.filter((_, i) => i !== index);
                    setFormData(prev => ({ ...prev, additionalDocuments: newDocs }));
                  }}
                  className="btn-remove-file"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                setFormData(prev => ({ 
                  ...prev, 
                  additionalDocuments: [...prev.additionalDocuments, null] 
                }));
              }}
              className="btn-add-file"
            >
              + Add Another Document
            </button>
          </div>
        </div>
      </div>
      
      <div className="form-group checkbox-group">
        <div>
          <input
            type="checkbox"
            id="termsAccepted"
            name="termsAccepted"
            checked={formData.termsAccepted}
            onChange={handleChange}
            required
          />
          <label htmlFor="termsAccepted">
            I agree to the <a href="/terms" target="_blank">Terms of Service</a> *
          </label>
        </div>
      </div>
      
      <div className="verification-notice">
        <p>
          <strong>Important:</strong> Your application will be reviewed by our administrative team.
          You will receive an email notification once your professional status has been verified.
          This process typically takes 1-3 business days.
        </p>
      </div>
      
      <div className="form-actions">
        <button type="button" onClick={prevStep} className="btn-secondary">
          Back
        </button>
        <button 
          type="submit" 
          className="btn-primary"
          disabled={isSubmitting || !formData.termsAccepted}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Registration'}
        </button>
      </div>
    </div>
  );
  
  return (
    <div className="registration-page-container">
      {/* Two-column layout */}
      <div className="registration-layout">
        {/* Left column - Logo only */}
        <div className="registration-logo-container">
          <div className="logo-content">
            <div className="logo-wrapper">
              <img src={neurolexLogo} alt="Neurolex Logo" className="logo-image" />
            </div>
          </div>
        </div>
        
        {/* Right column - Registration form */}
        <div className="registration-form-container">
          <div className="form-header">
            <h2>Mental Health Professional Registration</h2>
            
            {/* Display the selected tenant name if available */}
            {formData.tenantId && tenants.length > 0 && (
              <div className="selected-tenant">
                <p>Registering with: <strong>{tenants.find(t => t._id === formData.tenantId)?.name}</strong></p>
              </div>
            )}
            
            <div className="registration-progress">
              <div className={`progress-step ${step >= 1 ? 'active' : ''}`}>Personal</div>
              <div className={`progress-step ${step >= 2 ? 'active' : ''}`}>Professional</div>
              <div className={`progress-step ${step >= 3 ? 'active' : ''}`}>Availability</div>
              <div className={`progress-step ${step >= 4 ? 'active' : ''}`}>Credentials</div>
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="professional-registration-form">
            {step === 1 && renderStepOne()}
            {step === 2 && renderStepTwo()}
            {step === 3 && renderStepThree()}
            {step === 4 && renderStepFour()}
          </form>
          
          <div className="login-link">
            <p>Already have an account? <a href="/login">Sign In</a></p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfessionalRegistration;