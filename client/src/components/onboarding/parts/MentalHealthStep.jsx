// MentalHealthStep.jsx
import React from 'react';

const MentalHealthStep = ({ userData, handleInputChange, handleNext, handleBack }) => {
  return (
    <div className="step-container">
      <h2 className='part-header'>Mental Health History</h2>
      <p className="step-description">We're here to understand your mental health journey a little better so we can support you in the best way possible.</p>
      
      <div className="form-group">
        <label htmlFor="diagnosis" className="textarea-label">
          Current Mental Health Diagnosis
          </label>
          <span className="input-hint"> If you feel comfortable, please share any diagnoses you've received.</span>
        <textarea
          id="diagnosis"
          name="diagnosis"
          value={userData.diagnosis}
          onChange={handleInputChange}
          rows={4}
          className="input-onboarding"
          placeholder='Enter Current Mental Health Diagnosis'
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="treatmentHistory" className="textarea-label">
          Treatment History
          </label>
          <span className="input-hint">Have you tried any treatments or therapy? We'd love to know what's been part of your healing path so far.</span>
        
        <textarea
          id="treatmentHistory"
          name="treatmentHistory"
          value={userData.treatmentHistory}
          onChange={handleInputChange}
          rows={4}
          className="input-onboarding"
            placeholder='Enter Treatment History'
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="symptomsFrequency" className="textarea-label">
          Frequency of Symptoms
          </label>
          <span className="input-hint">How often do you experience symptoms like sadness or anxiety? This helps us track your emotional changes.</span>
        
        <textarea
          id="symptomsFrequency"
          name="symptomsFrequency"
          value={userData.symptomsFrequency}
          onChange={handleInputChange}
          rows={4}
          className="input-onboarding"
            placeholder='Enter Frequency of Symptoms'
        />
      </div>
      
      <div className="button-container button-grid-view">
        <button className="secondary-button-grid" onClick={handleBack}>Back</button>
        <button className="primary-button-grid" onClick={handleNext}>Next</button>
      </div>
    </div>
  );
};

export default MentalHealthStep;