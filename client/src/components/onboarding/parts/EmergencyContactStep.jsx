// EmergencyContactStep.jsx
import React from 'react';

const EmergencyContactStep = ({ userData, handleInputChange, handleBack, handleSubmit }) => {
  return (
    <div className="step-container">
      <h2 className='part-header'>Emergency Contact</h2>
      <p className="step-description">In case of an emergency, we need someone who can support you. 
      This section allows us to connect with your trusted person if necessary.</p>
      
      <div className="form-group">
        <label htmlFor="emergencyName">
          Name
          </label>
          <span className="input-hint">Who should we reach out to if something urgent comes up?</span>
        
        <input
          type="text"
          id="emergencyName"
          name="emergencyName"
          value={userData.emergencyName}
          onChange={handleInputChange}
          className="input-onboarding"
          placeholder="Enter Emergency Contact Name"
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="emergencyRelationship">
          Relationship to User
            </label>
          <span className="input-hint">How are they connected to you? For example, parent, friend, spouse.</span>
        
        <input
          type="text"
          id="emergencyRelationship"
          name="emergencyRelationship"
          value={userData.emergencyRelationship}
          onChange={handleInputChange}
          className="input-onboarding"
            placeholder="Enter Relationship to User"
        />
      </div>
    
      <div className="form-grid-two-columns">
      <div className="form-group">
        <label htmlFor="emergencyPhone">
          Phone Number
          </label>
          <span className="input-hint">Please provide their contact number.</span>
        
        <input
          type="text"
          id="emergencyPhone"
          name="emergencyPhone"
          value={userData.emergencyPhone}
          onChange={handleInputChange}
          className="input-onboarding"
          placeholder="Enter Emergency Contact Phone Number"
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="emergencyEmail">
          Email Address
          </label>
          <span className="input-hint">Email can be a backup in case we need to reach them.</span>
        
        <input
          type="email"
          id="emergencyEmail"
          name="emergencyEmail"
          value={userData.emergencyEmail}
          onChange={handleInputChange}
          className="input-onboarding"
            placeholder="Enter Emergency Contact Email Address"
        />
      </div>
      </div>    
      <div className="button-container button-grid-view">
        <button className="secondary-button-grid" onClick={handleBack}>Back</button>
        <button className="primary-button-grid" onClick={handleSubmit}>Submit</button>
      </div>
    </div>
  );
};

export default EmergencyContactStep;