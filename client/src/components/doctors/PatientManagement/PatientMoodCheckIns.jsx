// client/src/components/doctors/PatientManagement/PatientMoodCheckIns.jsx
import React, { useState, useEffect } from 'react';
import moodAnalyticsService from '../../../services/moodAnalyticsService';
import '../../../styles/components/doctor/PatientMoodCheckIns.css';

const PatientMoodCheckIns = () => {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDays, setSelectedDays] = useState(7);

  // Mood emoji mapping
  const moodEmojis = {
    great: '😊',
    good: '🙂', 
    okay: '😐',
    struggling: '😟',
    upset: '😢'
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

  // Load data on component mount and when days filter changes
  useEffect(() => {
    fetchAnalytics(selectedDays);
  }, [selectedDays]);

  // Handle days filter change
  const handleDaysChange = (days) => {
    setSelectedDays(days);
  };

  // Format mood key for display
  const formatMoodLabel = (moodKey) => {
    return moodKey.charAt(0).toUpperCase() + moodKey.slice(1);
  };

  // Get mood emoji
  const getMoodEmoji = (moodKey) => {
    return moodEmojis[moodKey] || '😐';
  };

  // Get mood color
  const getMoodColor = (moodKey) => {
    return moodColors[moodKey] || '#FFC107';
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
      {/* Header */}
      <div className="mood-checkins-header">
        <div className="header-left">
          <h1>Patient Mood Check-Ins</h1>
          <p>Monitor reflections and mood patterns from those seeking through life's challenges - we feeling at a time.</p>
        </div>
        <div className="header-right">
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
          <div className="rainbow-icon">🌈</div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="key-metrics-section">
        <h2>Key Metrics</h2>
        <div className="metrics-grid">
          <div className="metric-card">
            <h3>Total Logs</h3>
            <div className="metric-value">{keyMetrics.totalLogs}</div>
            <div className="metric-label">This Week</div>
          </div>
          <div className="metric-card">
            <h3>Average Logs per Day</h3>
            <div className="metric-value">{keyMetrics.averageLogsPerDay}</div>
            <div className="metric-label">Check-in logs / day</div>
          </div>
          <div className="metric-card">
            <h3>Average Mood Score</h3>
            <div className="metric-value">{keyMetrics.averageMoodScore}</div>
            <div className="metric-label">out of 5</div>
          </div>
          <div className="metric-card">
            <h3>Top Emotional Trends</h3>
            <div className="emotional-trends">
              {keyMetrics.topEmotionalTrends.map((trend, index) => (
                <div key={index} className="trend-item">
                  <span className="trend-emoji">{getMoodEmoji(trend.mood.toLowerCase())}</span>
                  <span className="trend-label">{trend.mood}</span>
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
              <div 
                className="daily-mood-emoji"
                style={{ fontSize: '48px' }}
              >
                {getMoodEmoji(day.mostFrequentMood)}
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
        <div className="mood-distribution-grid">
          {Object.entries(moodDistribution).map(([moodKey, data]) => (
            <div key={moodKey} className="mood-distribution-item">
              <div className="mood-info">
                <span 
                  className="mood-dot"
                  style={{ backgroundColor: getMoodColor(moodKey) }}
                ></span>
                <span className="mood-label">{formatMoodLabel(moodKey)}</span>
              </div>
              <div className="mood-stats">
                <div className="mood-count">{data.count} logs</div>
                <div className="mood-percentage">{data.percentage}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mood Check-in History */}
      <div className="mood-history-section">
        <h2>Mood Check-in History</h2>
        <div className="history-controls">
          <div className="search-container">
            <input 
              type="text" 
              placeholder="Search..." 
              className="search-input"
            />
          </div>
          <div className="filter-controls">
            <select className="filter-select">
              <option>Patient: All</option>
            </select>
            <select className="filter-select">
              <option>Sort by: Date Asc</option>
              <option>Sort by: Date Desc</option>
              <option>Sort by: Mood</option>
            </select>
            <select className="filter-select">
              <option>Average: All</option>
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
              {/* Sample data - you can replace this with actual patient data */}
              <tr>
                <td>April 30, 2025</td>
                <td>Melissa Chin Gabriel</td>
                <td>1.8/5</td>
                <td>5 logs</td>
                <td>
                  <span className="mood-indicator struggling">
                    😟 I'm struggling
                  </span>
                </td>
                <td>
                  <button className="action-button">👁️</button>
                </td>
              </tr>
              <tr>
                <td>April 19, 2025</td>
                <td>Johanna Angelica</td>
                <td>2.3/5</td>
                <td>3 logs</td>
                <td>
                  <span className="mood-indicator struggling">
                    😟 I'm struggling
                  </span>
                </td>
                <td>
                  <button className="action-button">👁️</button>
                </td>
              </tr>
              <tr>
                <td>April 18, 2025</td>
                <td>Alessandro Izelka Kakoma</td>
                <td>3.7/5</td>
                <td>7 logs</td>
                <td>
                  <span className="mood-indicator okay">
                    😐 I'm okay
                  </span>
                </td>
                <td>
                  <button className="action-button">👁️</button>
                </td>
              </tr>
              <tr>
                <td>April 17, 2025</td>
                <td>Dewfall Allyn Romahin</td>
                <td>4.5/5</td>
                <td>6 logs</td>
                <td>
                  <span className="mood-indicator great">
                    😊 I'm great
                  </span>
                </td>
                <td>
                  <button className="action-button">👁️</button>
                </td>
              </tr>
              <tr>
                <td>April 16, 2025</td>
                <td>Dara Vashita Demarsh</td>
                <td>2.5/5</td>
                <td>4 logs</td>
                <td>
                  <span className="mood-indicator struggling">
                    😟 I'm struggling
                  </span>
                </td>
                <td>
                  <button className="action-button">👁️</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PatientMoodCheckIns;