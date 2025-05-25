import React, { useState, useEffect } from 'react';
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

  // Check if backend is available on mount
  useEffect(() => {
    checkBackendStatus();
  }, []);

  // Check backend status to ensure API is available
  const checkBackendStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('No authentication token found');
        return;
      }

      // Simple health check to see if API is accessible
      await axios.get('/api/health', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (err) {
      console.warn('Backend health check failed:', err.message);
      // Don't set error yet, just log it
    }
  };

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
          },
          // Add timeout to prevent UI freezing if API is slow
          timeout: 15000
        }
      );
      
      // Check if the response contains the expected data structure
      if (!response.data || typeof response.data !== 'object') {
        throw new Error('Invalid response format from analysis API');
      }
      
      const analysisResult = response.data;
      
      // Log the result for debugging
      console.log('Analysis result received:', analysisResult);
      
      setResult(analysisResult);
      
      // Call the callback with the results
      if (onAnalysisComplete) {
        onAnalysisComplete(analysisResult);
      }
    } catch (err) {
      console.error('Error running sentiment analysis:', err);
      
      // Extract the most useful error message
      let message;
      if (err.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        message = err.response.data?.message || `Server error: ${err.response.status}`;
      } else if (err.request) {
        // The request was made but no response was received
        message = 'No response from server. Please check your network connection.';
      } else {
        // Something happened in setting up the request that triggered an Error
        message = err.message || 'Failed to run analysis';
      }
      
      setError(message);
      
      // If we're in development, provide a fallback mock result after error
      if (process.env.NODE_ENV === 'development') {
        console.log('Using fallback mock data in development mode');
        const mockResult = getMockAnalysisResult();
        setResult(mockResult);
        
        if (onAnalysisComplete) {
          onAnalysisComplete(mockResult);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Mock data for testing/development only
  const getMockAnalysisResult = () => {
    return {
      sentiment: {
        type: 'neutral',
        score: 65,
        confidence: 0.65
      },
      emotions: [
        { name: 'calm', score: 0.6 },
        { name: 'neutral', score: 0.3 },
        { name: 'hopeful', score: 0.1 }
      ],
      flags: []
    };
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