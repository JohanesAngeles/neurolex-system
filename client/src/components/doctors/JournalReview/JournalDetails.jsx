import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Divider,
  TextField,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Switch,
  FormControlLabel
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MoodIcon from '@mui/icons-material/Mood';
import SentimentVeryDissatisfiedIcon from '@mui/icons-material/SentimentVeryDissatisfied';
import SentimentNeutralIcon from '@mui/icons-material/SentimentNeutral';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { format, parseISO, isValid } from 'date-fns';
import doctorService from '../../../services/doctorService';
import axios from 'axios';

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
          applyChanges: true,  // ← SAVE IMMEDIATELY
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
        if (response.data.data && response.data.data.sentimentAnalysis) {
          analysisData = response.data.data.sentimentAnalysis;
        } else if (response.data.aiAnalysis) {
          analysisData = response.data.aiAnalysis;
        } else if (response.data.data) {
          analysisData = response.data.data;
        } else {
          analysisData = response.data;
        }
      }
      
      if (analysisData) {
        setAiAnalysis({
          ...analysisData,
          highlights: analysisData.highlights || 
                    (response.data.data?.sentimentAnalysis?.highlights) ||
                    (response.data.aiAnalysis?.highlights) || []
        });
        
        setAnalysis(prev => {
          const updatedAnalysis = { ...prev };
          
          if (analysisData.sentiment && analysisData.sentiment.type) {
            updatedAnalysis.sentiment = analysisData.sentiment.type;
          }
          
          if (analysisData.emotions && Array.isArray(analysisData.emotions)) {
            updatedAnalysis.emotions = analysisData.emotions.map(e => 
              typeof e === 'object' ? e.name : e
            );
          }
          
          console.log('Updated analysis state:', updatedAnalysis);
          return updatedAnalysis;
        });
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
  
  // ✅ FIXED: Render journal content (rawText instead of structured responses)
  const renderJournalContent = () => {
    // Priority 1: Check for rawText (new simplified format)
    if (entry?.rawText) {
      return (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Journal Entry Content
          </Typography>
          <Paper 
            variant="outlined" 
            sx={{ 
              p: 2, 
              backgroundColor: 'grey.50',
              borderRadius: 2
            }}
          >
            <Typography 
              variant="body1" 
              sx={{ 
                whiteSpace: 'pre-line',
                lineHeight: 1.6
              }}
            >
              {entry.rawText}
            </Typography>
          </Paper>
        </Box>
      );
    }
    
    // Priority 2: Check for old structured responses (for backward compatibility)
    if (entry?.template?.fields && Array.isArray(entry.template.fields) && entry.template.fields.length > 0) {
      return entry.template.fields.map((field, index) => (
        <Box key={field.id || `field-${index}`} sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            {field.label}
          </Typography>
          {renderFieldResponse(field)}
        </Box>
      ));
    }
    
    // Priority 3: Check for responses object
    if (entry?.responses && Object.keys(entry.responses).length > 0) {
      return Object.entries(entry.responses).map(([key, value], index) => (
        <Box key={key} sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
          </Typography>
          <Typography>
            {typeof value === 'object' ? JSON.stringify(value) : value}
          </Typography>
        </Box>
      ));
    }
    
    // Priority 4: Check for journalFields
    if (entry?.journalFields && Object.keys(entry.journalFields).length > 0) {
      return Object.entries(entry.journalFields).map(([key, value], index) => (
        <Box key={key} sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
          </Typography>
          <Typography>
            {Array.isArray(value) 
              ? value.join(', ') 
              : (typeof value === 'object' ? JSON.stringify(value) : value)}
          </Typography>
        </Box>
      ));
    }
    
    // No content found
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="text.secondary">
          No journal content found
        </Typography>
      </Box>
    );
  };
  
  // Render a form field's response (for backward compatibility)
  const renderFieldResponse = (field) => {
    if (!entry || !field || !entry.responses) return 'No response';
    
    const response = entry.responses[field.id];
    if (response === undefined || response === null) return 'No response';
    
    switch (field.type) {
      case 'mood-scale':
        if (!field.options) return response;
        const option = field.options.find(opt => opt.value === response || opt.value === response.toString());
        return (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant="h5" sx={{ mr: 1 }}>
              {option?.icon || ''}
            </Typography>
            <Typography>
              {option?.label || response || 'No response'}
            </Typography>
          </Box>
        );
        
      case 'select':
      case 'radio':
        if (!field.options) return response;
        const selectedOption = field.options.find(opt => opt.value === response || opt.value === response.toString());
        return <Typography>{selectedOption?.label || response || 'No response'}</Typography>;
        
      case 'checkbox':
        if (Array.isArray(response)) {
          if (response.length === 0) return 'No options selected';
          
          return (
            <Box>
              {response.map((value, index) => {
                const opt = field.options ? field.options.find(o => o.value === value || o.value === value.toString()) : null;
                return (
                  <Chip 
                    key={index}
                    label={opt?.label || value}
                    sx={{ mr: 0.5, mb: 0.5 }}
                    size="small"
                  />
                );
              })}
            </Box>
          );
        } else {
          return 'Invalid response format';
        }
        
      case 'textarea':
        return (
          <Typography sx={{ whiteSpace: 'pre-line' }}>
            {response || 'No response'}
          </Typography>
        );
        
      case 'date':
        try {
          return format(new Date(response), 'MMMM dd, yyyy');
        } catch {
          return response;
        }
        
      default:
        return <Typography>{typeof response === 'object' ? JSON.stringify(response) : response || 'No response'}</Typography>;
    }
  };
  
  // Render sentiment icon
  const renderSentimentIcon = (sentimentType) => {
    switch (sentimentType) {
      case 'positive':
        return <MoodIcon fontSize="large" sx={{ color: 'success.main' }} />;
      case 'negative':
        return <SentimentVeryDissatisfiedIcon fontSize="large" sx={{ color: 'error.main' }} />;
      case 'neutral':
        return <SentimentNeutralIcon fontSize="large" sx={{ color: 'warning.main' }} />;
      default:
        return null;
    }
  };
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
        <CircularProgress />
      </Box>
    );
  }
  
  if (error && !entry) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }
  
  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate('/doctor/journal-entries')} sx={{ mr: 1 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5">
          Journal Entry Review
        </Typography>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {saveSuccess && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Analysis saved successfully!
        </Alert>
      )}
      
      <Grid container spacing={3}>
        {/* Entry Details */}
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">Entry Details</Typography>
              <Typography variant="body2" color="text.secondary">
                {entry && formatDateSafe(entry.date || entry.createdAt)}
              </Typography>
            </Box>
            
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Patient
              </Typography>
              <Typography variant="body1">
                {entry?.patientName || (entry?.user ? `${entry.user.firstName} ${entry.user.lastName}` : 'Unknown')}
              </Typography>
            </Box>
            
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Template
              </Typography>
              <Typography variant="body1">
                {entry?.templateName || (entry?.template?.name ? entry.template.name : 'Custom Entry')}
              </Typography>
            </Box>
            
            <Divider sx={{ my: 3 }} />
            
            <Typography variant="h6" gutterBottom>
              Responses
            </Typography>
            
            {/* ✅ FIXED: Use the new renderJournalContent function */}
            {renderJournalContent()}
          </Paper>
        </Grid>
        
        {/* Analysis Panel */}
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Analysis
            </Typography>
            
            <FormControlLabel
              control={
                <Switch
                  checked={useAI}
                  onChange={(e) => setUseAI(e.target.checked)}
                  color="primary"
                />
              }
              label="Use AI Assistant"
              sx={{ mb: 2 }}
            />
            
            {useAI && !aiAnalysis && (
              <Box sx={{ mb: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={aiLoading ? <CircularProgress size={20} /> : <AutoFixHighIcon />}
                  onClick={runAIAnalysis}
                  disabled={aiLoading}
                  fullWidth
                >
                  {aiLoading ? 'Running AI Analysis...' : 'Run AI Analysis'}
                </Button>
              </Box>
            )}
            
            {aiAnalysis && (
              <Accordion sx={{ mb: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>AI Analysis Results</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Sentiment
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {renderSentimentIcon(aiAnalysis.sentiment?.type)}
                      <Typography sx={{ ml: 1 }}>
                        {aiAnalysis.sentiment?.type 
                          ? aiAnalysis.sentiment.type.charAt(0).toUpperCase() + aiAnalysis.sentiment.type.slice(1)
                          : 'Not detected'}
                      </Typography>
                    </Box>
                  </Box>
                  
                  {aiAnalysis.emotions && aiAnalysis.emotions.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Detected Emotions
                      </Typography>
                      <Box>
                        {aiAnalysis.emotions.map((emotion, index) => (
                          <Chip
                            key={index}
                            label={typeof emotion === 'object' ? emotion.name : emotion}
                            size="small"
                            sx={{ mr: 0.5, mb: 0.5 }}
                          />
                        ))}
                      </Box>
                    </Box>
                  )}
                  
                  {aiAnalysis.highlights && aiAnalysis.highlights.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Key Phrases
                      </Typography>
                      {aiAnalysis.highlights.map((highlight, index) => (
                        <Box 
                          key={index} 
                          sx={{ 
                            p: 1.5, 
                            mb: 1.5, 
                            borderRadius: 1,
                            borderLeft: `4px solid ${highlight.type === 'positive' 
                              ? '#4caf50' 
                              : highlight.type === 'negative' 
                                ? '#f44336' 
                                : '#ff9800'}`,
                            backgroundColor: highlight.type === 'positive' 
                              ? 'rgba(76,175,80,0.1)' 
                              : highlight.type === 'negative' 
                                ? 'rgba(244,67,54,0.1)' 
                                : 'rgba(255,152,0,0.1)',
                          }}
                        >
                          <Typography variant="body2">
                            "{highlight.text}"
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                            Keyword: <strong>{highlight.keyword}</strong>
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                  
                  {aiAnalysis.keywords && aiAnalysis.keywords.length > 0 && (
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Keywords
                      </Typography>
                      <Box>
                        {aiAnalysis.keywords.map((keyword, index) => (
                          <Chip
                            key={index}
                            label={keyword}
                            variant="outlined"
                            size="small"
                            sx={{ mr: 0.5, mb: 0.5 }}
                          />
                        ))}
                      </Box>
                    </Box>
                  )}
                </AccordionDetails>
              </Accordion>
            )}
            
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Sentiment</InputLabel>
              <Select
                value={analysis.sentiment}
                onChange={(e) => handleAnalysisChange('sentiment', e.target.value)}
                label="Sentiment"
              >
                <MenuItem value="">Not Selected</MenuItem>
                <MenuItem value="positive">Positive</MenuItem>
                <MenuItem value="neutral">Neutral</MenuItem>
                <MenuItem value="negative">Negative</MenuItem>
              </Select>
            </FormControl>
            
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Emotions
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', mb: 1 }}>
                {analysis.emotions.map((emotion, index) => (
                  <Chip
                    key={index}
                    label={emotion}
                    onDelete={() => toggleEmotion(emotion)}
                    sx={{ mr: 0.5, mb: 0.5 }}
                  />
                ))}
              </Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Common emotions:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
                {commonEmotions.map((emotion) => (
                  <Chip
                    key={emotion}
                    label={emotion}
                    variant={analysis.emotions.includes(emotion) ? 'filled' : 'outlined'}
                    onClick={() => toggleEmotion(emotion)}
                    sx={{ mr: 0.5, mb: 0.5 }}
                    size="small"
                  />
                ))}
              </Box>
            </Box>
            
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Doctor Notes
              </Typography>
              <TextField
                multiline
                rows={4}
                fullWidth
                placeholder="Add your professional notes about this journal entry..."
                value={analysis.notes}
                onChange={(e) => handleAnalysisChange('notes', e.target.value)}
              />
            </Box>
            
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Flags
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
                <Chip
                  label="Follow Up Needed"
                  variant={analysis.flags.includes('follow-up') ? 'filled' : 'outlined'}
                  onClick={() => toggleFlag('follow-up')}
                  sx={{ mr: 0.5, mb: 0.5 }}
                  color="primary"
                />
                <Chip
                  label="Concerning Content"
                  variant={analysis.flags.includes('concerning') ? 'filled' : 'outlined'}
                  onClick={() => toggleFlag('concerning')}
                  sx={{ mr: 0.5, mb: 0.5 }}
                  color="error"
                />
                <Chip
                  label="Progress"
                  variant={analysis.flags.includes('progress') ? 'filled' : 'outlined'}
                  onClick={() => toggleFlag('progress')}
                  sx={{ mr: 0.5, mb: 0.5 }}
                  color="success"
                />
                <Chip
                  label="Discuss"
                  variant={analysis.flags.includes('discuss') ? 'filled' : 'outlined'}
                  onClick={() => toggleFlag('discuss')}
                  sx={{ mr: 0.5, mb: 0.5 }}
                  color="warning"
                />
              </Box>
            </Box>
            
            <Button
              variant="contained"
              color="primary"
              fullWidth
              onClick={saveAnalysis}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Analysis'}
            </Button>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default JournalEntryDetail;