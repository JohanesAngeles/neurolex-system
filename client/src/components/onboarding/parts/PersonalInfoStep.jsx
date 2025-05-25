// PersonalInfoStep.jsx
import React from 'react';

const PersonalInfoStep = ({ userData, handleInputChange, handleNext, handleBack }) => {
  // Generate age options (18+)
  const ageOptions = [];
  for (let i = 18; i <= 100; i++) {
    ageOptions.push(i);
  }

  return (
    <div className="step-container">
      <h2 className='part-header'>Personal Information</h2>
      <p className="step-description">This section helps us get to know you a little better, so we can provide the most personal and supportive experience possible.</p>
      
      <div className="form-grid">
        <div className="form-group">
          <label htmlFor="firstName">First Name</label>
          <input 
            type="text" 
            id="firstName" 
            name="firstName" 
            value={userData.firstName} 
            onChange={handleInputChange}
            disabled
            className="input-onboarding"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="middleName">Middle Name (Optional)</label>
          <input 
            type="text" 
            id="middleName" 
            name="middleName" 
            value={userData.middleName} 
            onChange={handleInputChange}
            className="input-onboarding"
            placeholder="Enter Middle Name (Optional)"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="lastName">Last Name</label>
          <input 
            type="text" 
            id="lastName" 
            name="lastName" 
            value={userData.lastName} 
            onChange={handleInputChange}
            disabled
            className="input-onboarding"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="nickname">Nickname</label>
          <input 
            type="text" 
            id="nickname" 
            name="nickname" 
            value={userData.nickname} 
            onChange={handleInputChange}
            className="input-onboarding"
            placeholder="Enter Nickname"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="birthdate">Birthdate</label>
          <input 
            type="date" 
            id="birthdate" 
            name="birthdate" 
            value={userData.birthdate} 
            onChange={handleInputChange}
            className="input-onboarding"
            placeholder="Select Birthdate"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="age">Age</label>
          <select 
            id="age" 
            name="age" 
            value={userData.age} 
            onChange={handleInputChange}
            className="input-onboarding"
          >
            <option value="">Select Age</option>
            {ageOptions.map(age => (
              <option key={age} value={age}>{age}</option>
            ))}
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="gender">Gender</label>
          <select 
            id="gender" 
            name="gender" 
            value={userData.gender} 
            onChange={handleInputChange}
            className="input-onboarding"
          >
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Bisexual">Bisexual</option>
            <option value="Non-Binary">Non-Binary</option>
            <option value="Genderqueer">Genderqueer</option>
            <option value="Other">Other</option>
            <option value="Prefer not to say">Prefer not to say</option>
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="pronouns">Preferred Pronouns</label>
          <select 
            id="pronouns" 
            name="pronouns" 
            value={userData.pronouns} 
            onChange={handleInputChange}
            className="input-onboarding"
          >
            <option value="">Select Pronouns</option>
            <option value="He/Him">He/Him</option>
            <option value="She/Her">She/Her</option>
            <option value="They/Them">They/Them</option>
            <option value="Other">Other</option>
            <option value="Prefer not to say">Prefer not to say</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="location">Location</label>
          <input 
            type="text" 
            id="location" 
            name="location" 
            value={userData.location || ''} 
            onChange={handleInputChange}
            className="input-onboarding"
            placeholder="Enter Location"
          />
        </div>
      </div>
      
      <div className="button-container button-grid-view">
        <button className="secondary-button-grid" onClick={handleBack}>Back</button>
        <button className="primary-button-grid" onClick={handleNext}>Next</button>
        </div>
    </div>
  );
};

export default PersonalInfoStep;