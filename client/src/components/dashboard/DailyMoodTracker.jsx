import React, { useState, useEffect } from 'react';
import moodService from '../../services/moodService';
import '../../styles/components/dashboard/moodTracker.css';

// Import SVGs directly
import greatMood from '../../assets/moods/Face_Im Great.svg';
import goodMood from '../../assets/moods/Face_Im good.svg';
import okayMood from '../../assets/moods/Face_Im okay.svg';
import strugglingMood from '../../assets/moods/Face_Im struggling.svg';
import upsetMood from '../../assets/moods/Face_Im upset.svg';
// Import calendar icon - assuming it exists in your assets folder
import calendarIcon from '../../assets/icons/calendar_moodTracker.svg';

// Mood options with imported SVGs
const moodOptions = [
  { value: 'great', label: "I'm great", svgPath: greatMood },
  { value: 'good', label: "I'm good", svgPath: goodMood },
  { value: 'okay', label: "I'm okay", svgPath: okayMood },
  { value: 'struggling', label: "I'm struggling", svgPath: strugglingMood },
  { value: 'upset', label: "I'm upset", svgPath: upsetMood }
];

// Common symptoms for tracking
const commonSymptoms = [
  'Low mood',
  'Anxious or uneasy',
  'Numb or empty',
  'Low energy',
  'Easily tearful',
  'Trouble sleeping / oversleeping',
  'Trouble focusing',
  'Body aches',
  'Overthinking',
  'Changes in appetite'
];

const DailyMoodTracker = ({ onSubmit, onClose, user }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [currentMoodIndex, setCurrentMoodIndex] = useState(0);
  const [reflection, setReflection] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submissionInProgress, setSubmissionInProgress] = useState(false);
  
  // New state for symptom tracker modal
  const [showSymptomModal, setShowSymptomModal] = useState(false);
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [customSymptom, setCustomSymptom] = useState('');
  const [customSymptoms, setCustomSymptoms] = useState([]);

  // Format today's date as "April 19, 2025 - Today"
  const formattedDate = () => {
    const today = new Date();
    const options = { month: 'long', day: 'numeric', year: 'numeric' };
    return `${today.toLocaleDateString('en-US', options)} - Today`;
  };

  // Check if the user has already submitted a mood today
  useEffect(() => {
    // Ensure user data is available
    if (!user) {
      console.log("DailyMoodTracker: No user data available");
      setIsVisible(false);
      return;
    }

    const userId = user.id || user._id;
    if (!userId) {
      console.log("DailyMoodTracker: User ID not available");
      setIsVisible(false);
      return;
    }
    
    // Make sure user data is available in localStorage
    if (!localStorage.getItem('user')) {
      localStorage.setItem('user', JSON.stringify(user));
      console.log("DailyMoodTracker: Saved user data to localStorage");
    }

    const checkPreviousSubmission = () => {
      // Use the mood service to check if a mood was submitted today
      const hasSubmitted = moodService.hasSubmittedToday();
      console.log(`DailyMoodTracker: User ${userId} has submitted mood today:`, hasSubmitted);
      
      if (hasSubmitted) {
        setIsVisible(false);
      }
    };
    
    checkPreviousSubmission();
  }, [user]);

  // Handle next/previous mood navigation
  const navigateMood = (direction) => {
    if (direction === 'next') {
      setCurrentMoodIndex((prevIndex) => 
        prevIndex === moodOptions.length - 1 ? 0 : prevIndex + 1
      );
    } else {
      setCurrentMoodIndex((prevIndex) => 
        prevIndex === 0 ? moodOptions.length - 1 : prevIndex - 1
      );
    }
  };

  // Handle reflection text change
  const handleReflectionChange = (e) => {
    setReflection(e.target.value);
  };
  
  // Toggle symptom selection
  const toggleSymptom = (symptom) => {
    setSelectedSymptoms(prev => 
      prev.includes(symptom)
        ? prev.filter(s => s !== symptom)
        : [...prev, symptom]
    );
  };
  
  // Handle custom symptom input
  const handleCustomSymptomChange = (e) => {
    setCustomSymptom(e.target.value);
  };
  
  // Add custom symptom to the list
  const addCustomSymptom = () => {
    if (customSymptom.trim()) {
      setCustomSymptoms([...customSymptoms, customSymptom.trim()]);
      setSelectedSymptoms([...selectedSymptoms, customSymptom.trim()]);
      setCustomSymptom('');
    }
  };

  // Notify other components of mood submission
  const notifyMoodSubmitted = (moodData) => {
    try {
      // Dispatch a custom event for components to listen for
      const event = new CustomEvent('moodSubmitted', { 
        detail: moodData,
        bubbles: true
      });
      window.dispatchEvent(event);
      
      console.log("DailyMoodTracker: Mood submission event dispatched");
    } catch (error) {
      console.error("Error notifying mood submission:", error);
    }
  };

  // Handle main mood tracker submission (now shows symptoms modal)
  const handleMoodSelection = (e) => {
    e.preventDefault();
    // Show the symptom tracker modal after mood and reflection are entered
    setShowSymptomModal(true);
  };

  // Handle final form submission from symptom modal
  const handleSubmit = async () => {
    // Prevent double submissions
    if (submissionInProgress) {
      console.log("Submission already in progress, ignoring");
      return;
    }
    
    setSubmissionInProgress(true);
    
    // Ensure user ID is available
    const userId = user?._id || user?.id;
    if (!userId) {
      console.error("Cannot submit mood: User ID not available");
      setSubmissionInProgress(false);
      return;
    }
    
    const selectedMood = moodOptions[currentMoodIndex];
    const submissionData = {
      mood: selectedMood.value,
      label: selectedMood.label,
      reflection,
      symptoms: selectedSymptoms,
      timestamp: new Date().toISOString(),
      userId, // Add user ID to the submission data
      svgPath: selectedMood.svgPath // Store SVG path for reference
    };
    
    console.log(`Submitting mood for user ${userId}:`, selectedMood.value);
    setIsSubmitted(true);
    
    try {
      // Save mood entry using the service
      await moodService.saveMoodEntry(submissionData);
      
      // Manually store today's mood in localStorage for immediate access
      const today = new Date();
      const dateKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
      const todayMoodKey = `mood_${dateKey}_${userId}`;
      localStorage.setItem(todayMoodKey, JSON.stringify(submissionData));
      
      // Notify other components about the mood submission
      notifyMoodSubmitted(submissionData);
      
      // Close the modal and the mood tracker
      setShowSymptomModal(false);
      
      // Show success message briefly before closing
      setTimeout(() => {
        setIsVisible(false);
        
        // Call onSubmit prop if provided (to notify parent component)
        if (onSubmit) {
          onSubmit(submissionData);
        }
      }, 2000);
    } catch (error) {
      console.error('Failed to save mood:', error);
      // Even if API save fails, the service will save to localStorage as fallback
      
      // Still notify about the mood submission for local updates
      notifyMoodSubmitted(submissionData);
      
      // Close the modal and the mood tracker after a delay
      setShowSymptomModal(false);
      setTimeout(() => {
        setIsVisible(false);
        
        // Still call onSubmit as the data was saved locally
        if (onSubmit) {
          onSubmit(submissionData);
        }
      }, 2000);
    } finally {
      setSubmissionInProgress(false);
    }
  };

  // Close the tracker manually
  const handleClose = () => {
    setIsVisible(false);
    // Call onClose prop if provided
    if (onClose) {
      onClose();
    }
  };

  // If not visible, don't render anything
  if (!isVisible) {
    return null;
  }

  // Personalized greeting based on user name
  const userName = user?.name || user?.firstName || '';
  const greeting = userName ? `How are you feeling today, ${userName}?` : 'How are you feeling today?';

  return (
    <div className="mood-tracker-container">
      {/* Date display at the top */}
      <div className="mood-tracker-date">
        <img src={calendarIcon} alt="Calendar" width="18" height="18" />
        {formattedDate()}
      </div>
      
      {/* Header with greeting */}
      <div className="mood-tracker-header">
        <h2 className='greetings_moodtracker'>{greeting}</h2>
        <button className="close-button" onClick={handleClose}>×</button>
      </div>
      
      <form onSubmit={handleMoodSelection} className="mood-tracker-form">
        <div className="mood-selector">
          <button 
            type="button" 
            className="mood-nav-button prev" 
            onClick={() => navigateMood('prev')}
          >
            ‹
          </button>
          
          <div className="mood-display">
            <div className="mood-emoji">
              <img 
                src={moodOptions[currentMoodIndex].svgPath} 
                alt={moodOptions[currentMoodIndex].label} 
              />
            </div>
            <div className="mood-label">
              {moodOptions[currentMoodIndex].label}
            </div>
          </div>
          
          <button 
            type="button" 
            className="mood-nav-button next" 
            onClick={() => navigateMood('next')}
          >
            ›
          </button>
        </div>
        
        <div className="reflection-container">
          <label htmlFor="reflection">Emotional Reflection: What was the highlight of your day?</label>
          <textarea
            id="reflection"
            value={reflection}
            onChange={handleReflectionChange}
            placeholder="Share your thoughts about today..."
            rows={4}
          />
        </div>
        
        <button 
          type="submit" 
          className="submit-button"
          disabled={isSubmitted || submissionInProgress}
        >
          {isSubmitted ? 'Saved!' : 'Next'}
        </button>
      </form>
      
      {/* Symptom Tracker Modal */}
      {showSymptomModal && (
        <div className="symptom-modal-overlay">
          <div className="symptom-modal">
            <div className="symptom-modal-header">
              <h2>Symptom Tracker</h2>
              <button 
                className="close-button" 
                onClick={() => setShowSymptomModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="symptom-modal-content">
              <p className="symptom-prompt">Are you experiencing any of the following today?</p>
              
              <div className="symptom-grid">
                {commonSymptoms.map((symptom, index) => (
                  <div 
                    key={index} 
                    className={`symptom-item ${selectedSymptoms.includes(symptom) ? 'selected' : ''}`}
                    onClick={() => toggleSymptom(symptom)}
                  >
                    <div className="symptom-checkbox">
                      {selectedSymptoms.includes(symptom) && <span className="checkmark">✓</span>}
                    </div>
                    <span className="symptom-text">{symptom}</span>
                  </div>
                ))}
                
                {/* Custom symptoms added by user */}
                {customSymptoms.map((symptom, index) => (
                  <div 
                    key={`custom-${index}`} 
                    className={`symptom-item custom ${selectedSymptoms.includes(symptom) ? 'selected' : ''}`}
                    onClick={() => toggleSymptom(symptom)}
                  >
                    <div className="symptom-checkbox">
                      {selectedSymptoms.includes(symptom) && <span className="checkmark">✓</span>}
                    </div>
                    <span className="symptom-text">{symptom}</span>
                  </div>
                ))}
              </div>
              
              <div className="custom-symptom-input">
                <h3>Custom Input</h3>
                <div className="custom-input-container">
                  <input
                    type="text"
                    value={customSymptom}
                    onChange={handleCustomSymptomChange}
                    placeholder="Add your own symptom..."
                    className="custom-symptom-field"
                  />
                  <button 
                    type="button"
                    className="add-custom-button"
                    onClick={addCustomSymptom}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
            
            <div className="symptom-modal-footer">
              <button 
                className="submit-button"
                onClick={handleSubmit}
                disabled={isSubmitted || submissionInProgress}
              >
                {isSubmitted ? 'Saved!' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyMoodTracker;