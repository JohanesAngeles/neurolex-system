import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Chip,
  Alert,
  Paper,
  Divider
} from '@mui/material';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import MoodIcon from '@mui/icons-material/Mood';
import SentimentVeryDissatisfiedIcon from '@mui/icons-material/SentimentVeryDissatisfied';
import SentimentNeutralIcon from '@mui/icons-material/SentimentNeutral';
import axios from 'axios';

/**
 * Component for running sentiment analysis on journal entries
 * @param {Object} props
 * @param {string} props.entryId - Journal entry ID
 * @param {Function} props.onAnalysisComplete - Callback when analysis is complete
 * @param {boolean} props.disabled - Whether the component is disabled
 */
const SentimentAnalysis = ({ entryId, onAnalysisComplete, disabled = false }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // Run the sentiment analysis
  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get the authentication token from localStorage
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      // Make the API request with proper authentication
      const response = await axios.post(
        `/api/doctor/journal-entries/${entryId}/analyze`, 
        { useAI: true },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const analysisResult = response.data;
      setResult(analysisResult);
      
      // Call the callback with the results
      if (onAnalysisComplete) {
        onAnalysisComplete(analysisResult);
      }
    } catch (err) {
      console.error('Error running sentiment analysis:', err);
      const message = err.response?.data?.message || err.message || 'Failed to run analysis';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // Render sentiment icon based on type
  const renderSentimentIcon = (sentimentType) => {
    switch (sentimentType) {
      case 'positive':
        return <MoodIcon fontSize="large" sx={{ color: 'success.main' }} />;
      case 'negative':
        return <SentimentVeryDissatisfiedIcon fontSize="large" sx={{ color: 'error.main' }} />;
      case 'neutral':
      default:
        return <SentimentNeutralIcon fontSize="large" sx={{ color: 'warning.main' }} />;
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={runAnalysis}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}
      
      {!result && (
        <Button
          variant="outlined"
          startIcon={loading ? <CircularProgress size={20} /> : <AutoFixHighIcon />}
          onClick={runAnalysis}
          disabled={loading || disabled}
          fullWidth
        >
          {loading ? 'Running AI Analysis...' : 'Run AI Analysis'}
        </Button>
      )}
      
      {result && (
        <Paper sx={{ p: 2, mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            AI Analysis Results
          </Typography>
          
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Sentiment
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {renderSentimentIcon(result.sentiment?.type)}
              <Typography sx={{ ml: 1 }}>
                {result.sentiment?.type 
                  ? result.sentiment.type.charAt(0).toUpperCase() + result.sentiment.type.slice(1)
                  : 'Not detected'}
              </Typography>
            </Box>
          </Box>
          
          {result.emotions && result.emotions.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Detected Emotions
              </Typography>
              <Box>
                {result.emotions.map((emotion, index) => (
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
          
          {result.flags && result.flags.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Flags
              </Typography>
              <Box>
                {result.flags.map((flag, index) => (
                  <Chip
                    key={index}
                    label={flag.replace('_', ' ')}
                    color={flag.includes('urgent') ? 'error' : 'warning'}
                    size="small"
                    sx={{ mr: 0.5, mb: 0.5 }}
                  />
                ))}
              </Box>
            </Box>
          )}
          
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Button
              size="small"
              onClick={() => setResult(null)}
            >
              Run Again
            </Button>
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default SentimentAnalysis;