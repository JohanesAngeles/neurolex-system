// LifestyleStep.jsx with schema-compatible values
import React from 'react';

const LifestyleStep = ({ userData, handleInputChange, handleNext, handleBack }) => {
  return (
    <div className="step-container">
      <h2 className='part-header'>Daily Life and Lifestyle</h2>
      <p className="step-description">Your day-to-day habits matter, too. This section helps us understand 
      your routine so we can give more personalized advice for your mental well-being.</p>
      
      <div className="form-group">
        <label htmlFor="sleepPatterns">
          Sleep Patterns
          </label>
          <span className="input-hint">How much sleep are you getting each night? Rest is a big part of feeling good.</span>
        
        <select
          id="sleepPatterns"
          name="sleepPatterns"
          value={userData.sleepPatterns}
          onChange={handleInputChange}
          className="input-onboarding"
        >
          <option value="">Select Sleep Pattern</option>
          <option value="Less than 5 hours">Less than 5 hours</option>
          <option value="5-7 hours">5-7 hours</option>
          <option value="7-9 hours">7-9 hours</option>
          <option value="More than 9 hours">More than 9 hours</option>
        </select>
      </div>
      
      <div className="form-group">
        <label htmlFor="exerciseFrequency">
          Exercise and Physical Activity
          </label>
          <span className="input-hint">Do you get active regularly? Movement can do wonders for your mental health.</span>
        
        <select
          id="exerciseFrequency"
          name="exerciseFrequency"
          value={userData.exerciseFrequency}
          onChange={handleInputChange}
          className="input-onboarding"
        >
          <option value="">Select Option</option>
          <option value="Daily">Daily</option>
          <option value="4-6 times per week">4-6 times per week</option>
          <option value="1-3 times per week">1-3 times per week</option>
          <option value="Rarely">Rarely</option>
          <option value="Never">Never</option>
        </select>
      </div>
      
      <div className="form-group">
        <label htmlFor="dietaryPatterns">
          Dietary Habits
          </label>
          <span className="input-hint">How would you describe your eating habits? A healthy diet can help support your emotional well-being.</span>
        
        <select
          id="dietaryPatterns"
          name="dietaryPatterns"
          value={userData.dietaryPatterns}
          onChange={handleInputChange}
          className="input-onboarding"
        >
          <option value="">Select Dietary Habits</option>
          <option value="Balanced">Balanced</option>
          <option value="Mostly healthy">Mostly healthy</option>
          <option value="Mixed">Mixed</option>
          <option value="Unhealthy">Unhealthy</option>
        </select>
      </div>
      
      <div className="button-container button-grid-view">
        <button className="secondary-button-grid" onClick={handleBack}>Back</button>
        <button className="primary-button-grid" onClick={handleNext}>Next</button>
      </div>
    </div>
  );
};

export default LifestyleStep;