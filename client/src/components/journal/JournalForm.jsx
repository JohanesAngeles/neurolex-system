import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import authService from '../../services/authService';
import '../../styles/components/journal/JournalForm.css'; // Make sure to create this CSS file

// API URL from environment
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const JournalForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeStep, setActiveStep] = useState(0);
  const [journalCount, setJournalCount] = useState(1); // Start with 1 as default
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isSharedWithDoctor, setIsSharedWithDoctor] = useState(true);
  const [userName, setUserName] = useState('');
  
  // Form data state
  const [formData, setFormData] = useState({
    thoughtReflection: '',
    thoughtFeeling: '',
    selfKindness: '',
    gratitude: '',
    challengeReflection: '',
    selfCareInChallenge: '',
    selfCareActivities: [],
    otherSelfCare: '',
    tomorrowIntention: '',
    lovingReminder: '',
    journalTitle: ''
  });
  
  // Get current date
  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
  
  // Self-care activity options - match exactly with the mockups
  const selfCareOptions = [
    'I moved my body with care and gentleness',
    'I listened to what my body or heart needed',
    'I made space for something that brought me joy',
    'I allowed myself to rest without guilt',
    'I reached out for connection or support',
    'I gave myself permission to simply be'
  ];
  
  // Define the steps to match the UI mockups
  const steps = [
    { 
      name: 'Welcome', 
      component: 'welcome',
      icon: '🏠'
    },
    { 
      name: 'Reflections', 
      component: 'reflections',
      icon: '🌸' 
    },
    { 
      name: 'Gratitude', 
      component: 'gratitude',
      icon: '✨'
    },
    { 
      name: 'Challenges', 
      component: 'challenges',
      icon: '🌧️'
    },
    { 
      name: 'Self-Care', 
      component: 'selfcare',
      icon: '☕'
    },
    { 
      name: 'Tomorrow', 
      component: 'tomorrow',
      icon: '🌱'
    },
    { 
      name: 'Note', 
      component: 'note',
      icon: '❤️'
    },
    { 
      name: 'Complete', 
      component: 'complete',
      icon: '✅'
    }
  ];
  
  // Handle input change
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  // Handle self care activities toggle
  const handleSelfCareToggle = (activity) => {
    setFormData(prev => {
      const currentActivities = [...prev.selfCareActivities];
      
      if (currentActivities.includes(activity)) {
        return {
          ...prev,
          selfCareActivities: currentActivities.filter(item => item !== activity)
        };
      } else {
        return {
          ...prev,
          selfCareActivities: [...currentActivities, activity]
        };
      }
    });
  };
  
  // Navigation functions
  const nextStep = () => {
    setActiveStep(prev => prev + 1);
    window.scrollTo(0, 0);
  };
  
  const prevStep = () => {
    setActiveStep(prev => prev - 1);
    window.scrollTo(0, 0);
  };
  
  // Handle form submission
  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    
    try {
      // Check if user is authenticated
      if (!authService.isAuthenticated()) {
        throw new Error('You must be logged in to submit a journal entry.');
      }
      
      // Get token and tenant info
      const token = localStorage.getItem('token');
      const tenant = authService.getCurrentTenant();
      const tenantId = tenant?._id || null;
      
      // Prepare payload
      const payload = {
        journalFields: {
          thoughtReflection: formData.thoughtReflection,
          thoughtFeeling: formData.thoughtFeeling,
          selfKindness: formData.selfKindness,
          gratitude: formData.gratitude,
          challengeReflection: formData.challengeReflection,
          selfCareInChallenge: formData.selfCareInChallenge,
          selfCareActivities: formData.selfCareActivities,
          otherSelfCare: formData.otherSelfCare,
          tomorrowIntention: formData.tomorrowIntention,
          lovingReminder: formData.lovingReminder
        },
        title: formData.journalTitle || 'Journal Entry',
        isSharedWithDoctor: isSharedWithDoctor
      };
      
      // Add tenant ID if available
      if (tenantId) {
        payload._tenantId = tenantId;
      }
      
      // Submit journal entry
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
      
      // Add tenant header if available
      if (tenantId) {
        headers['X-Tenant-ID'] = tenantId;
      }
      
      const response = await axios.post(`${API_URL}/journals`, payload, { headers });
      
      if (response.data.success) {
        setSuccess(true);
        // Reset form
        setFormData({
          thoughtReflection: '',
          thoughtFeeling: '',
          selfKindness: '',
          gratitude: '',
          challengeReflection: '',
          selfCareInChallenge: '',
          selfCareActivities: [],
          otherSelfCare: '',
          tomorrowIntention: '',
          lovingReminder: '',
          journalTitle: ''
        });
        
        // Redirect to journal list page after 2 seconds
        setTimeout(() => {
          navigate('/dashboard/journal');
        }, 2000);
      }
    } catch (err) {
      console.error('Error submitting journal entry:', err);
      setError(err.response?.data?.message || 'Failed to submit journal entry. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Load profile data and journal count on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Check authentication
        if (!authService.isAuthenticated()) {
          navigate('/login', { state: { from: location } });
          return;
        }
        
        // Get user information from localStorage
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          setUserName(user?.firstName || user?.name || 'Adrianne'); // Default to "Adrianne" as shown in the mockups
        }
        
        // Skip journal count fetch for now and use default value of 1
        setLoading(false);
        
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load user data. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [navigate, location]);
  
  // Render welcome screen - updated to match UI mockup
  const renderWelcome = () => {
    return (
      <div className="form-paper welcome-screen">
        <h2 className="welcome-title">
          Hi, our dearest <span className="user-name">{userName || 'Adrianne'}</span> 💚
        </h2>
        
        <p className="welcome-text italic">
          This space is just for you — a gentle moment to breathe, to be, and to care for yourself.
        </p>
        
        <p className="welcome-text">
          There's no rush here, no pressure. Only kindness, honesty, and a little room for your heart to speak.
        </p>
        
        <p className="welcome-text">
          Here, you'll be gently guided through <strong>reflections on your thoughts, your gratitude, your challenges, and the small ways you cared for yourself today</strong>.
        </p>
        
        <p className="welcome-text">
          It's a soft place to notice, to honor your journey, and to plant little seeds of hope for tomorrow.
        </p>
        
        <button 
          className="primary-button large-button"
          onClick={nextStep}
        >
          I'M READY TO START JOURNALING
        </button>
      </div>
    );
  };
  
  // Render gentle reflections - updated to match UI mockup
  const renderReflections = () => {
    return (
      <div className="form-paper">
        <h2 className="section-title">Gentle Reflections</h2>
        <p className="section-subtitle">
          Take a moment to gently observe today's thoughts with kindness and care.
        </p>
        
        <div className="form-section">
          <h3 className="question-title">A thought that stayed with me today</h3>
          <p className="question-subtitle">
            Something that visited my mind - big or small.
          </p>
          <textarea
            className="form-textarea"
            rows={4}
            placeholder="Write the thought that lingered with you today..."
            value={formData.thoughtReflection}
            onChange={(e) => handleInputChange('thoughtReflection', e.target.value)}
          ></textarea>
        </div>
        
        <div className="form-section">
          <h3 className="question-title">Was this thought comforting or heavy?</h3>
          <p className="question-subtitle">
            Notice it with compassion, you're not wrong for feeling anything.
          </p>
          <textarea
            className="form-textarea"
            rows={3}
            placeholder="Write if this thought felt comforting, heavy, or somewhere in between..."
            value={formData.thoughtFeeling}
            onChange={(e) => handleInputChange('thoughtFeeling', e.target.value)}
          ></textarea>
        </div>
        
        <div className="form-section">
          <h3 className="question-title">If this thought was challenging, what would I say to myself to offer support and kindness?</h3>
          <p className="question-subtitle">
            Think of a loving, gentle response you'd give to yourself.
          </p>
          <textarea
            className="form-textarea"
            rows={3}
            placeholder="Write a kind and supportive message to yourself..."
            value={formData.selfKindness}
            onChange={(e) => handleInputChange('selfKindness', e.target.value)}
          ></textarea>
        </div>
      </div>
    );
  };
  
  // Render gratitude - updated to match UI mockup
  const renderGratitude = () => {
    return (
      <div className="form-paper">
        <h2 className="section-title">Moments of Gratitude</h2>
        <p className="section-subtitle">
          Pause and reflect on the small joys that brightened your day. Gratitude helps us see beauty even in the cloudiest moments.
        </p>
        
        <div className="form-section">
          <h3 className="question-title">Today, my heart is thankful for</h3>
          <p className="question-subtitle">
            Even the smallest joys - a soft breeze, a kind word, a moment of peace.
          </p>
          <textarea
            className="form-textarea"
            rows={5}
            placeholder="Write what you're thankful for today..."
            value={formData.gratitude}
            onChange={(e) => handleInputChange('gratitude', e.target.value)}
          ></textarea>
        </div>
      </div>
    );
  };
  
  // Render challenges - updated to match UI mockup
  const renderChallenges = () => {
    return (
      <div className="form-paper">
        <h2 className="section-title">Tender Moments</h2>
        <p className="section-subtitle">
          Acknowledge the challenges of today with compassion. It's okay to recognize what was difficult.
        </p>
        
        <div className="form-section">
          <h3 className="question-title">Something that challenged me today</h3>
          <p className="question-subtitle">
            It's brave to notice when you hurt.
          </p>
          <textarea
            className="form-textarea"
            rows={4}
            placeholder="Write about the moment that felt tough or difficult..."
            value={formData.challengeReflection}
            onChange={(e) => handleInputChange('challengeReflection', e.target.value)}
          ></textarea>
        </div>
        
        <div className="form-section">
          <h3 className="question-title">How I cared for myself in that moment</h3>
          <p className="question-subtitle">
            A breath, a pause, reaching out — all forms of strength.
          </p>
          <textarea
            className="form-textarea"
            rows={3}
            placeholder="Write about the way you supported yourself - however big or small..."
            value={formData.selfCareInChallenge}
            onChange={(e) => handleInputChange('selfCareInChallenge', e.target.value)}
          ></textarea>
        </div>
      </div>
    );
  };
  
  // Render self-care - updated to match UI mockup
  const renderSelfCare = () => {
    return (
      <div className="form-paper">
        <h2 className="section-title">Self-Care Check-In</h2>
        <p className="section-subtitle">
          Take a gentle pause to honor the ways you cared for your heart, mind, and body today.
        </p>
        
        <div className="form-section">
          <h3 className="question-title">Which acts of love did I offer myself today?</h3>
          <p className="question-subtitle">
            Reflect on the small, meaningful ways you showed up for yourself with kindness and care.
          </p>
          
          <div className="checkbox-container">
            {selfCareOptions.map((option) => (
              <div 
                key={option}
                className={`checkbox-option ${formData.selfCareActivities.includes(option) ? 'selected' : ''}`}
                onClick={() => handleSelfCareToggle(option)}
              >
                <input 
                  type="checkbox" 
                  checked={formData.selfCareActivities.includes(option)}
                  onChange={() => handleSelfCareToggle(option)}
                  className="checkbox-input"
                />
                <span className="checkbox-label">{option}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="form-section">
          <h3 className="question-title">Other Ways I Cared for Myself</h3>
          <p className="question-subtitle">
            Reflect on any other small acts of kindness you showed yourself today.
          </p>
          <textarea
            className="form-textarea"
            rows={3}
            placeholder="Write another small act of care you offered yourself today..."
            value={formData.otherSelfCare}
            onChange={(e) => handleInputChange('otherSelfCare', e.target.value)}
          ></textarea>
        </div>
      </div>
    );
  };
  
  // Render tomorrow - updated to match UI mockup
  const renderTomorrow = () => {
    return (
      <div className="form-paper">
        <h2 className="section-title">Hopes for Tomorrow</h2>
        <p className="section-subtitle">
          Each new day brings new light. Set a gentle hope to guide your tomorrow.
        </p>
        
        <div className="form-section">
          <h3 className="question-title">One small act of care I'd like to try tomorrow</h3>
          <p className="question-subtitle">
            A tiny way to be new again. Choose one small way to care for yourself tomorrow.
          </p>
          <textarea
            className="form-textarea"
            rows={4}
            placeholder="Write one small act of care you'd like to offer yourself tomorrow..."
            value={formData.tomorrowIntention}
            onChange={(e) => handleInputChange('tomorrowIntention', e.target.value)}
          ></textarea>
        </div>
      </div>
    );
  };
  
  // Render loving note - updated to match UI mockup
  const renderLovingNote = () => {
    return (
      <div className="form-paper">
        <h2 className="section-title">A Loving Note to Myself</h2>
        <p className="section-subtitle">
          Offer yourself a few kind words to hold onto - a reminder of your strength, your softness, and your worth.
        </p>
        
        <div className="form-section">
          <h3 className="question-title">A reminder to carry with me</h3>
          <p className="question-subtitle">
            A gentle reminder of your worth and resilience, to carry with you moving forward.
          </p>
          <textarea
            className="form-textarea"
            rows={4}
            placeholder="Write a loving reminder you want to carry with you..."
            value={formData.lovingReminder}
            onChange={(e) => handleInputChange('lovingReminder', e.target.value)}
          ></textarea>
        </div>
        
        <div className="toggle-container">
          <label className="switch">
            <input
              type="checkbox"
              checked={isSharedWithDoctor}
              onChange={() => setIsSharedWithDoctor(!isSharedWithDoctor)}
            />
            <span className="slider round"></span>
          </label>
          <span className="toggle-label">Share this journal entry with my healthcare provider</span>
        </div>
        <p className="toggle-description">
          {isSharedWithDoctor 
            ? 'Your healthcare provider will be able to view this journal entry.'
            : 'This entry will be private and only visible to you.'}
        </p>
      </div>
    );
  };
  
  // Render completion page with title input
  const renderCompletePage = () => {
    return (
      <div className="form-paper complete-screen">
        <h2 className="complete-title">You've Done Something Beautiful Today 💚</h2>
        
        <p className="complete-text">
          Taking this time for yourself is a gentle act of love, and <strong>we're so proud of you</strong>. Reflecting, caring for your heart, and showing up with kindness are powerful steps toward healing. Remember, you are enough, and you are loved. Every moment of care matters, and we're with you every step of the way.
        </p>
        
        <div className="form-section">
          <h3 className="question-title">Give Your Entry a Title</h3>
          <p className="question-subtitle">
            Sum up your thoughts in a few words or set the tone for your journal entry.
          </p>
          <input
            type="text"
            className="form-input"
            placeholder="Write a title for your entry..."
            value={formData.journalTitle}
            onChange={(e) => handleInputChange('journalTitle', e.target.value)}
          />
        </div>
      </div>
    );
  };
  
  // Function to render the current step content
  const renderStepContent = () => {
    switch (steps[activeStep].component) {
      case 'welcome':
        return renderWelcome();
      case 'reflections':
        return renderReflections();
      case 'gratitude':
        return renderGratitude();
      case 'challenges':
        return renderChallenges();
      case 'selfcare':
        return renderSelfCare();
      case 'tomorrow':
        return renderTomorrow();
      case 'note':
        return renderLovingNote();
      case 'complete':
        return renderCompletePage();
      default:
        return null;
    }
  };
  
  // Render navigation buttons based on the active step
  const renderNavButtons = () => {
    if (activeStep === 0) {
      return null; // No buttons on welcome screen - using the "I'm Ready" button instead
    }
    
    if (activeStep === steps.length - 1) {
      return (
        <div className="nav-button-container">
          <button
            className="secondary-button"
            onClick={prevStep}
          >
            Back
          </button>
          
          <button
            className="primary-button"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      );
    }
    
    // Get the step name for next button based on mockups
    const nextButtonTexts = {
      1: 'Next - Moments of Gratitude',
      2: 'Next - Tender Moments',
      3: 'Next - Self-Care Check-In',
      4: 'Next - Hopes for Tomorrow',
      5: 'Next - A Loving Note to Myself',
      6: 'Next - Complete'
    };
    
    const nextButtonText = nextButtonTexts[activeStep] || 'Next';
    
    return (
      <div className="nav-button-container">
        <button
          className="secondary-button"
          onClick={prevStep}
        >
          Back
        </button>
        
        <button
          className="primary-button"
          onClick={nextStep}
        >
          {nextButtonText}
        </button>
      </div>
    );
  };
  
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }
  
  return (
    <div className="dashboard-container">
      <div className="dashboard-content-area">
        <div className="dashboard-content-container journal-form-container">
          <div className="journal-header">
            <div className="header-left">
              <button className="back-button" onClick={() => navigate(-1)}>
                <span className="back-icon">←</span>
              </button>
              <div>
                <h1 className="journal-title">Daily Journal Entry | Log {journalCount}</h1>
                <p className="journal-subtitle">
                  A quick moment for you to reflect. Your feelings matter. We're here for you.
                </p>
              </div>
            </div>
            
            <div className="date-badge">
              <span className="calendar-icon">📅</span>
              <span className="date-text">{formattedDate} • Today</span>
            </div>
          </div>
          
          {error && (
            <div className="error-alert">
              <span className="alert-title">Error</span>
              {error}
            </div>
          )}
          
          {success && (
            <div className="success-alert">
              <span className="alert-title">Success</span>
              Journal entry submitted successfully!
            </div>
          )}
          
          {activeStep > 0 && activeStep < steps.length - 1 && (
            <div className="progress-container">
              {steps.slice(1, steps.length - 1).map((step, index) => {
                // Adjust index to account for welcome screen not being in progress bar
                const adjustedIndex = index + 1;
                return (
                  <div 
                    key={step.name}
                    className={`progress-item ${activeStep === adjustedIndex ? 'active' : ''} ${activeStep > adjustedIndex ? 'completed' : ''}`}
                  >
                    <div className="progress-icon">
                      {step.icon}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {renderStepContent()}
          
          {renderNavButtons()}
        </div>
      </div>
    </div>
  );
};

export default JournalForm;