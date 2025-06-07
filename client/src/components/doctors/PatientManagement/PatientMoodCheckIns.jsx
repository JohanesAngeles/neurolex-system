// client/src/components/doctors/PatientManagement/PatientMoodCheckIns.jsx
import React, { useState, useEffect } from 'react';
import moodAnalyticsService from '../../../services/moodAnalyticsService';
import '../../../styles/components/doctor/PatientMoodCheckIns.css';

const PatientMoodCheckIns = () => {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [patientMoodHistory, setPatientMoodHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDays, setSelectedDays] = useState(7);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');

  // FINAL: Exact working mood URLs from Cloudinary (corrected)
  const moodSvgUrls = {
    great: 'https://res.cloudinary.com/dm7qxemrt/image/upload/v1749199687/Face_Im_Great_anfp2e.svg',
    good: 'https://res.cloudinary.com/dm7qxemrt/image/upload/v1749199687/Face_Im_good_ldcpo4.svg',
    okay: 'https://res.cloudinary.com/dm7qxemrt/image/upload/v1749199687/Face_Im_okay_tcf9cp.svg',
    struggling: 'https://res.cloudinary.com/dm7qxemrt/image/upload/v1749199687/Face_Im_struggling_regocn.svg',
    upset: 'https://res.cloudinary.com/dm7qxemrt/image/upload/v1749199687/Face_Im_upset_pqskxp.svg'
  };

  // Mood colors for consistency
  const moodColors = {
    great: '#4CAF50',
    good: '#8BC34A', 
    okay: '#FFC107',
    struggling: '#FF9800',
    upset: '#F44336'
  };

  // Fetch analytics data
  const fetchAnalytics = async (days = 7) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await moodAnalyticsService.getDoctorPatientMoodAnalytics(days);

      if (response.success) {
        setAnalyticsData(response.data);
      } else {
        setError('Failed to fetch analytics data');
      }
    } catch (err) {
      console.error('Error fetching mood analytics:', err);
      setError(err.response?.data?.message || 'Failed to fetch mood analytics');
    } finally {
      setLoading(false);
    }
  };

  // Fetch patient mood history data
  const fetchPatientMoodHistory = async (days = 7) => {
    try {
      const response = await moodAnalyticsService.getDoctorPatientMoodHistory(days);
      
      if (response.success) {
        setPatientMoodHistory(response.data);
      } else {
        console.error('Failed to fetch patient mood history');
      }
    } catch (err) {
      console.error('Error fetching patient mood history:', err);
    }
  };

  // Load data on component mount and when days filter changes
  useEffect(() => {
    fetchAnalytics(selectedDays);
    fetchPatientMoodHistory(selectedDays);
  }, [selectedDays]);

  // Handle days filter change
  const handleDaysChange = (days) => {
    setSelectedDays(days);
  };

  // Format mood key for display
  const formatMoodLabel = (moodKey) => {
    return moodKey.charAt(0).toUpperCase() + moodKey.slice(1);
  };

  // Get mood SVG URL
  const getMoodSvg = (moodKey) => {
    return moodSvgUrls[moodKey] || moodSvgUrls['okay'];
  };

  // Get mood color
  const getMoodColor = (moodKey) => {
    return moodColors[moodKey] || '#FFC107';
  };

  // Format day name (Mon, Tue, Wed, etc.)
  const formatDayName = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  };

  // Filter and sort patient mood history
  const getFilteredMoodHistory = () => {
    let filtered = patientMoodHistory.filter(entry => {
      if (searchTerm) {
        return entry.patientName?.toLowerCase().includes(searchTerm.toLowerCase());
      }
      return true;
    });

    // Sort data
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date_asc':
          return new Date(a.date) - new Date(b.date);
        case 'date_desc':
          return new Date(b.date) - new Date(a.date);
        case 'mood':
          return a.lastMood?.moodRating - b.lastMood?.moodRating;
        case 'average':
          return a.averageRating - b.averageRating;
        default:
          return new Date(b.date) - new Date(a.date);
      }
    });

    return filtered;
  };

  if (loading) {
    return (
      <div className="mood-checkins-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading mood analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mood-checkins-container">
        <div className="error-container">
          <h3>Error Loading Data</h3>
          <p>{error}</p>
          <button onClick={() => fetchAnalytics(selectedDays)} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="mood-checkins-container">
        <div className="no-data-container">
          <h3>No Data Available</h3>
          <p>No mood check-in data found for the selected period.</p>
        </div>
      </div>
    );
  }

  const { keyMetrics, dailyOverview, moodDistribution } = analyticsData;

  return (
    <div className="mood-checkins-container">
      {/* Updated Header */}
      <div className="mood-checkins-header">
        <div className="header-content">
          <div className="header-left">
            <h1>Patient Mood Check-Ins</h1>
            <p>Honest reflections and mood updates from those working through life's challenges — one feeling at a time.</p>
          </div>
          <div className="header-right">
            <div className="rainbow-icon-container">
              <div className="rainbow-icon">🌈</div>
            </div>
          </div>
        </div>
        <div className="header-divider"></div>
      </div>

      {/* Weekly Insights Header */}
      <div className="weekly-insights-header">
        <h2>Weekly Insights</h2>
      </div>

      {/* Time Filter Section */}
      <div className="time-filter-section">
        <div className="time-filter">
          <label>This data</label>
          <select 
            value={selectedDays} 
            onChange={(e) => handleDaysChange(parseInt(e.target.value))}
            className="days-select"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="key-metrics-section">
        <h2>Key Metrics</h2>
        <div className="metrics-grid">
          <div className="metric-card">
            <h3>Total Logs</h3>
            <div className="metric-card-inside">
            <div className="metric-value">{keyMetrics.totalLogs}</div>
            <div className="metric-label">This Week</div>
            </div>
          </div>
          <div className="metric-card">
            <h3>Average Logs per Day</h3>
            <div className="metric-card-inside">
            <div className="metric-value">{keyMetrics.averageLogsPerDay}</div>
            <div className="metric-label">Check-in logs / day</div>
            </div>
          </div>
          <div className="metric-card">
            <h3>Average Mood Score</h3>
            <div className="metric-card-inside">
            <div className="metric-value">{keyMetrics.averageMoodScore}</div>
            <div className="metric-label">out of {keyMetrics.totalLogs}</div>
            </div>
          </div>
          <div className="metric-card">
            <h3>Top Emotional Trends</h3>
            <div className="emotional-trends">
              {keyMetrics.topEmotionalTrends.map((trend, index) => (
                <div key={index} className="trend-item">
                  <div className="emotional-trends-conainer-inside-emoji">
                  <img 
                    src={getMoodSvg(trend.mood.toLowerCase())} 
                    alt={trend.mood}
                    className="trend-svg"
                  />
                  </div>
               <div className="emotional-trends-conainer-inside">
                  <span className="trend-label">{trend.mood}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Daily Overview */}
      <div className="daily-overview-section">
        <h2>Daily Overview</h2>
        <div className="daily-overview-grid">
          {dailyOverview.map((day, index) => (
            <div key={index} className="daily-item">
              <div className="daily-date">{day.dateFormatted}</div>
              <div className="daily-day-name">{formatDayName(day.date)}</div>
              <div className="daily-mood-svg">
                <img 
                  src={getMoodSvg(day.mostFrequentMood)} 
                  alt={day.mostFrequentMood}
                  className="daily-svg"
                />
              </div>
              <div className="daily-stats">
                <div className="daily-score">{day.averageMoodScore}</div>
                <div className="daily-entries">{day.totalEntries} logs</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Mood Distribution */}
<div className="mood-distribution-section">
  <h2>Mood Distribution</h2>
  <div className="mood-distribution-container">
    <div className="mood-distribution-grid">
      {Object.entries(moodDistribution).map(([moodKey, data]) => (
        <div key={moodKey} className={`mood-distribution-item ${moodKey}`}>
          <div className="mood-info">
            <img 
              src={getMoodSvg(moodKey)} 
              alt={moodKey}
              className="mood-svg-icon"
            />
            <span className="mood-label">I'm {moodKey}</span>
          </div>
          <div className="mood-stats">
            <div className="mood-count">{data.count} logs</div>
          </div>
        </div>
      ))}
    </div>
  </div>
</div>

      {/* Mood Check-in History */}
      <div className="mood-history-section">
        <h2>Mood Check-in History</h2>
        <div className="history-controls">
          <div className="search-container">
            <input 
              type="text" 
              placeholder="Search patients..." 
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="filter-controls">
            <select 
              className="filter-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="date_desc">Sort by: Date (Newest)</option>
              <option value="date_asc">Sort by: Date (Oldest)</option>
              <option value="mood">Sort by: Mood Rating</option>
              <option value="average">Sort by: Average Rating</option>
            </select>
          </div>
          <button className="export-button">
            <span>📄</span> Export PDF
          </button>
        </div>

        <div className="mood-history-table">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Patient</th>
                <th>Average</th>
                <th>Total Logs</th>
                <th>End-of-Day Mood Check-in Log</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {getFilteredMoodHistory().length > 0 ? (
                getFilteredMoodHistory().map((entry, index) => (
                  <tr key={index}>
                    <td>{new Date(entry.date).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}</td>
                    <td>{entry.patientName}</td>
                    <td>{entry.averageRating ? `${entry.averageRating.toFixed(1)}/5` : 'N/A'}</td>
                    <td>{entry.totalLogs} logs</td>
                    <td>
                      {entry.lastMood ? (
                        <span className={`mood-indicator ${entry.lastMood.moodKey}`}>
                          <img 
                            src={getMoodSvg(entry.lastMood.moodKey)} 
                            alt={entry.lastMood.moodKey}
                            className="mood-svg-small"
                          />
                          {entry.lastMood.moodLabel}
                        </span>
                      ) : (
                        <span className="mood-indicator okay">
                          <img 
                            src={getMoodSvg('okay')} 
                            alt="okay"
                            className="mood-svg-small"
                          />
                          No recent mood
                        </span>
                      )}
                    </td>
                    <td>
                      <button 
                        className="action-button"
                        onClick={() => {
                          // TODO: Navigate to patient details
                          console.log('View patient details:', entry.patientId);
                        }}
                        title="View patient details"
                      >
                        👁️
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>
                    {patientMoodHistory.length === 0 
                      ? 'No mood check-in data available for your patients'
                      : 'No patients match your search criteria'
                    }
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PatientMoodCheckIns;