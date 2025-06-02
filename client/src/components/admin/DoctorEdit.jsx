// src/components/admin/DoctorEdit.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import adminService from '../../services/adminService';

const DoctorEdit = () => {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  
  // Form fields
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    title: '',
    specialization: '',
    yearsOfExperience: '',
    personalContactNumber: '',
    clinicLocation: '',
    clinicContactNumber: '',
    languages: [],
    consultationFee: '',
    bio: '',
    licenseNumber: '',
    licenseIssuingAuthority: '',
    licenseExpiryDate: '',
    accountStatus: 'active',
    inPerson: false,
    telehealth: false
  });

  useEffect(() => {
    fetchDoctorDetails();
  }, [doctorId]);

  const fetchDoctorDetails = async () => {
    try {
      setLoading(true);
      const response = await adminService.getDoctorDetails(doctorId);
      const doctorData = response.data;
      
      setDoctor(doctorData);
      
      // Populate form with existing data
      setFormData({
        firstName: doctorData.firstName || '',
        lastName: doctorData.lastName || '',
        email: doctorData.email || '',
        title: doctorData.title || '',
        specialization: doctorData.specialization || '',
        yearsOfExperience: doctorData.yearsOfExperience || '',
        personalContactNumber: doctorData.personalContactNumber || '',
        clinicLocation: doctorData.clinicLocation || doctorData.clinicAddress || '',
        clinicContactNumber: doctorData.clinicContactNumber || '',
        languages: doctorData.languages || [],
        consultationFee: doctorData.consultationFee || '',
        bio: doctorData.bio || '',
        licenseNumber: doctorData.licenseNumber || '',
        licenseIssuingAuthority: doctorData.licenseIssuingAuthority || '',
        licenseExpiryDate: doctorData.licenseExpiryDate ? doctorData.licenseExpiryDate.split('T')[0] : '',
        accountStatus: doctorData.accountStatus || 'active',
        inPerson: doctorData.inPerson || false,
        telehealth: doctorData.telehealth || false
      });
      
    } catch (err) {
      console.error('Error fetching doctor details:', err);
      setError('Failed to load doctor details.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleLanguagesChange = (e) => {
    const value = e.target.value;
    const languagesArray = value.split(',').map(lang => lang.trim()).filter(lang => lang);
    setFormData(prev => ({
      ...prev,
      languages: languagesArray
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      await adminService.updateDoctor(doctorId, formData);
      toast.success('Doctor updated successfully!');
      navigate('/admin/professionals');
    } catch (err) {
      console.error('Error updating doctor:', err);
      toast.error('Failed to update doctor. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-content">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading doctor details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-content">
        <div className="error-container">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={() => navigate('/admin/professionals')}>
            Back to Professionals
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-content">
      {/* Header */}
      <div className="page-header">
        <button 
          className="back-button"
          onClick={() => navigate('/admin/professionals')}
        >
          ← Back to Professionals
        </button>
        <div className="header-info">
          <h1>Edit Doctor Profile</h1>
          <p>Update {doctor?.firstName} {doctor?.lastName}'s information</p>
        </div>
      </div>

      {/* Edit Form */}
      <div className="form-container">
        <form onSubmit={handleSubmit} className="doctor-edit-form">
          {/* Personal Information */}
          <div className="form-section">
            <h3>Personal Information</h3>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="firstName">First Name *</label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
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
                  onChange={handleInputChange}
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
                  onChange={handleInputChange}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="personalContactNumber">Personal Contact</label>
                <input
                  type="tel"
                  id="personalContactNumber"
                  name="personalContactNumber"
                  value={formData.personalContactNumber}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </div>

          {/* Professional Information */}
          <div className="form-section">
            <h3>Professional Information</h3>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="title">Professional Title</label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="Dr., MD, PhD, etc."
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="specialization">Specialization *</label>
                <select
                  id="specialization"
                  name="specialization"
                  value={formData.specialization}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select Specialization</option>
                  <option value="Psychiatrist">Psychiatrist</option>
                  <option value="Psychologist">Psychologist</option>
                  <option value="Mental Health Counselor">Mental Health Counselor</option>
                  <option value="Clinical Social Worker">Clinical Social Worker</option>
                  <option value="Marriage and Family Therapist">Marriage and Family Therapist</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="yearsOfExperience">Years of Experience</label>
                <input
                  type="number"
                  id="yearsOfExperience"
                  name="yearsOfExperience"
                  value={formData.yearsOfExperience}
                  onChange={handleInputChange}
                  min="0"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="consultationFee">Consultation Fee</label>
                <input
                  type="number"
                  id="consultationFee"
                  name="consultationFee"
                  value={formData.consultationFee}
                  onChange={handleInputChange}
                  placeholder="Amount in USD"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="languages">Languages (comma-separated)</label>
              <input
                type="text"
                id="languages"
                name="languages"
                value={formData.languages.join(', ')}
                onChange={handleLanguagesChange}
                placeholder="English, Spanish, French"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="bio">Professional Bio</label>
              <textarea
                id="bio"
                name="bio"
                value={formData.bio}
                onChange={handleInputChange}
                rows={4}
                placeholder="Brief description of professional background and approach..."
              />
            </div>
          </div>

          {/* Clinic Information */}
          <div className="form-section">
            <h3>Clinic Information</h3>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="clinicLocation">Clinic Location</label>
                <input
                  type="text"
                  id="clinicLocation"
                  name="clinicLocation"
                  value={formData.clinicLocation}
                  onChange={handleInputChange}
                  placeholder="Clinic address or location"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="clinicContactNumber">Clinic Contact</label>
                <input
                  type="tel"
                  id="clinicContactNumber"
                  name="clinicContactNumber"
                  value={formData.clinicContactNumber}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </div>

          {/* Service Options */}
          <div className="form-section">
            <h3>Service Options</h3>
            <div className="checkbox-group">
              <div className="checkbox-item">
                <input
                  type="checkbox"
                  id="inPerson"
                  name="inPerson"
                  checked={formData.inPerson}
                  onChange={handleInputChange}
                />
                <label htmlFor="inPerson">Offers In-Person Consultations</label>
              </div>
              
              <div className="checkbox-item">
                <input
                  type="checkbox"
                  id="telehealth"
                  name="telehealth"
                  checked={formData.telehealth}
                  onChange={handleInputChange}
                />
                <label htmlFor="telehealth">Offers Telehealth Consultations</label>
              </div>
            </div>
          </div>

          {/* License Information */}
          <div className="form-section">
            <h3>License Information</h3>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="licenseNumber">License Number</label>
                <input
                  type="text"
                  id="licenseNumber"
                  name="licenseNumber"
                  value={formData.licenseNumber}
                  onChange={handleInputChange}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="licenseIssuingAuthority">Issuing Authority</label>
                <input
                  type="text"
                  id="licenseIssuingAuthority"
                  name="licenseIssuingAuthority"
                  value={formData.licenseIssuingAuthority}
                  onChange={handleInputChange}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="licenseExpiryDate">License Expiry Date</label>
                <input
                  type="date"
                  id="licenseExpiryDate"
                  name="licenseExpiryDate"
                  value={formData.licenseExpiryDate}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </div>

          {/* Account Status */}
          <div className="form-section">
            <h3>Account Status</h3>
            <div className="form-group">
              <label htmlFor="accountStatus">Status</label>
              <select
                id="accountStatus"
                name="accountStatus"
                value={formData.accountStatus}
                onChange={handleInputChange}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>

          {/* Form Actions */}
          <div className="form-actions">
            <button 
              type="button" 
              className="btn-secondary"
              onClick={() => navigate('/admin/professionals')}
              disabled={saving}
            >
              Cancel
            </button>
            
            <button 
              type="submit" 
              className="btn-primary"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DoctorEdit;