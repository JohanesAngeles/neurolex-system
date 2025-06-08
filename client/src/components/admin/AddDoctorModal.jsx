// AddDoctorModal.jsx - Admin Add Doctor Form Modal
import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import '../../styles/components/admin/AddDoctorModal.css';
import adminService from '../../services/adminService';

const AddDoctorModal = ({ isOpen, onClose, onDoctorAdded }) => {
  const [tenants, setTenants] = useState([]);
  const [isLoadingTenants, setIsLoadingTenants] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    // Step 1: Basic Information
    tenantId: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    personalContactNumber: '',
    clinicLocation: '',
    clinicContactNumber: '',
    
    // Step 2: Professional Information
    specialty: '',
    title: '',
    areasOfExpertise: '',
    experience: '',
    
    // Step 3: Credentials (simplified)
    licenseNumber: '',
    licenseIssuingAuthority: '',
    licenseExpiryDate: '',
    education: '',
    
    // Admin specific
    verificationNotes: '',
    // Auto-approved status
    verificationStatus: 'approved',
    role: 'doctor'
  });

  // Specialization options
  const specializations = [
    'Psychiatrist',
    'Psychologist', 
    'Clinical Psychologist',
    'Mental Health Counselor',
    'Clinical Social Worker',
    'Marriage and Family Therapist',
    'Therapist',
    'Counselor',
    'Social Worker',
    'Psychiatric Nurse',
    'Other'
  ];

  // Professional titles
  const professionalTitles = [
    'Dr.',
    'Professor',
    'Therapist',
    'Counselor',
    'Other'
  ];

  // Fetch tenants when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchTenants();
      resetForm();
    }
  }, [isOpen]);

  const fetchTenants = async () => {
    try {
      setIsLoadingTenants(true);
      console.log('🔄 Fetching tenants for admin add doctor...');
      
      const response = await adminService.getTenants();
      console.log('✅ Tenants fetched:', response);
      
      let tenantsData = [];
      if (response && response.data) {
        tenantsData = response.data;
      } else if (Array.isArray(response)) {
        tenantsData = response;
      }
      
      if (Array.isArray(tenantsData) && tenantsData.length > 0) {
        setTenants(tenantsData);
        // Auto-select first tenant if only one exists
        if (tenantsData.length === 1) {
          setFormData(prev => ({ ...prev, tenantId: tenantsData[0]._id }));
        }
      } else {
        console.log('⚠️ No tenants data found');
        toast.warning('No clinics available. Please add a clinic first.');
      }
    } catch (error) {
      console.error('❌ Error fetching tenants:', error);
      toast.error('Failed to load clinics. Please try again.');
    } finally {
      setIsLoadingTenants(false);
    }
  };

  const resetForm = () => {
    setFormData({
      tenantId: '',
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      personalContactNumber: '',
      clinicLocation: '',
      clinicContactNumber: '',
      specialty: '',
      title: '',
      areasOfExpertise: '',
      experience: '',
      licenseNumber: '',
      licenseIssuingAuthority: '',
      licenseExpiryDate: '',
      education: '',
      verificationNotes: '',
      verificationStatus: 'approved',
      role: 'doctor'
    });
    setStep(1);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateStep = (stepNumber) => {
    const errors = [];
    
    switch (stepNumber) {
      case 1:
        if (!formData.tenantId) errors.push('Please select a clinic');
        if (!formData.firstName.trim()) errors.push('First name is required');
        if (!formData.lastName.trim()) errors.push('Last name is required');
        if (!formData.email.trim()) errors.push('Email is required');
        if (!formData.email.includes('@')) errors.push('Valid email is required');
        if (!formData.password.trim()) errors.push('Password is required');
        if (formData.password.length < 6) errors.push('Password must be at least 6 characters');
        break;
        
      case 2:
        if (!formData.specialty) errors.push('Specialty is required');
        if (!formData.experience.trim()) errors.push('Experience is required');
        break;
        
      case 3:
        if (!formData.licenseNumber.trim()) errors.push('License number is required');
        if (!formData.licenseIssuingAuthority.trim()) errors.push('License issuing authority is required');
        if (!formData.education.trim()) errors.push('Education information is required');
        break;
    }
    
    if (errors.length > 0) {
      errors.forEach(error => toast.error(error));
      return false;
    }
    
    return true;
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    setStep(step - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateStep(3)) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      console.log('🔄 Admin adding doctor with data:', formData);
      
      // Prepare the data for submission
      const doctorData = {
        ...formData,
        // Ensure these fields are set for admin-added doctors
        verificationStatus: 'approved',
        verificationDate: new Date().toISOString(),
        isAdminAdded: true,
        verificationNotes: formData.verificationNotes || 'Added by admin - automatically approved'
      };
      
      // Call the API to add doctor
      const response = await adminService.addDoctor(doctorData);
      
      console.log('✅ Doctor added successfully:', response);
      toast.success('Doctor added and approved successfully!');
      
      // Call the callback to refresh the parent component
      if (onDoctorAdded) {
        onDoctorAdded();
      }
      
      // Close the modal
      onClose();
      
    } catch (error) {
      console.error('❌ Error adding doctor:', error);
      
      let errorMessage = 'Failed to add doctor. Please try again.';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.errors) {
        const errors = error.response.data.errors;
        if (Array.isArray(errors)) {
          errorMessage = errors.join(', ');
        } else if (typeof errors === 'object') {
          errorMessage = Object.values(errors).join(', ');
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render Step 1: Basic Information
  const renderStepOne = () => (
    <div className="add-doctor-step">
      <h3>Basic Information</h3>
      
      <div className="form-group">
        <label htmlFor="tenantId">Clinic Location *</label>
        <select
          id="tenantId"
          name="tenantId"
          value={formData.tenantId}
          onChange={handleChange}
          disabled={isLoadingTenants}
          required
        >
          <option value="">Select a clinic</option>
          {tenants.map(tenant => (
            <option key={tenant._id} value={tenant._id}>
              {tenant.name}
            </option>
          ))}
        </select>
        {isLoadingTenants && <div className="loading-message">Loading clinics...</div>}
      </div>
      
      <div className="form-row">
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
          placeholder="Minimum 6 characters"
          required
        />
      </div>
      
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="personalContactNumber">Personal Contact</label>
          <input
            type="tel"
            id="personalContactNumber"
            name="personalContactNumber"
            value={formData.personalContactNumber}
            onChange={handleChange}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="clinicContactNumber">Clinic Contact</label>
          <input
            type="tel"
            id="clinicContactNumber"
            name="clinicContactNumber"
            value={formData.clinicContactNumber}
            onChange={handleChange}
          />
        </div>
      </div>
      
      <div className="form-group">
        <label htmlFor="clinicLocation">Clinic Address</label>
        <input
          type="text"
          id="clinicLocation"
          name="clinicLocation"
          value={formData.clinicLocation}
          onChange={handleChange}
          placeholder="Full clinic address"
        />
      </div>
    </div>
  );

  // Render Step 2: Professional Information
  const renderStepTwo = () => (
    <div className="add-doctor-step">
      <h3>Professional Information</h3>
      
      <div className="form-row">
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
            {specializations.map(spec => (
              <option key={spec} value={spec}>{spec}</option>
            ))}
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
            {professionalTitles.map(title => (
              <option key={title} value={title}>{title}</option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="form-group">
        <label htmlFor="experience">Years of Experience *</label>
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
      
      <div className="form-group">
        <label htmlFor="areasOfExpertise">Areas of Expertise</label>
        <textarea
          id="areasOfExpertise"
          name="areasOfExpertise"
          value={formData.areasOfExpertise}
          onChange={handleChange}
          placeholder="e.g., Anxiety Disorders, Depression, PTSD, Trauma Therapy"
          rows={3}
        />
      </div>
    </div>
  );

  // Render Step 3: Credentials & Verification
  const renderStepThree = () => (
    <div className="add-doctor-step">
      <h3>Credentials & Verification</h3>
      
      <div className="form-group">
        <label htmlFor="licenseNumber">License Number *</label>
        <input
          type="text"
          id="licenseNumber"
          name="licenseNumber"
          value={formData.licenseNumber}
          onChange={handleChange}
          required
        />
      </div>
      
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="licenseIssuingAuthority">Issuing Authority *</label>
          <input
            type="text"
            id="licenseIssuingAuthority"
            name="licenseIssuingAuthority"
            value={formData.licenseIssuingAuthority}
            onChange={handleChange}
            placeholder="e.g., State Medical Board"
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="licenseExpiryDate">License Expiry Date</label>
          <input
            type="date"
            id="licenseExpiryDate"
            name="licenseExpiryDate"
            value={formData.licenseExpiryDate}
            onChange={handleChange}
          />
        </div>
      </div>
      
      <div className="form-group">
        <label htmlFor="education">Education *</label>
        <textarea
          id="education"
          name="education"
          value={formData.education}
          onChange={handleChange}
          placeholder="e.g., MD - University of Medicine (2015), Residency - Hospital Name (2018)"
          rows={3}
          required
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="verificationNotes">Admin Notes</label>
        <textarea
          id="verificationNotes"
          name="verificationNotes"
          value={formData.verificationNotes}
          onChange={handleChange}
          placeholder="Internal notes for this doctor account (optional)"
          rows={2}
        />
      </div>
      
      <div className="admin-approval-notice">
        <div className="notice-icon">✅</div>
        <div className="notice-content">
          <h4>Automatic Approval</h4>
          <p>Doctors added by administrators are automatically approved and can start using the platform immediately.</p>
        </div>
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="add-doctor-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <h2 className="modal-title">Add New Doctor</h2>
          <button className="modal-close" onClick={onClose} disabled={isSubmitting}>
            <span className="close-icon">×</span>
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="progress-indicator">
          <div className={`progress-step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
            <span className="step-number">1</span>
            <span className="step-label">Basic Info</span>
          </div>
          <div className={`progress-step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
            <span className="step-number">2</span>
            <span className="step-label">Professional</span>
          </div>
          <div className={`progress-step ${step >= 3 ? 'active' : ''}`}>
            <span className="step-number">3</span>
            <span className="step-label">Credentials</span>
          </div>
        </div>

        {/* Modal Content */}
        <div className="modal-content">
          <form onSubmit={handleSubmit} className="add-doctor-form">
            {step === 1 && renderStepOne()}
            {step === 2 && renderStepTwo()}
            {step === 3 && renderStepThree()}
            
            {/* Form Actions */}
            <div className="form-actions">
              {step > 1 && (
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={prevStep}
                  disabled={isSubmitting}
                >
                  Back
                </button>
              )}
              
              <button 
                type="button" 
                className="btn-cancel" 
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              
              {step < 3 ? (
                <button 
                  type="button" 
                  className="btn-primary" 
                  onClick={nextStep}
                  disabled={isSubmitting}
                >
                  Next Step
                </button>
              ) : (
                <button 
                  type="submit" 
                  className="btn-primary btn-submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Adding Doctor...' : 'Add Doctor'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddDoctorModal;