// client/src/components/admin/AdminMoodCheckIns.jsx
import React, { useState, useEffect } from 'react';
import adminService from '../../services/adminService';
import '../../styles/components/admin/AdminMoodCheckIns.css';

const AdminMoodCheckIns = () => {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [patientMoodHistory, setPatientMoodHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDays, setSelectedDays] = useState(7);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');
  const [tenantFilter, setTenantFilter] = useState('All');
  const [tenants, setTenants] = useState([]);

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

  // Fetch tenants for filtering
  const fetchTenants = async () => {
    try {
      const response = await adminService.getTenants();
      if (response.success) {
        setTenants(response.data);
      }
    } catch (err) {
      console.error('Error fetching tenants:', err);
    }
  };

  // Fetch system-wide mood analytics
  const fetchAnalytics = async (days = 7) => {
    try {
      setLoading(true);
      setError(null);
      
      // TODO: Create this method in adminService.js
      const response = await adminService.getSystemWideMoodAnalytics(days, {
        tenantId: tenantFilter !== 'All' ? tenantFilter : undefined
      });

      if (response.success) {
        setAnalyticsData(response.data);
      } else {
        setError('Failed to fetch analytics data');
      }
    } catch (err) {
      console.error('Error fetching system mood analytics:', err);
      setError(err.response?.data?.message || 'Failed to fetch mood analytics');
    } finally {
      setLoading(false);
    }
  };

  // Fetch system-wide patient mood history
  const fetchPatientMoodHistory = async (days = 7) => {
    try {
      // TODO: Create this method in adminService.js
      const response = await adminService.getSystemWideMoodHistory(days, {
        search: searchTerm,
        tenantId: tenantFilter !== 'All' ? tenantFilter : undefined,
        sortBy: sortBy
      });
      
      if (response.success) {
        setPatientMoodHistory(response.data);
      } else {
        console.error('Failed to fetch system mood history');
      }
    } catch (err) {
      console.error('Error fetching system mood history:', err);
    }
  };

  // Load data on component mount and when filters change
  useEffect(() => {
    fetchTenants();
  }, []);

  useEffect(() => {
    fetchAnalytics(selectedDays);
    fetchPatientMoodHistory(selectedDays);
  }, [selectedDays, tenantFilter]);

  useEffect(() => {
    // Debounce search and fetch history
    const timeoutId = setTimeout(() => {
      fetchPatientMoodHistory(selectedDays);
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [searchTerm, sortBy]);

  // Handle days filter change
  const handleDaysChange = (days) => {
    setSelectedDays(days);
  };

  // Handle tenant filter change
  const handleTenantChange = (tenantId) => {
    setTenantFilter(tenantId);
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

  // Get tenant name by ID
  const getTenantName = (tenantId) => {
    const tenant = tenants.find(t => t._id === tenantId);
    return tenant ? tenant.name : 'Unknown Clinic';
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
          return (parseFloat(a.averageRating) || 0) - (parseFloat(b.averageRating) || 0);
        case 'tenant':
          return getTenantName(a.tenantId).localeCompare(getTenantName(b.tenantId));
        default:
          return new Date(b.date) - new Date(a.date);
      }
    });

    return filtered;
  };

  // Handle export functionality
  const handleExportPDF = async () => {
    try {
      // TODO: Create this method in adminService.js
      const response = await adminService.exportSystemMoodAnalytics({
        days: selectedDays,
        tenantId: tenantFilter !== 'All' ? tenantFilter : undefined,
        search: searchTerm
      });
      
      if (response.success) {
        // File should be downloaded automatically
        console.log('Export successful');
      }
    } catch (err) {
      console.error('Error exporting mood data:', err);
      setError('Failed to export data');
    }
  };

  if (loading) {
    return (
      <div className="admin-mood-checkins-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading system mood analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-mood-checkins-container">
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
      <div className="admin-mood-checkins-container">
        <div className="no-data-container">
          <h3>No Data Available</h3>
          <p>No mood check-in data found for the selected period.</p>
        </div>
      </div>
    );
  }

  const { keyMetrics, dailyOverview, moodDistribution } = analyticsData;

  return (
    <div className="admin-mood-checkins-container">
      {/* Admin Header - using admin styling patterns */}
      <div className="admin-mood-header">
        <div className="header-content">
          <div className="header-left">
            <h1>System Mood Analytics</h1>
            <p>Comprehensive mood tracking insights across all patients and clinics in the system.</p>
          </div>
          <div className="header-right">
            <div className="rainbow-icon-container">
              <div className="rainbow-icon">🌈</div>
            </div>
          </div>
        </div>
        <div className="header-divider"></div>
      </div>

      {/* Filter Section - following admin pattern */}
      <div className="admin-actions-bar">
        <div className="top-actions-row">
          <div className="time-filter">
            <label>Time Period:</label>
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
          
          <button className="export-button" onClick={handleExportPDF}>
            📄 Export PDF
          </button>
        </div>
        
        <div className="bottom-actions-row">
          <div className="filter-box">
            <div className="filter-item">
              <label htmlFor="tenant-filter">Clinic:</label>
              <select 
                id="tenant-filter" 
                value={tenantFilter} 
                onChange={(e) => handleTenantChange(e.target.value)}
              >
                <option value="All">All Clinics</option>
                {tenants.map(tenant => (
                  <option key={tenant._id} value={tenant._id}>
                    {tenant.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics - using admin card style */}
      <div className="key-metrics-section">
        <h2>System Overview</h2>
        <div className="admin-metrics-grid">
          <div className="admin-metric-card">
            <div className="stat-label">Total Logs</div>
            <div className="stat-value-container">
              <div className="stat-value">{keyMetrics.totalLogs}</div>
            </div>
          </div>
          <div className="admin-metric-card">
            <div className="stat-label">Avg. Logs/Day</div>
            <div className="stat-value-container">
              <div className="stat-value">{keyMetrics.averageLogsPerDay}</div>
            </div>
          </div>
          <div className="admin-metric-card">
            <div className="stat-label">Avg. Mood Score</div>
            <div className="stat-value-container">
              <div className="stat-value">{keyMetrics.averageMoodScore}</div>
            </div>
          </div>
          <div className="admin-metric-card">
            <div className="stat-label">Top Trend</div>
            <div className="stat-value-container">
              <div className="top-trend">
                {keyMetrics.topEmotionalTrends.length > 0 ? (
                  <div className="trend-display">
                    <img 
                      src={getMoodSvg(keyMetrics.topEmotionalTrends[0].mood.toLowerCase())} 
                      alt={keyMetrics.topEmotionalTrends[0].mood}
                      className="trend-svg"
                    />
                    <span>{keyMetrics.topEmotionalTrends[0].mood}</span>
                  </div>
                ) : (
                  <span>No data</span>
                )}
              </div>
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

      {/* Patient Mood History Table - using admin table pattern */}
      <div className="mood-history-section">
        <h2>Patient Mood History</h2>
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
              <option value="tenant">Sort by: Clinic</option>
            </select>
          </div>
        </div>

        <div className="table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Patient</th>
                <th>Clinic</th>
                <th>Average</th>
                <th>Total Logs</th>
                <th>Latest Mood</th>
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
                    <td>{getTenantName(entry.tenantId)}</td>
                    <td>{entry.averageRating ? `${parseFloat(entry.averageRating).toFixed(1)}/5` : 'N/A'}</td>
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
                          // TODO: Navigate to patient details or mood details
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
                  <td colSpan="7" style={{ textAlign: 'center', padding: '20px' }}>
                    {patientMoodHistory.length === 0 
                      ? 'No mood check-in data available in the system'
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

export default AdminMoodCheckIns;