// client/src/components/doctors/JournalReview/JournalReview.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  Divider,
  Grid,
  Chip,
  CircularProgress,
  Card,
  CardContent,
  TextField,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar
} from '@mui/material';
import { styled } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import WarningIcon from '@mui/icons-material/Warning';
import SentimentSatisfiedAltIcon from '@mui/icons-material/SentimentSatisfiedAlt';
import SentimentNeutralIcon from '@mui/icons-material/SentimentNeutral';
import SentimentVeryDissatisfiedIcon from '@mui/icons-material/SentimentVeryDissatisfied';
import { format } from 'date-fns';
import axios from 'axios';

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  marginBottom: theme.spacing(3),
  borderRadius: 8,
  boxShadow: '0px 2px 4px rgba(0,0,0,0.05)'
}));

const SentimentBadge = styled(Chip)(({ theme, sentimentType }) => {
  const colors = {
    positive: {
      bg: theme.palette.success.light,
      color: theme.palette.success.dark
    },
    neutral: {
      bg: theme.palette.warning.light,
      color: theme.palette.warning.dark
    },
    negative: {
      bg: theme.palette.error.light,
      color: theme.palette.error.dark
    },
    unanalyzed: {
      bg: theme.palette.grey[200],
      color: theme.palette.grey[700]
    }
  };
  
  const style = colors[sentimentType] || colors.unanalyzed;
  
  return {
    backgroundColor: style.bg,
    color: style.color,
    fontWeight: 'bold'
  };
});

const StyledDivider = styled(Divider)(({ theme }) => ({
  margin: theme.spacing(3, 0)
}));

// Add this new styled component for highlighted text
const HighlightedText = styled(Box)(({ theme, type }) => {
  const colors = {
    positive: {
      bg: theme.palette.success.light,
      border: theme.palette.success.main
    },
    neutral: {
      bg: theme.palette.warning.light,
      border: theme.palette.warning.main
    },
    negative: {
      bg: theme.palette.error.light,
      border: theme.palette.error.main
    }
  };
  
  const style = colors[type] || colors.neutral;
  
  return {
    backgroundColor: style.bg,
    borderLeft: `4px solid ${style.border}`,
    padding: theme.spacing(1.5),
    borderRadius: theme.spacing(0.5),
    marginBottom: theme.spacing(1.5),
    position: 'relative'
  };
});

const JournalReview = () => {
  const { journalId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [entry, setEntry] = useState(null);
  const [patient, setPatient] = useState(null);
  const [error, setError] = useState(null);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info'
  });
  
  // Fetch journal entry
  useEffect(() => {
    const fetchJournalEntry = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`/api/doctors/journal-entries/${journalId}`);
        
        if (response.data.success && response.data.data) {
          setEntry(response.data.data);
          setPatient(response.data.data.user);
        } else {
          setError('Failed to load journal entry');
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching journal entry:', error);
        setError('Failed to load journal entry. Please try again later.');
        setLoading(false);
      }
    };
    
    if (journalId) {
      fetchJournalEntry();
    }
  }, [journalId]);
  
  // Handle analyze journal entry
  const handleAnalyze = async () => {
    try {
      setAnalyzing(true);
      setError(null);
      
      const response = await axios.post(`/api/doctors/journal-entries/${journalId}/analyze`);
      
      if (response.data.success && response.data.data) {
        setEntry({
          ...entry,
          sentimentAnalysis: response.data.data
        });
        
        setSnackbar({
          open: true,
          message: 'Journal analysis completed successfully',
          severity: 'success'
        });
      } else {
        setError('Failed to analyze journal entry');
      }
      
      setAnalyzing(false);
    } catch (error) {
      console.error('Error analyzing journal entry:', error);
      setError('Failed to analyze journal entry. Please try again.');
      setAnalyzing(false);
    }
  };
  
  // Handle add note
  const handleAddNote = async () => {
    if (!noteContent.trim()) {
      setSnackbar({
        open: true,
        message: 'Note content cannot be empty',
        severity: 'error'
      });
      return;
    }
    
    try {
      const response = await axios.post(`/api/doctors/journal-entries/${journalId}/notes`, {
        content: noteContent
      });
      
      if (response.data.success && response.data.data) {
        // Update entry with new note
        setEntry({
          ...entry,
          doctorNotes: [...(entry.doctorNotes || []), response.data.data]
        });
        
        setNoteContent('');
        setNoteDialogOpen(false);
        
        setSnackbar({
          open: true,
          message: 'Note added successfully',
          severity: 'success'
        });
      } else {
        setError('Failed to add note');
      }
    } catch (error) {
      console.error('Error adding note:', error);
      setError('Failed to add note. Please try again.');
    }
  };
  
  // Get sentiment icon based on type
  const getSentimentIcon = (type) => {
    switch (type) {
      case 'positive':
        return <SentimentSatisfiedAltIcon fontSize="small" />;
      case 'negative':
        return <SentimentVeryDissatisfiedIcon fontSize="small" />;
      case 'neutral':
        return <SentimentNeutralIcon fontSize="small" />;
      default:
        return null;
    }
  };
  
  // Format date
  const formatDate = (dateString) => {
    try {
      return format(new Date(dateString), 'PPP p');
    } catch (error) {
      return dateString;
    }
  };
  
  // Extract response text for display
  const extractResponseText = (responses) => {
    if (!responses) return '';
    
    let text = '';
    
    // If responses is a Map or object
    const responsesObj = responses instanceof Map ? 
      Object.fromEntries(responses) : responses;
    
    // Concatenate all text responses
    for (const [, value] of Object.entries(responsesObj)) {
      if (typeof value === 'string') {
        text += value + ' ';
      } else if (value && typeof value === 'object') {
        if (Array.isArray(value)) {
          text += value.join(', ') + ' ';
        } else if (value.text) {
          text += value.text + ' ';
        } else if (value.answer) {
          text += value.answer + ' ';
        }
      }
    }
    
    return text.trim();
  };
  
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }
  
  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          sx={{ mt: 2 }}
        >
          Go Back
        </Button>
      </Box>
    );
  }
  
  if (!entry) {
    return (
      <Box p={3}>
        <Alert severity="warning">Journal entry not found</Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          sx={{ mt: 2 }}
        >
          Go Back
        </Button>
      </Box>
    );
  }
  
  const hasAnalysis = entry.sentimentAnalysis && entry.sentimentAnalysis.sentiment;
  
  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
      
      {/* Note dialog */}
      <Dialog
        open={noteDialogOpen}
        onClose={() => setNoteDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Add Note to Journal Entry</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            id="note"
            label="Note Content"
            type="text"
            fullWidth
            multiline
            rows={4}
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNoteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddNote} variant="contained" color="primary">
            Add Note
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Header with navigation */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton 
          onClick={() => navigate(-1)} 
          sx={{ mr: 1 }}
          aria-label="Go back"
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5">
          Journal Entry Review
        </Typography>
      </Box>
      
      {/* Patient info and entry date */}
      <StyledPaper>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6}>
            <Typography variant="subtitle1" fontWeight="bold">
              Patient
            </Typography>
            <Typography variant="body1">
              {patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown'}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="subtitle1" fontWeight="bold">
              Date Submitted
            </Typography>
            <Typography variant="body1">
              {entry.createdAt ? formatDate(entry.createdAt) : 'Unknown'}
            </Typography>
          </Grid>
        </Grid>
        
        <StyledDivider />
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            {entry.template && (
              <Typography variant="subtitle2" color="text.secondary">
                Template: {entry.template.name}
              </Typography>
            )}
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            {hasAnalysis ? (
              <SentimentBadge
                label={entry.sentimentAnalysis.sentiment.type.toUpperCase()}
                sentimentType={entry.sentimentAnalysis.sentiment.type}
                icon={getSentimentIcon(entry.sentimentAnalysis.sentiment.type)}
              />
            ) : (
              <Button
                variant="outlined"
                startIcon={<AnalyticsIcon />}
                onClick={handleAnalyze}
                disabled={analyzing}
              >
                {analyzing ? 'Analyzing...' : 'Analyze Sentiment'}
              </Button>
            )}
            
            <Button
              variant="outlined"
              startIcon={<NoteAddIcon />}
              onClick={() => setNoteDialogOpen(true)}
            >
              Add Note
            </Button>
          </Box>
        </Box>
      </StyledPaper>
      
      {/* Journal content */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <StyledPaper>
            <Typography variant="h6" gutterBottom>
              Journal Content
            </Typography>
            
            {entry.template && Array.isArray(entry.template.fields) ? (
              <>
                {entry.template.fields.map((field) => {
                  const response = entry.responses?.[field.id];
                  if (!response || (Array.isArray(response) && response.length === 0)) {
                    return null;
                  }
                  
                  return (
                    <Box key={field.id} sx={{ mb: 3 }}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {field.label}
                      </Typography>
                      <Typography variant="body1">
                        {Array.isArray(response) ? response.join(', ') : response.toString()}
                      </Typography>
                    </Box>
                  );
                })}
              </>
            ) : (
              <Typography variant="body1">
                {entry.rawText || extractResponseText(entry.responses) || 'No content available'}
              </Typography>
            )}
          </StyledPaper>
        </Grid>
        
        <Grid item xs={12} md={5}>
          {/* Sentiment Analysis */}
          <StyledPaper>
            <Typography variant="h6" gutterBottom>
              Sentiment Analysis
            </Typography>
            
            {hasAnalysis ? (
              <>
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={6}>
                    <Card sx={{ height: '100%' }}>
                      <CardContent>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Sentiment Type
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          {getSentimentIcon(entry.sentimentAnalysis.sentiment.type)}
                          <Typography variant="h6" sx={{ ml: 1 }}>
                            {entry.sentimentAnalysis.sentiment.type.charAt(0).toUpperCase() + 
                              entry.sentimentAnalysis.sentiment.type.slice(1)}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={6}>
                    <Card sx={{ height: '100%' }}>
                      <CardContent>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Confidence Score
                        </Typography>
                        <Typography variant="h6">
                          {Math.round(entry.sentimentAnalysis.sentiment.score)}%
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
                
                {/* Emotions */}
                {entry.sentimentAnalysis.emotions && 
                 entry.sentimentAnalysis.emotions.length > 0 && (
                  <Box sx={{ my: 2 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Detected Emotions
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {entry.sentimentAnalysis.emotions
                        .slice(0, 5)
                        .map((emotion, index) => (
                          <Chip
                            key={index}
                            label={`${emotion.name}: ${Math.round(emotion.score * 100)}%`}
                            size="small"
                          />
                        ))}
                    </Box>
                  </Box>
                )}
                
                {/* Key Phrase Highlights - NEW SECTION */}
                {entry.sentimentAnalysis.highlights && 
                 entry.sentimentAnalysis.highlights.length > 0 && (
                  <Box sx={{ my: 3 }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                      Key Phrases
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      These phrases significantly influenced the sentiment analysis:
                    </Typography>
                    
                    {entry.sentimentAnalysis.highlights.map((highlight, index) => (
                      <HighlightedText key={index} type={highlight.type}>
                        <Typography variant="body2">
                          "{highlight.text}"
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                          Keyword: <strong>{highlight.keyword}</strong>
                        </Typography>
                      </HighlightedText>
                    ))}
                  </Box>
                )}
                
                {/* Flags */}
                {entry.sentimentAnalysis.flags && 
                 entry.sentimentAnalysis.flags.length > 0 && (
                  <Box sx={{ my: 2 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Flags
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {entry.sentimentAnalysis.flags.map((flag, index) => (
                        <Chip
                          key={index}
                          label={flag.replace('_', ' ')}
                          color={flag.includes('suicidal') || flag.includes('urgent') ? 'error' : 'default'}
                          icon={flag.includes('suicidal') || flag.includes('urgent') ? <WarningIcon /> : null}
                          size="small"
                        />
                      ))}
                    </Box>
                  </Box>
                )}
                
                {/* Summary */}
                {entry.sentimentAnalysis.summary && (
                  <Box sx={{ my: 2 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Summary
                    </Typography>
                    <Typography variant="body2">
                      {entry.sentimentAnalysis.summary}
                    </Typography>
                  </Box>
                )}
              </>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  No sentiment analysis available
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AnalyticsIcon />}
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  sx={{ mt: 1 }}
                >
                  {analyzing ? (
                    <>
                      <CircularProgress size={20} sx={{ mr: 1 }} />
                      Analyzing...
                    </>
                  ) : 'Analyze Sentiment'}
                </Button>
              </Box>
            )}
          </StyledPaper>
          
          {/* Doctor Notes */}
          <StyledPaper>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Doctor Notes
              </Typography>
              <Button
                startIcon={<NoteAddIcon />}
                onClick={() => setNoteDialogOpen(true)}
                size="small"
              >
                Add Note
              </Button>
            </Box>
            {entry.doctorNotes && entry.doctorNotes.length > 0 ? (
              <List sx={{ width: '100%', bgcolor: 'background.paper' }}>
                {entry.doctorNotes.map((note, index) => (
                  <React.Fragment key={index}>
                    {index > 0 && <Divider component="li" />}
                    <ListItem alignItems="flex-start">
                      <ListItemAvatar>
                        <Avatar>{note.createdBy ? note.createdBy.firstName?.[0] : 'D'}</Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Typography
                            variant="subtitle2"
                            color="text.primary"
                          >
                            {note.createdAt ? formatDate(note.createdAt) : 'Unknown date'}
                          </Typography>
                        }
                        secondary={
                          <Typography
                            variant="body2"
                            color="text.primary"
                            sx={{ mt: 1 }}
                          >
                            {note.content}
                          </Typography>
                        }
                      />
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary" align="center" py={2}>
                No notes added yet
              </Typography>
            )}
          </StyledPaper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default JournalReview;