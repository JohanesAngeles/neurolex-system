// DoctorCareStep.jsx
import React, { useEffect } from 'react';
import '../../../styles/components/onboarding/DoctorCareStep.css';

const DoctorCareStep = ({ userData, handleInputChange, handleNext, handleBack }) => {
  // Add a class to the body when this component mounts
  useEffect(() => {
    // Add the class when component mounts
    document.body.classList.add('doctor-care-page');
    
    // Remove the class when component unmounts
    return () => {
      document.body.classList.remove('doctor-care-page');
    };
  }, []);

  return (
    <div className="step-container doctor-care-step">
      <h2 className='part-header'>Doctor and Care Options</h2>
      <p className="step-description">We want to make sure you have access to the care you deserve. This section helps us 
      know if you need help finding a doctor or if you're already working with one.</p>
      
      <div className="form-group">
        <label htmlFor="hasMentalHealthDoctor" className="textarea-label">
          Do you currently have a doctor who is catering to your mental health?
        </label>
        <span className="input-hint">Are you seeing a mental health professional right now? Let us know!</span>
        <select
          id="hasMentalHealthDoctor"
          name="hasMentalHealthDoctor"
          value={userData.hasMentalHealthDoctor}
          onChange={handleInputChange}
          className="input-onboarding custom-select"
        >
          <option value="" disabled hidden>Select an option</option>
          <option value="Yes">Yes, I'm currently seeing a mental health professional</option>
          <option value="No">No, I'm not seeing one at the moment</option>
        </select>
      </div>
      
      <div className="form-group">
        <label htmlFor="doctorDetails" className="textarea-label">
          Please provide the doctor's name and contact details:
        </label>
        <span className="input-hint">Please share your doctor's name and contact info, if you're comfortable.</span>
      </div>
      
      <div className="form-grid-two-columns">
        <div className="form-group">
          <label htmlFor="doctorName" className="textarea-label">
            Doctor's Name
          </label>
          <input
            type="text"
            id="doctorName"
            name="doctorName"
            value={userData.doctorName}
            onChange={handleInputChange}
            className="input-onboarding"
            placeholder="Enter Doctor's Name"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="clinicLocation" className="textarea-label">
            Clinic Location
          </label>
          <input
            type="text"
            id="clinicLocation"
            name="clinicLocation"
            value={userData.clinicLocation}
            onChange={handleInputChange}
            className="input-onboarding"
            placeholder="Enter Clinic Location"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="doctorContactNumber" className="textarea-label">
            Doctor's Contact Number
          </label>
          <input
            type="tel"
            id="doctorContactNumber"
            name="doctorContactNumber"
            value={userData.doctorContactNumber}
            onChange={handleInputChange}
            className="input-onboarding"
            placeholder="Enter Doctor's Contact Number"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="doctorEmail" className="textarea-label">
            Doctor's Email Address
          </label>
          <input
            type="email"
            id="doctorEmail"
            name="doctorEmail"
            value={userData.doctorEmail}
            onChange={handleInputChange}
            className="input-onboarding"
            placeholder="Enter Doctor's Email Address"
          />
        </div>
      </div>
      
      <div className="form-group">
        <label htmlFor="needDoctorHelp" className="textarea-label">
          Would you like to look for a doctor through our system?
        </label>
        <span className="input-hint">If you need help finding a doctor, we can assist you in our system.</span>
        <select
          id="needDoctorHelp"
          name="needDoctorHelp"
          value={userData.needDoctorHelp}
          onChange={handleInputChange}
          className="input-onboarding custom-select"
        >
          <option value="Select an option">Select an option</option>
          <option value="Yes">Yes, I'd like help finding a doctor</option>
          <option value="No, self">No, I prefer to find one on my own</option>
          <option value="No, have">No, I already have a doctor</option>
          <option value="No answer">I'd rather not answer right now</option>
        </select>
      </div>
      
      <div className="button-container button-grid-view">
        <button className="secondary-button-grid" onClick={handleBack}>Back</button>
        <button className="primary-button-grid" onClick={handleNext}>Next</button>
      </div>
    </div>
  );
};

export default DoctorCareStep;