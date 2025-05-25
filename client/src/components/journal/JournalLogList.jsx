import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../App';
import '../../styles/components/journal/JournalList.css';

// Material UI imports
import { 
  Container,
  Typography,
  TextField,
  Button,
  Box,
  Select,
  MenuItem,
  FormControl,
  IconButton,
  Pagination,
  CircularProgress,
  Alert,
  InputAdornment
} from '@mui/material';

// Import icons
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';

// Import SVG icons for action buttons
import ViewIcon from '../../assets/icons/view_icon.svg';
import EditIcon from '../../assets/icons/edit_icon.svg';
import DeleteIcon from '../../assets/icons/delete_icon.svg';

// Import service if available
import authService from '../../services/authService';

const JournalList = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [manualUser, setManualUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [journalEntries, setJournalEntries] = useState([]);
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [refreshTimestamp, setRefreshTimestamp] = useState(Date.now());
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [moodFilter, setMoodFilter] = useState('All');
  const [sentimentFilter, setSentimentFilter] = useState('All');

  // Determine the effective user - either from context or manual fallback
  const effectiveUser = user || manualUser;

  // Immediately load user data from localStorage on mount
  useEffect(() => {
    console.log("JournalList: Checking localStorage for user data");
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const userData = JSON.parse(userStr);
        console.log("JournalList: Found user in localStorage:", userData);
        setManualUser(userData);
        
        // Also try to get tenant info
        const tenantStr = localStorage.getItem('tenant');
        if (tenantStr) {
          try {
            const tenantData = JSON.parse(tenantStr);
            console.log("JournalList: Found tenant in localStorage:", tenantData);
            setTenant(tenantData);
          } catch (e) {
            console.error("Error parsing tenant data:", e);
          }
        }
      } else {
        console.log("JournalList: No user data in localStorage");
      }
    } catch (e) {
      console.error("JournalList: Error checking localStorage:", e);
    }
  }, []);

  // Add visibility change listener to refresh when component becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log("Page is now visible, refreshing journal entries");
        setRefreshTimestamp(Date.now());
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Check URL for refresh parameter
    const query = new URLSearchParams(window.location.search);
    if (query.get('refresh') === 'true') {
      // Clear the parameter and refresh
      navigate('/dashboard/journal', { replace: true });
      setRefreshTimestamp(Date.now());
    }
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [navigate]);

  // Fetch journal entries when user/tenant data is available or refreshTimestamp changes
  useEffect(() => {
    if (effectiveUser) {
      fetchJournalEntries();
    } else {
      setIsLoading(false);
    }
  }, [effectiveUser, tenant, refreshTimestamp]);

  // Filter entries when search or filters change
  useEffect(() => {
    if (!journalEntries.length) {
      setFilteredEntries([]);
      return;
    }

    const filtered = journalEntries.filter(entry => {
      const title = entry.title || '';
      const matchesSearch = searchQuery === '' || 
        title.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Extract mood from entry based on your data structure
      const entryMood = getMoodFromEntry(entry);
      const matchesMood = moodFilter === 'All' || entryMood === moodFilter;
      
      // Extract sentiment from entry based on your data structure
      const entrySentiment = getSentimentFromEntry(entry);
      const matchesSentiment = sentimentFilter === 'All' || entrySentiment === sentimentFilter;
      
      return matchesSearch && matchesMood && matchesSentiment;
    });
    
    setFilteredEntries(filtered);
    setCurrentPage(1); // Reset to first page when filters change
    
    // Calculate total pages
    setTotalPages(Math.ceil(filtered.length / entriesPerPage));
  }, [searchQuery, moodFilter, sentimentFilter, journalEntries, entriesPerPage]);

  // Helper to get mood text from entry
  const getMoodFromEntry = (entry) => {
    // Extract mood based on your data structure
    if (entry.journalFields?.quickMood) {
      return entry.journalFields.quickMood === 'positive' ? "I'm good" :
             entry.journalFields.quickMood === 'negative' ? "I'm struggling" :
             "I'm okay";
    } else if (entry.mood) {
      return entry.mood;
    }
    return "I'm okay"; // Default
  };

  // Helper to get sentiment from entry
  const getSentimentFromEntry = (entry) => {
    // Extract sentiment based on your data structure
    if (entry.sentimentAnalysis?.sentiment?.type) {
      return entry.sentimentAnalysis.sentiment.type.charAt(0).toUpperCase() + 
             entry.sentimentAnalysis.sentiment.type.slice(1);
    } else if (entry.sentiment) {
      return entry.sentiment;
    }
    return "Neutral"; // Default
  };

  // Fetch journal entries from the API
  const fetchJournalEntries = async () => {
    if (!effectiveUser) {
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Get token from localStorage
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.error('No token found in localStorage');
        setIsLoading(false);
        return;
      }
      
      // Get tenant ID from multiple possible sources
      const tenantId = tenant?._id || 
                      localStorage.getItem('tenantId') || 
                      (localStorage.getItem('tenant') && JSON.parse(localStorage.getItem('tenant'))._id);
      
      // Use the correct API endpoint
      const url = `/api/journals`;
      
      console.log(`Fetching journal entries from: ${url}, with tenant ID: ${tenantId || 'none'}`);
      
      // Set up headers with auth token and tenant if available
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
      
      if (tenantId) {
        headers['X-Tenant-ID'] = tenantId;
      }
      
      // Make the API call
      const response = await axios.get(url, { headers });
      
      // Log the complete response for debugging
      console.log('Journal entries response:', response);
      
      // Process the response based on format
      if (response.data && response.data.success && Array.isArray(response.data.data)) {
        console.log('Processing response with data wrapper format');
        setJournalEntries(response.data.data);
      } else if (Array.isArray(response.data)) {
        console.log('Processing response with direct array format');
        setJournalEntries(response.data);
      } else {
        console.warn('Unexpected response format:', response.data);
        
        // Try to extract data in different formats
        const possibleData = response.data?.data || response.data?.entries || response.data?.journals || [];
        
        if (Array.isArray(possibleData) && possibleData.length > 0) {
          console.log('Found array data in alternate field');
          setJournalEntries(possibleData);
        } else if (response.data && typeof response.data === 'object') {
          // Try to check if the response itself is an object that could be a journal entry
          console.log('Checking if response is a single journal entry');
          if (response.data._id) {
            console.log('Response appears to be a single journal entry');
            setJournalEntries([response.data]);
          } else {
            console.log('Could not identify journal entries in response');
            setJournalEntries([]);
          }
        } else {
          console.log('No valid journal entries format found');
          setJournalEntries([]);
        }
      }
    } catch (error) {
      console.error('Error fetching journal entries:', error);
      
      // Try fallback endpoint if first one fails
      try {
        console.log('First attempt failed, trying alternative journal route...');
        
        const token = localStorage.getItem('token');
        const tenantId = tenant?._id || 
                        localStorage.getItem('tenantId') || 
                        (localStorage.getItem('tenant') && JSON.parse(localStorage.getItem('tenant'))._id);
        
        // Try the alternative route structure
        const fallbackUrl = `/api/journal`;
        
        console.log(`Trying fallback route: ${fallbackUrl}`);
        
        const headers = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        };
        
        if (tenantId) {
          headers['X-Tenant-ID'] = tenantId;
        }
        
        const fallbackResponse = await axios.get(fallbackUrl, { headers });
        
        console.log('Fallback journal response:', fallbackResponse);
        
        if (Array.isArray(fallbackResponse.data)) {
          setJournalEntries(fallbackResponse.data);
        } else if (fallbackResponse.data && fallbackResponse.data.success && Array.isArray(fallbackResponse.data.data)) {
          setJournalEntries(fallbackResponse.data.data);
        }
      } catch (fallbackError) {
        console.error('Error with fallback journal route:', fallbackError);
        setJournalEntries([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Get mood emoji based on the mood value
  const getMoodEmoji = (entry) => {
    const mood = getMoodFromEntry(entry);
    
    if (mood === "I'm good") return '😊';
    if (mood === "I'm okay") return '😐';
    if (mood === "I'm struggling") return '😟';
    
    return '😐'; // Default
  };

  // Extract emotion tags from the entry
  const getEmotionTags = (entry) => {
    // This will depend on your data structure
    if (entry.sentimentAnalysis?.emotions) {
      return Object.keys(entry.sentimentAnalysis.emotions)
        .filter(emotion => entry.sentimentAnalysis.emotions[emotion] > 0.3)
        .slice(0, 2); // Take top 2 emotions
    }
    
    if (entry.emotions) {
      return entry.emotions;
    }
    
    // Fallback - return generic emotions based on sentiment
    const sentiment = getSentimentFromEntry(entry);
    if (sentiment === 'Positive') return ['Hope', 'Calm'];
    if (sentiment === 'Negative') return ['Frustration', 'Sadness'];
    return ['Neutral', 'Balanced'];
  };

  // Format date for display
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  // Handle search input change
  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  // Handle mood filter change
  const handleMoodFilterChange = (e) => {
    setMoodFilter(e.target.value);
  };

  // Handle sentiment filter change
  const handleSentimentFilterChange = (e) => {
    setSentimentFilter(e.target.value);
  };

  // Handle "Add Journal Entry" button click
  const handleAddEntry = () => {
    navigate('/dashboard/journal/new');
  };

  // Handle view entry
  const handleViewEntry = (id) => {
    navigate(`/dashboard/journal/${id}`);
  };

  // Handle edit entry
  const handleEditEntry = (id) => {
    navigate(`/dashboard/journal/${id}/edit`);
  };

  // Handle delete entry
  const handleDeleteEntry = async (id) => {
    if (!window.confirm('Are you sure you want to delete this journal entry?')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No token found in localStorage');
        return;
      }
      
      // Get tenant ID from multiple possible sources
      const tenantId = tenant?._id || 
                      localStorage.getItem('tenantId') || 
                      (localStorage.getItem('tenant') && JSON.parse(localStorage.getItem('tenant'))._id);
      
      // Create headers with auth token and tenant if available
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
      
      if (tenantId) {
        headers['X-Tenant-ID'] = tenantId;
      }
      
      // Make API call to delete the entry - using the correct endpoint
      await axios.delete(`/api/journals/${id}`, { headers });
      
      // Remove from state after successful deletion
      setJournalEntries(prev => prev.filter(entry => entry._id !== id));
      alert('Journal entry deleted successfully');
      
      // Refresh the list to ensure it's up to date
      setRefreshTimestamp(Date.now());
    } catch (error) {
      console.error('Error deleting journal entry:', error);
      alert('Failed to delete journal entry');
    }
  };

  // Handle manual refresh 
  const handleManualRefresh = () => {
    setRefreshTimestamp(Date.now());
  };

  // Handle PDF export
  const handleExportPDF = () => {
    alert('Export to PDF functionality will be implemented soon');
    // Implementation would go here
  };

  // Handle entries per page change
  const handleEntriesPerPageChange = (e) => {
    setEntriesPerPage(parseInt(e.target.value));
    setCurrentPage(1); // Reset to first page
  };
  
  // Handle page change
  const handlePageChange = (event, value) => {
    setCurrentPage(value);
  };

  // Calculate pagination values
  const indexOfLastEntry = currentPage * entriesPerPage;
  const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
  const currentEntries = filteredEntries.slice(indexOfFirstEntry, indexOfLastEntry);

  // Show loading state
  if (isLoading) {
    return (
      <div className="journal-page-container">
        <div className="journal-content-container">
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
            <CircularProgress />
            <Typography variant="body1" sx={{ ml: 2 }}>Loading journal entries...</Typography>
          </Box>
        </div>
      </div>
    );
  }

  // Show error state if no user
  if (!effectiveUser) {
    return (
      <div className="journal-page-container">
        <div className="journal-content-container">
          <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight="60vh">
            <Typography variant="h5" sx={{ mb: 2 }}>User Not Found</Typography>
            <Typography variant="body1" sx={{ mb: 3 }}>User data not available. Please log in again.</Typography>
            <Button 
              variant="contained"
              onClick={() => authService.logout()}>
              Return to Login
            </Button>
          </Box>
        </div>
      </div>
    );
  }

  return (
  <div className="journal-page-container">
    <div className="journal-content-container">
      <Typography variant="h5" className="journal-title">
        Journal Entry History
      </Typography>
      
      {/* Search and Add Entry Row */}
      <Box className="journal-controls-row">
        <Box className="main-controls-group">
          <Box className="search-container">
            <TextField
              placeholder="Search"
              variant="outlined"
              size="small"
              className="search-field"
              value={searchQuery}
              onChange={handleSearch}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
          
          <Button 
            variant="contained"
            startIcon={<AddIcon />}
            className="add-entry-button"
            onClick={handleAddEntry}
            sx={{ 
              bgcolor: '#488c73', 
              height: '55px',
              textTransform: 'none',
              '&:hover': { bgcolor: '#3a7c63' }
            }}
          >
            Add Journal Entry
          </Button>
        </Box>
        
        <Box className="right-controls">
          <Box className="entries-per-page">
            <Typography variant="body2" className="show-label">Show</Typography>
            <Select
              value={entriesPerPage}
              onChange={handleEntriesPerPageChange}
              size="small"
              className="entries-select"
              sx={{ height: '32px', minWidth: '60px' }}
            >
              <MenuItem value={10}>10</MenuItem>
              <MenuItem value={25}>25</MenuItem>
              <MenuItem value={50}>50</MenuItem>
            </Select>
          </Box>
          
          <IconButton 
            className="refresh-button"
            onClick={handleManualRefresh}
            aria-label="Refresh entries"
            size="small"
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
      
      {/* Filters Row */}
      <Box className="filters-row">
        <Box className="mood-filter">
          <Typography variant="body2" className="filter-label">Mood</Typography>
          <FormControl size="small" className="filter-control">
            <Select
              value={moodFilter}
              onChange={handleMoodFilterChange}
              className="filter-select"
              sx={{ height: '55px', minWidth: '100px' }}
            >
              <MenuItem value="All">All</MenuItem>
              <MenuItem value="I'm good">I'm good</MenuItem>
              <MenuItem value="I'm okay">I'm okay</MenuItem>
              <MenuItem value="I'm struggling">I'm struggling</MenuItem>
            </Select>
          </FormControl>
        </Box>
        
        <Box className="sentiment-filter">
          <Typography variant="body2" className="filter-label">Sentiment</Typography>
          <FormControl size="small" className="filter-control">
            <Select
              value={sentimentFilter}
              onChange={handleSentimentFilterChange}
              className="filter-select"
              sx={{ height: '55px', minWidth: '100px' }}
            >
              <MenuItem value="All">All</MenuItem>
              <MenuItem value="Positive">Positive</MenuItem>
              <MenuItem value="Neutral">Neutral</MenuItem>
              <MenuItem value="Negative">Negative</MenuItem>
            </Select>
          </FormControl>
        </Box>
        
        <Button
          variant="outlined"
          startIcon={<PictureAsPdfIcon />}
          className="export-button"
          onClick={handleExportPDF}
          sx={{ 
            ml: 'auto', 
            height: '55px',
            textTransform: 'none',
            borderColor: '#ddd'
          }}
        >
          Export PDF
        </Button>
      </Box>
      
      {/* Table Container - Directly handles scroll */}
      <div className="custom-table-container">
        <div className="custom-table-header">
          <div className="header-cell date-header">Date</div>
          <div className="header-cell title-header">Journal Entry Title</div>
          <div className="header-cell mood-header">Mood</div>
          <div className="header-cell sentiment-header">Sentiment</div>
          <div className="header-cell emotions-header">Emotions Detected</div>
          <div className="header-cell actions-header">Actions</div>
        </div>
        
        {currentEntries.length > 0 ? (
          currentEntries.map((entry) => (
            <div key={entry._id} className="custom-table-row">
              <div className="cell date-cell">{formatDate(entry.createdAt || entry.date)}</div>
              <div className="cell title-cell">
                {entry.title || 
                (entry.template && entry.template.name) || 
                `Journal Entry - ${formatDate(entry.createdAt || entry.date)}`}
              </div>
              <div className="cell mood-cell">
                <div className="mood-content">
                  <span className={`mood-emoji ${getMoodFromEntry(entry).toLowerCase().replace(/[']/g, "-")}`}>
                    {getMoodEmoji(entry)}
                  </span>
                  <span className="mood-text">{getMoodFromEntry(entry)}</span>
                </div>
              </div>
              <div className="cell sentiment-cell">
                <div className={`sentiment-indicator ${getSentimentFromEntry(entry).toLowerCase()}`}>
                  <span className="sentiment-dot"></span>
                  <span className="sentiment-text">{getSentimentFromEntry(entry)}</span>
                </div>
              </div>
              <div className="cell emotions-cell">
                <div className="emotions-container">
                  {getEmotionTags(entry).map((emotion, index) => (
                    <span key={index} className="emotion-tag">
                      {emotion}
                    </span>
                  ))}
                </div>
              </div>
              <div className="cell actions-cell">
                <div className="actions-container">
                  <button 
                    className="action-button view-button"
                    onClick={() => handleViewEntry(entry._id)}
                    title="View entry"
                  >
                    <img 
                      src={ViewIcon} 
                      alt="View" 
                      className="action-icon"
                    />
                  </button>
                  
                  <button 
                    className="action-button edit-button"
                    onClick={() => handleEditEntry(entry._id)}
                    title="Edit entry"
                  >
                    <img 
                      src={EditIcon} 
                      alt="Edit" 
                      className="action-icon"
                    />
                  </button>
                  
                  <button 
                    className="action-button delete-button"
                    onClick={() => handleDeleteEntry(entry._id)}
                    title="Delete entry"
                  >
                    <img 
                      src={DeleteIcon} 
                      alt="Delete" 
                      className="action-icon"
                    />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="custom-table-row empty-row">
            <div className="empty-message">
              {journalEntries.length > 0 
                ? "No entries match your search filters."
                : "You haven't created any journal entries yet."}
            </div>
          </div>
        )}
        
        {/* Pagination inside table container */}
        <Box className="pagination-container">
          <Pagination 
            count={totalPages || 1} 
            page={currentPage} 
            onChange={handlePageChange} 
            shape="rounded"
            showFirstButton
            showLastButton 
            color="primary"
          />
        </Box>
      </div>
    </div>
  </div>
);
}

export default JournalList;