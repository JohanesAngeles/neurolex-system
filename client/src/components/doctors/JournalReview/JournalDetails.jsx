import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, parseISO, isValid } from 'date-fns';
import doctorService from '../../../services/doctorService';
import axios from 'axios';
import '../../../styles/components/doctor/JournalEntryDetail.css';

const JournalEntryDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState({
    sentiment: '',
    emotions: [],
    notes: '',
    flags: []
  });
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [useAI, setUseAI] = useState(true);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAIAnalysis, setShowAIAnalysis] = useState(false);
  
  // Safe date formatting function
  const formatDateSafe = (dateString) => {
    try {
      if (!dateString) return 'Unknown Date';
      
      let parsedDate;
      
      try {
        parsedDate = parseISO(dateString);
      } catch {
        parsedDate = new Date(dateString);
      }
      
      if (!isValid(parsedDate)) {
        return 'Invalid Date';
      }
      
      return format(parsedDate, 'MMMM dd, yyyy h:mm a');
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Unknown Date';
    }
  };
  
  // Common emotions for quick selection
  const commonEmotions = [
    'Joy', 'Sadness', 'Fear', 'Anger', 'Surprise', 'Disgust', 
    'Trust', 'Anticipation', 'Gratitude', 'Confusion', 'Loneliness', 
    'Anxiety', 'Hope', 'Longing', 'Grief', 'Relief'
  ];
  
  // Fetch entry details
  useEffect(() => {
    const fetchEntry = async () => {
      try {
        setLoading(true);
        const data = await doctorService.getJournalEntry(id);
        
        console.log('Journal entry data:', data);
        
        setEntry(data);
        
        // Initialize analysis form with existing analysis if available
        if (data.sentimentAnalysis?.sentiment || data.emotions || data.doctorNotes || data.flags) {
          setAnalysis({
            sentiment: data.sentimentAnalysis?.sentiment?.type || '',
            emotions: Array.isArray(data.sentimentAnalysis?.emotions) 
              ? data.sentimentAnalysis.emotions.map(e => typeof e === 'object' ? e.name : e)
              : data.emotions || [],
            notes: data.doctorNotes || '',
            flags: data.flags || []
          });
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching entry:', error);
        setError(error.response?.data?.message || 'Failed to load journal entry. Please try again.');
        setLoading(false);
      }
    };
    
    fetchEntry();
  }, [id]);
  
  // Handle analysis form changes
  const handleAnalysisChange = (field, value) => {
    setAnalysis({
      ...analysis,
      [field]: value
    });
  };
  
  // Save analysis
  const saveAnalysis = async () => {
    setSaving(true);
    setError(null);
    
    try {
      const response = await doctorService.analyzeJournalEntry(id, {
        ...analysis,
        useAI: useAI && !aiAnalysis
      });
      
      setSaveSuccess(true);
      
      // Update local entry data
      const updatedEntry = { ...entry };
      
      if (!updatedEntry.sentimentAnalysis) {
        updatedEntry.sentimentAnalysis = {};
      }
      
      updatedEntry.sentimentAnalysis.sentiment = { type: analysis.sentiment };
      updatedEntry.sentimentAnalysis.emotions = analysis.emotions.map(e => ({ name: e }));
      updatedEntry.doctorNotes = analysis.notes;
      updatedEntry.flags = analysis.flags;
      updatedEntry.isAnalyzed = true;
      
      setEntry(updatedEntry);
      
      if (response.aiAnalysis) {
        setAiAnalysis(response.aiAnalysis);
      }
      
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Error saving analysis:', error);
      setError(error.response?.data?.message || 'Failed to save analysis. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  
  // Run AI analysis manually
  const runAIAnalysis = async () => {
    setAiLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('Authentication token not found. Please log in again.');
      }
      
      console.log(`Starting AI analysis for entry ID: ${id}`);
      
      const response = await axios.post(
        `/api/doctor/journal-entries/${id}/analyze`,
        { 
          useAI: true, 
          applyChanges: true,
          includeHighlights: true
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          timeout: 20000
        }
      );
      
      console.log('Raw AI analysis response:', response.data);
      
      let analysisData = null;
      
      if (response.data && response.data.success === true) {
        if (response.data.data && response.data.data.analysis) {
          analysisData = response.data.data.analysis;
          console.log('Found analysis in data.analysis:', analysisData);
        } else if (response.data.data && response.data.data.sentimentAnalysis) {
          analysisData = response.data.data.sentimentAnalysis;
          console.log('Found analysis in data.sentimentAnalysis:', analysisData);
        } else if (response.data.aiAnalysis) {
          analysisData = response.data.aiAnalysis;
          console.log('Found analysis in aiAnalysis:', analysisData);
        } else if (response.data.data) {
          analysisData = response.data.data;
          console.log('Using data directly:', analysisData);
        } else {
          analysisData = response.data;
          console.log('Using response.data:', analysisData);
        }
      }
      
      console.log('Final analysisData:', analysisData);
      
      if (analysisData) {
        setAiAnalysis({
          sentiment: analysisData.sentiment || { type: 'neutral', score: 0.5 },
          emotions: analysisData.emotions || [],
          insights: analysisData.insights || [],
          recommendedActions: analysisData.recommendedActions || [],
          highlights: analysisData.highlights || [],
          keywords: analysisData.keywords || []
        });
        
        setAnalysis(prev => {
          const updatedAnalysis = { ...prev };
          
          if (analysisData.sentiment && analysisData.sentiment.type) {
            updatedAnalysis.sentiment = analysisData.sentiment.type;
          }
          
          if (analysisData.emotions && Array.isArray(analysisData.emotions)) {
            updatedAnalysis.emotions = analysisData.emotions.map(e => 
              typeof e === 'object' ? (e.name || e.label || e) : e
            );
          }
          
          if (analysisData.insights && Array.isArray(analysisData.insights)) {
            updatedAnalysis.notes = analysisData.insights.join('\n');
          }
          
          if (analysisData.recommendedActions && Array.isArray(analysisData.recommendedActions)) {
            updatedAnalysis.flags = ['progress'];
          }
          
          console.log('Updated analysis state:', updatedAnalysis);
          return updatedAnalysis;
        });
        
        setError(null);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        
      } else {
        throw new Error('Could not extract analysis data from response');
      }
    } catch (error) {
      console.error('Error running AI analysis:', error);
      
      let errorMessage = 'Failed to run AI analysis. ';
      
      if (error.response) {
        errorMessage += `Server responded with status ${error.response.status}: ${error.response.data?.message || 'Unknown error'}`;
        console.error('Error response data:', error.response.data);
      } else if (error.request) {
        errorMessage += 'No response received from server. Please check your network connection.';
      } else {
        errorMessage += error.message || 'Unknown error occurred';
      }
      
      setError(errorMessage);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('Using mock AI analysis data for development');
        const mockAnalysis = {
          sentiment: { type: 'neutral', score: 50 },
          emotions: [
            { name: 'calm', score: 0.7 },
            { name: 'thoughtful', score: 0.5 },
            { name: 'neutral', score: 0.3 }
          ],
          highlights: [
            {
              text: "Just try to survive another day. I don't see any hope for things getting better.",
              keyword: "hope",
              type: "negative"
            },
            {
              text: "You're failing at everything important. Everyone would be better off without your constant mistakes.",
              keyword: "failing",
              type: "negative"
            }
          ]
        };
        
        setAiAnalysis(mockAnalysis);
        
        setAnalysis(prev => ({
          ...prev,
          sentiment: mockAnalysis.sentiment.type,
          emotions: mockAnalysis.emotions.map(e => e.name)
        }));
      }
    } finally {
      setAiLoading(false);
    }
  };
  
  // Toggle emotions in the analysis
  const toggleEmotion = (emotion) => {
    const emotions = [...analysis.emotions];
    const index = emotions.indexOf(emotion);
    
    if (index >= 0) {
      emotions.splice(index, 1);
    } else {
      emotions.push(emotion);
    }
    
    handleAnalysisChange('emotions', emotions);
  };
  
  // Toggle flags in the analysis
  const toggleFlag = (flag) => {
    const flags = [...analysis.flags];
    const index = flags.indexOf(flag);
    
    if (index >= 0) {
      flags.splice(index, 1);
    } else {
      flags.push(flag);
    }
    
    handleAnalysisChange('flags', flags);
  };
  
  // Render journal content
  const renderJournalContent = () => {
    if (entry?.rawText) {
      return (
        <div className="journal-content-section">
          <h4 className="section-subtitle">Journal Entry Content</h4>
          <div className="journal-content-box">
            <p className="journal-text">{entry.rawText}</p>
          </div>
        </div>
      );
    }
    
    if (entry?.template?.fields && Array.isArray(entry.template.fields) && entry.template.fields.length > 0) {
      return entry.template.fields.map((field, index) => (
        <div key={field.id || `field-${index}`} className="journal-content-section">
          <h4 className="section-subtitle">{field.label}</h4>
          {renderFieldResponse(field)}
        </div>
      ));
    }
    
    if (entry?.responses && Object.keys(entry.responses).length > 0) {
      return Object.entries(entry.responses).map(([key, value], index) => (
        <div key={key} className="journal-content-section">
          <h4 className="section-subtitle">
            {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
          </h4>
          <p>{typeof value === 'object' ? JSON.stringify(value) : value}</p>
        </div>
      ));
    }
    
    if (entry?.journalFields && Object.keys(entry.journalFields).length > 0) {
      return Object.entries(entry.journalFields).map(([key, value], index) => (
        <div key={key} className="journal-content-section">
          <h4 className="section-subtitle">
            {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
          </h4>
          <p>
            {Array.isArray(value) 
              ? value.join(', ') 
              : (typeof value === 'object' ? JSON.stringify(value) : value)}
          </p>
        </div>
      ));
    }
    
    return (
      <div className="no-content">
        <p>No journal content found</p>
      </div>
    );
  };
  
  // Render a form field's response
  const renderFieldResponse = (field) => {
    if (!entry || !field || !entry.responses) return <p>No response</p>;
    
    const response = entry.responses[field.id];
    if (response === undefined || response === null) return <p>No response</p>;
    
    switch (field.type) {
      case 'mood-scale':
        if (!field.options) return <p>{response}</p>;
        const option = field.options.find(opt => opt.value === response || opt.value === response.toString());
        return (
          <div className="mood-response">
            <span className="mood-icon">{option?.icon || ''}</span>
            <span className="mood-label">{option?.label || response || 'No response'}</span>
          </div>
        );
        
      case 'select':
      case 'radio':
        if (!field.options) return <p>{response}</p>;
        const selectedOption = field.options.find(opt => opt.value === response || opt.value === response.toString());
        return <p>{selectedOption?.label || response || 'No response'}</p>;
        
      case 'checkbox':
        if (Array.isArray(response)) {
          if (response.length === 0) return <p>No options selected</p>;
          
          return (
            <div className="checkbox-responses">
              {response.map((value, index) => {
                const opt = field.options ? field.options.find(o => o.value === value || o.value === value.toString()) : null;
                return (
                  <span key={index} className="response-chip">
                    {opt?.label || value}
                  </span>
                );
              })}
            </div>
          );
        } else {
          return <p>Invalid response format</p>;
        }
        
      case 'textarea':
        return <p className="textarea-response">{response || 'No response'}</p>;
        
      case 'date':
        try {
          return <p>{format(new Date(response), 'MMMM dd, yyyy')}</p>;
        } catch {
          return <p>{response}</p>;
        }
        
      default:
        return <p>{typeof response === 'object' ? JSON.stringify(response) : response || 'No response'}</p>;
    }
  };
  
  // Render sentiment icon
  const renderSentimentIcon = (sentimentType) => {
    switch (sentimentType) {
      case 'positive':
        return <span className="sentiment-icon positive">😊</span>;
      case 'negative':
        return <span className="sentiment-icon negative">😔</span>;
      case 'neutral':
        return <span className="sentiment-icon neutral">😐</span>;
      default:
        return null;
    }
  };
  
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }
  
  if (error && !entry) {
    return (
      <div className="error-alert">
        <span className="alert-title">Error:</span>
        {error}
      </div>
    );
  }
  
  return (
    <div className="journal-entry-detail">
          
          {/* Header */}
          <div className="journal-header">
            <div className="header-left">
              <button 
                className="back-button" 
                onClick={() => navigate('/doctor/journal-entries')}
              >
                <span className="back-icon">←</span>
              </button>
              <div>
                <h1 className="journal-title">Journal Entry Review</h1>
              </div>
            </div>
            <div className="date-badge">
              <span className="calendar-icon">📅</span>
              <span className="date-text">
                {entry && formatDateSafe(entry.date || entry.createdAt)}
              </span>
            </div>
          </div>
          
          {/* Alerts */}
          {error && (
            <div className="error-alert">
              <span className="alert-title">Error:</span>
              {error}
            </div>
          )}
          
          {saveSuccess && (
            <div className="success-alert">
              <span className="alert-title">Success:</span>
              Analysis saved successfully!
            </div>
          )}
          
          {/* Main Content */}
          <div className="journal-grid">
            
            {/* Entry Details */}
            <div className="journal-main-content">
              <div className="form-paper">
                
                <div className="entry-header">
                  <h2 className="section-title">Entry Details</h2>
                </div>
                
                <div className="entry-info">
                  <div className="info-item">
                    <h4 className="section-subtitle">Patient</h4>
                    <p>{entry?.patientName || (entry?.user ? `${entry.user.firstName} ${entry.user.lastName}` : 'Unknown')}</p>
                  </div>
                  
                  <div className="info-item">
                    <h4 className="section-subtitle">Template</h4>
                    <p>{entry?.templateName || (entry?.template?.name ? entry.template.name : 'Custom Entry')}</p>
                  </div>
                </div>
                
                <div className="content-divider"></div>
                
                <h2 className="section-title">Responses</h2>
                
                {renderJournalContent()}
              </div>
            </div>
            
            {/* Analysis Panel */}
            <div className="journal-sidebar">
              <div className="form-paper">
                <div className="analysis-header">
                  <h2 className="section-title">Analysis</h2>
                  
                  {/* AI Toggle Button */}
                  <button 
                    className={`ai-toggle-button ${showAIAnalysis ? 'active' : ''}`}
                    onClick={() => setShowAIAnalysis(!showAIAnalysis)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                    Run AI Analysis
                  </button>
                </div>
                
                <div className="toggle-container">
                  <label className="switch">
                    <input 
                      type="checkbox" 
                      checked={useAI}
                      onChange={(e) => setUseAI(e.target.checked)}
                    />
                    <span className="slider round"></span>
                  </label>
                  <span className="toggle-label">Use AI Assistant</span>
                </div>
                
                {/* AI Analysis Section */}
                {showAIAnalysis && (
                  <div className="ai-analysis-section">
                    {useAI && !aiAnalysis && (
                      <div className="ai-run-container">
                        <button
                          className={`primary-button ${aiLoading ? 'loading' : ''}`}
                          onClick={runAIAnalysis}
                          disabled={aiLoading}
                        >
                          {aiLoading ? (
                            <>
                              <div className="button-spinner"></div>
                              Running AI Analysis...
                            </>
                          ) : (
                            <>
                              <span>🤖</span>
                              Run AI Analysis
                            </>
                          )}
                        </button>
                      </div>
                    )}
                    
                    {aiAnalysis && (
                      <div className="ai-results">
                        <div className="ai-results-header">
                          <h3>AI Analysis Results</h3>
                        </div>
                        
                        <div className="ai-sentiment">
                          <h4 className="section-subtitle">Sentiment</h4>
                          <div className="sentiment-display">
                            {renderSentimentIcon(aiAnalysis.sentiment?.type)}
                            <span className="sentiment-text">
                              {aiAnalysis.sentiment?.type 
                                ? aiAnalysis.sentiment.type.charAt(0).toUpperCase() + aiAnalysis.sentiment.type.slice(1)
                                : 'Not detected'}
                            </span>
                          </div>
                        </div>
                        
                        {aiAnalysis.emotions && aiAnalysis.emotions.length > 0 && (
                          <div className="ai-emotions">
                            <h4 className="section-subtitle">Detected Emotions</h4>
                            <div className="emotion-chips">
                              {aiAnalysis.emotions.map((emotion, index) => (
                                <span key={index} className="emotion-chip">
                                  {typeof emotion === 'object' ? emotion.name : emotion}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {aiAnalysis.highlights && aiAnalysis.highlights.length > 0 && (
                          <div className="ai-highlights">
                            <h4 className="section-subtitle">Key Phrases</h4>
                            {aiAnalysis.highlights.map((highlight, index) => (
                              <div 
                                key={index} 
                                className={`highlight-item ${highlight.type}`}
                              >
                                <p className="highlight-text">"{highlight.text}"</p>
                                <span className="highlight-keyword">
                                  Keyword: <strong>{highlight.keyword}</strong>
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {aiAnalysis.keywords && aiAnalysis.keywords.length > 0 && (
                          <div className="ai-keywords">
                            <h4 className="section-subtitle">Keywords</h4>
                            <div className="keyword-chips">
                              {aiAnalysis.keywords.map((keyword, index) => (
                                <span key={index} className="keyword-chip">
                                  {keyword}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Manual Analysis Form */}
                <div className="manual-analysis">
                  <div className="form-section">
                    <label className="form-label">Sentiment</label>
                    <select 
                      className="form-select"
                      value={analysis.sentiment}
                      onChange={(e) => handleAnalysisChange('sentiment', e.target.value)}
                    >
                      <option value="">Not Selected</option>
                      <option value="positive">Positive</option>
                      <option value="neutral">Neutral</option>
                      <option value="negative">Negative</option>
                    </select>
                  </div>
                  
                  <div className="form-section">
                    <label className="form-label">Emotions</label>
                    <div className="selected-emotions">
                      {analysis.emotions.map((emotion, index) => (
                        <span 
                          key={index} 
                          className="selected-emotion-chip"
                          onClick={() => toggleEmotion(emotion)}
                        >
                          {emotion}
                          <span className="remove-emotion">×</span>
                        </span>
                      ))}
                    </div>
                    <p className="form-hint">Common emotions:</p>
                    <div className="emotion-options">
                      {commonEmotions.map((emotion) => (
                        <span
                          key={emotion}
                          className={`emotion-option ${analysis.emotions.includes(emotion) ? 'selected' : ''}`}
                          onClick={() => toggleEmotion(emotion)}
                        >
                          {emotion}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="form-section">
                    <label className="form-label">Doctor Notes</label>
                    <textarea
                      className="form-textarea"
                      rows={4}
                      placeholder="Add your professional notes about this journal entry..."
                      value={analysis.notes}
                      onChange={(e) => handleAnalysisChange('notes', e.target.value)}
                    />
                  </div>
                  
                  <div className="form-section">
                    <label className="form-label">Flags</label>
                    <div className="flag-options">
                      <span
                        className={`flag-option follow-up ${analysis.flags.includes('follow-up') ? 'selected' : ''}`}
                        onClick={() => toggleFlag('follow-up')}
                      >
                        Follow Up Needed
                      </span>
                      <span
                        className={`flag-option concerning ${analysis.flags.includes('concerning') ? 'selected' : ''}`}
                        onClick={() => toggleFlag('concerning')}
                      >
                        Concerning Content
                      </span>
                      <span
                        className={`flag-option progress ${analysis.flags.includes('progress') ? 'selected' : ''}`}
                        onClick={() => toggleFlag('progress')}
                      >
                        Progress
                      </span>
                      <span
                        className={`flag-option discuss ${analysis.flags.includes('discuss') ? 'selected' : ''}`}
                        onClick={() => toggleFlag('discuss')}
                      >
                        Discuss
                      </span>
                    </div>
                  </div>
                  
                  <button
                    className={`primary-button large-button ${saving ? 'loading' : ''}`}
                    onClick={saveAnalysis}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save Analysis'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
  );
};

export default JournalEntryDetail;