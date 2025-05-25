import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import doctorService from '../../../services/doctorService';
import { format } from 'date-fns';
// No external CSS imports - using inline styles only

const JournalList = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  
  // State for entries and pagination
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  
  // State for filters
  const initialFilters = {
    patient: queryParams.get('patient') || '',
    dateFrom: queryParams.get('dateFrom') || '',
    dateTo: queryParams.get('dateTo') || '',
    sentiment: queryParams.get('sentiment') || '',
    mood: queryParams.get('mood') || '',
    analyzed: queryParams.get('filter') || 'all'
  };
  
  const [filters, setFilters] = useState(initialFilters);
  const [patients, setPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Fetch entries and patients when component mounts or filters change
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch patient list for filter dropdown
        if (patients.length === 0) {
          const patientsData = await doctorService.getPatients();
          if (patientsData && patientsData.success && Array.isArray(patientsData.patients)) {
            setPatients(patientsData.patients);
          } else if (Array.isArray(patientsData)) {
            setPatients(patientsData);
          } else {
            setPatients([]);
          }
        }
        
        // Fetch entries based on filters
        const entriesData = await doctorService.getJournalEntries({
          ...filters,
          page: page + 1,
          limit: rowsPerPage
        });
        
        if (entriesData && entriesData.success && Array.isArray(entriesData.data)) {
          setEntries(entriesData.data);
          setTotal(entriesData.pagination?.total || entriesData.data.length);
        } else if (Array.isArray(entriesData)) {
          setEntries(entriesData);
          setTotal(entriesData.length);
        } else {
          setEntries([]);
          setTotal(0);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching journal entries:', error);
        setError('Failed to load journal entries. Please try again.');
        setEntries([]);
        setLoading(false);
      }
    };
    
    fetchData();
  }, [filters, page, rowsPerPage]);
  
  // Handle filter changes
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
    setPage(0);
  };
  
  // Reset filters
  const resetFilters = () => {
    setFilters({
      patient: '',
      dateFrom: '',
      dateTo: '',
      sentiment: '',
      mood: '',
      analyzed: 'all'
    });
    setPage(0);
  };
  
  // Handle pagination changes
  const handleChangePage = (newPage) => {
    setPage(newPage);
  };
  
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  
  // View, edit, delete functions
  const viewEntry = (entryId) => {
    navigate(`/doctor/journal-entries/${entryId}`);
  };
  
  const editEntry = (entryId) => {
    navigate(`/doctor/journal-entries/edit/${entryId}`);
  };
  
  const deleteEntry = async (entryId) => {
    if (window.confirm('Are you sure you want to delete this journal entry?')) {
      try {
        await doctorService.deleteJournalEntry(entryId);
        const updatedEntries = entries.filter(entry => entry._id !== entryId);
        setEntries(updatedEntries);
      } catch (error) {
        setError('Failed to delete the entry. Please try again.');
      }
    }
  };
  
  // Export to PDF
  const exportToPDF = async () => {
    try {
      setLoading(true);
      const response = await doctorService.exportJournalEntriesToPDF(filters);
      
      if (response.isHtml) {
        const url = window.URL.createObjectURL(response.data);
        const newWindow = window.open(url, '_blank');
        
        if (!newWindow) {
          setError('Pop-up blocked. Please allow pop-ups and try again.');
        } else {
          setError(null);
        }
        
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
        }, 5000);
      } else {
        const url = window.URL.createObjectURL(response.data);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `journal_entries_${new Date().toISOString().split('T')[0]}.pdf`);
        document.body.appendChild(link);
        link.click();
        
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
      }
      
      setLoading(false);
    } catch (error) {
      setError('Failed to export entries to PDF. Please try again.');
      setLoading(false);
    }
  };
  
  // Get emotion tags from entry
  const getEmotionTags = (entry) => {
    if (!entry.sentiment || !entry.sentiment.emotions) {
      return [];
    }
    
    return entry.sentiment.emotions.map(emotion => 
      typeof emotion === 'string' ? emotion : emotion.name
    );
  };
  
  // Safely format date
  const formatDateSafe = (dateString) => {
    try {
      return format(new Date(dateString), 'MMMM dd, yyyy');
    } catch (error) {
      return 'Invalid Date';
    }
  };
  
  // Custom mood indicator component
  const MoodIndicator = ({ mood }) => {
    let emoji = "😐"; // default neutral
    let text = "I'm okay";
    
    if (mood === "positive") {
      emoji = "😊";
      text = "I'm good";
    } else if (mood === "negative") {
      emoji = "😔";
      text = "I'm upset";
    } else if (mood === "neutral" || !mood) {
      emoji = "😐";
      text = "I'm okay";
    } else if (mood === "struggling") {
      emoji = "😟";
      text = "I'm struggling";
    }
    
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ fontSize: '18px' }}>{emoji}</div>
        <div style={{ fontSize: '14px', color: '#666' }}>{text}</div>
      </div>
    );
  };

  // Custom sentiment indicator component
  const SentimentIndicator = ({ sentiment }) => {
    let color = '#FFD700'; // default yellow for neutral
    
    if (sentiment === "Positive") {
      color = '#4CAF50';
    } else if (sentiment === "Negative") {
      color = '#F44336';
    }
    
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: color }}></div>
        <div style={{ fontSize: '14px' }}>{sentiment}</div>
      </div>
    );
  };
  
  // Inline styles
  const styles = {
    container: {
      padding: '24px'
    },
    header: {
      marginBottom: '24px'
    },
    headerTitle: {
      fontSize: '45px',
      fontFamily: 'Poppins',
      fontWeight: 600,
      marginBottom: '8px',
      color: '#000000'
    },
    headerSubtitle: {
      fontSize: '16px',
      fontFamily: 'IBM Plex Mono',
      fontStyle: 'italic',
      color: '#548170',
      margin: 0
    },
    searchBar: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '16px'
    },
    searchBox: {
      position: 'relative',
      flex: 1,
      maxWidth: '421px'
    },
    searchInput: {
      width: '100%',
      height: '55px',
      padding: '10px 12px 10px 40px',
      border: '1px solid #A7D7C5',
      borderRadius: '12px',
      fontSize: '15px',
      fontFamily: 'IBM Plex Mono, monospace'
    },
    exportButton: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '10px 16px',
      borderRadius: '8px',
      fontFamily: 'IBM Plex Mono, monospace',
      height: '55px',
      fontSize: '15px',
      fontWeight: 500,
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      backgroundColor: 'white',
      color: '#333',
      border: '1px solid #A7D7C5'
    },
    filtersContainer: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '16px',
      marginBottom: '24px'
    },
    filterItem: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    },
    filterLabel: {
      fontSize: '16px',
      fontWeight: 'bold',
      fontFamily: 'IBM Plex Mono',
      color: '#548170',
      whiteSpace: 'nowrap'
    },
    filterSelect: {
      padding: '8px 12px',
      border: '1px solid #A7D7C5',
      borderRadius: '12px',
      backgroundColor: 'rgba(167, 215, 197, 0.1)',
      height: '55px',
      minWidth: '150px',
      fontSize: '14px',
      fontFamily: 'IBM Plex Mono',
      color: '#333'
    },
    filterDate: {
      padding: '8px 12px',
      border: '1px solid #A7D7C5',
      borderRadius: '12px',
      backgroundColor: 'rgba(167, 215, 197, 0.1)',
      height: '40px',
      width: '180px',
      fontSize: '14px',
      fontFamily: 'IBM Plex Mono',
      color: '#333'
    },
    resetButton: {
      backgroundColor: 'white',
      color: '#333',
      border: '1px solid #A7D7C5',
      borderRadius: '8px',
      padding: '10px 16px',
      fontSize: '14px',
      cursor: 'pointer',
      height: '40px',
      alignSelf: 'flex-end'
    },
    tableContainer: {
      marginBottom: '30px',
      overflowX: 'auto'
    },
    table: {
      width: '100%',
      borderCollapse: 'separate',
      borderSpacing: '0 10px'
    },
    tableHead: {
      backgroundColor: 'rgba(167, 215, 197, 0.1)'
    },
    tableHeadCell: {
      padding: '12px 16px',
      textAlign: 'left',
      borderTop: '1px solid #A7D7C5',
      borderBottom: '1px solid #A7D7C5',
      fontSize: '15px',
      fontFamily: 'IBM Plex Mono, monospace',
      color: '#548170',
      fontWeight: 700
    },
    tableHeadCellFirst: {
      padding: '12px 16px',
      textAlign: 'left',
      borderTop: '1px solid #A7D7C5',
      borderBottom: '1px solid #A7D7C5',
      borderLeft: '1px solid #A7D7C5',
      borderTopLeftRadius: '12px',
      borderBottomLeftRadius: '12px',
      fontSize: '15px',
      fontFamily: 'IBM Plex Mono, monospace',
      color: '#548170',
      fontWeight: 700
    },
    tableHeadCellLast: {
      padding: '12px 16px',
      textAlign: 'left',
      borderTop: '1px solid #A7D7C5',
      borderBottom: '1px solid #A7D7C5',
      borderRight: '1px solid #A7D7C5',
      borderTopRightRadius: '12px',
      borderBottomRightRadius: '12px',
      fontSize: '15px',
      fontFamily: 'IBM Plex Mono, monospace',
      color: '#548170',
      fontWeight: 700
    },
    tableRow: {
      backgroundColor: '#ffffff'
    },
    tableRowAlt: {
      backgroundColor: 'rgba(167, 215, 197, 0.1)'
    },
    tableCell: {
      padding: '12px 16px',
      borderTop: '1px solid #A7D7C5',
      borderBottom: '1px solid #A7D7C5',
      fontSize: '15px',
      fontFamily: 'IBM Plex Mono, monospace'
    },
    tableCellFirst: {
      padding: '12px 16px',
      borderTop: '1px solid #A7D7C5',
      borderBottom: '1px solid #A7D7C5',
      borderLeft: '1px solid #A7D7C5',
      borderTopLeftRadius: '12px',
      borderBottomLeftRadius: '12px',
      fontSize: '15px',
      fontFamily: 'IBM Plex Mono, monospace'
    },
    tableCellLast: {
      padding: '12px 16px',
      borderTop: '1px solid #A7D7C5',
      borderBottom: '1px solid #A7D7C5',
      borderRight: '1px solid #A7D7C5',
      borderTopRightRadius: '12px',
      borderBottomRightRadius: '12px',
      fontSize: '15px',
      fontFamily: 'IBM Plex Mono, monospace'
    },
    emotionTags: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '6px'
    },
    emotionTag: {
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '12px',
      backgroundColor: 'rgba(167, 215, 197, 0.3)',
      color: '#333',
      fontSize: '12px',
      whiteSpace: 'nowrap'
    },
    actionIcons: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '10px'
    },
    actionIconView: {
      width: '24px',
      height: '24px',
      cursor: 'pointer',
      padding: '4px',
      borderRadius: '4px',
      backgroundColor: '#E8F5E9'
    },
    actionIconEdit: {
      width: '24px',
      height: '24px',
      cursor: 'pointer',
      padding: '4px',
      borderRadius: '4px',
      backgroundColor: '#E3F2FD'
    },
    actionIconDelete: {
      width: '24px',
      height: '24px',
      cursor: 'pointer',
      padding: '4px',
      borderRadius: '4px',
      backgroundColor: '#FFEBEE'
    },
    pagination: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: '20px',
      gap: '16px'
    },
    paginationButton: {
      padding: '8px 16px',
      backgroundColor: '#fff',
      border: '1px solid #A7D7C5',
      borderRadius: '6px',
      color: '#333',
      fontSize: '14px',
      cursor: 'pointer'
    },
    paginationButtonDisabled: {
      padding: '8px 16px',
      backgroundColor: '#fff',
      border: '1px solid #A7D7C5',
      borderRadius: '6px',
      color: '#333',
      fontSize: '14px',
      opacity: 0.5,
      cursor: 'not-allowed'
    },
    paginationInfo: {
      fontSize: '14px',
      color: '#666'
    },
    rowsPerPage: {
      display: 'flex',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: '12px',
      marginTop: '16px',
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: '14px',
      color: '#666'
    },
    rowsPerPageSelect: {
      padding: '4px 8px',
      border: '1px solid #A7D7C5',
      borderRadius: '4px',
      backgroundColor: '#fff'
    }
  };
  
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>Patient Journal Entries</h1>
        <p style={styles.headerSubtitle}>Thoughtful entries and emotional check-ins from those you are helping heal.</p>
      </div>
      
      {/* Error Alert */}
      {error && (
        <div style={{ 
          backgroundColor: '#FFEBEE', 
          borderLeft: '4px solid #F44336', 
          color: '#D32F2F', 
          padding: '16px', 
          borderRadius: '4px', 
          marginBottom: '24px' 
        }}>
          <span style={{ fontWeight: 600, marginRight: '8px' }}>Error:</span> {error}
        </div>
      )}
      
      {/* Search Bar */}
      <div style={styles.searchBar}>
        <div style={styles.searchBox}>
          <input
            style={styles.searchInput}
            type="text"
            placeholder="Search journal entries"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <button style={styles.exportButton} onClick={exportToPDF}>
          Export PDF
        </button>
      </div>
      
      {/* Filters */}
      <div style={styles.filtersContainer}>
        <div style={styles.filterItem}>
          <label style={styles.filterLabel}>From Date:</label>
          <input
            style={styles.filterDate}
            type="date"
            name="dateFrom"
            value={filters.dateFrom}
            onChange={handleFilterChange}
          />
        </div>
        
        <div style={styles.filterItem}>
          <label style={styles.filterLabel}>To Date:</label>
          <input
            style={styles.filterDate}
            type="date"
            name="dateTo"
            value={filters.dateTo}
            onChange={handleFilterChange}
          />
        </div>
        
        <div style={styles.filterItem}>
          <label style={styles.filterLabel}>Patient:</label>
          <select
            style={styles.filterSelect}
            name="patient"
            value={filters.patient}
            onChange={handleFilterChange}
          >
            <option value="">All Patients</option>
            {Array.isArray(patients) && patients.map(patient => (
              <option
                key={patient._id || `patient-${Math.random()}`}
                value={patient._id || ''}
              >
                {patient.firstName || ''} {patient.lastName || ''}
              </option>
            ))}
          </select>
        </div>
        
        <div style={styles.filterItem}>
          <label style={styles.filterLabel}>Mood:</label>
          <select
            style={styles.filterSelect}
            name="mood"
            value={filters.mood}
            onChange={handleFilterChange}
          >
            <option value="">All</option>
            <option value="positive">Good</option>
            <option value="neutral">Okay</option>
            <option value="negative">Upset</option>
            <option value="struggling">Struggling</option>
          </select>
        </div>
        
        <div style={styles.filterItem}>
          <label style={styles.filterLabel}>Sentiment:</label>
          <select
            style={styles.filterSelect}
            name="sentiment"
            value={filters.sentiment}
            onChange={handleFilterChange}
          >
            <option value="">All</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
          </select>
        </div>
        
        <button style={styles.resetButton} onClick={resetFilters}>
          Reset
        </button>
      </div>
      
      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            border: '3px solid #f3f3f3', 
            borderTop: '3px solid #5B8C7E', 
            borderRadius: '50%', 
            animation: 'spin 1s linear infinite' 
          }}></div>
        </div>
      ) : !Array.isArray(entries) || entries.length === 0 ? (
        <div style={{ 
          backgroundColor: '#fff', 
          border: '1px solid #A7D7C5', 
          borderRadius: '12px', 
          padding: '40px', 
          textAlign: 'center', 
          marginBottom: '30px' 
        }}>
          <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#333', marginBottom: '8px' }}>No journal entries found</h3>
          <p style={{ fontSize: '16px', color: '#666', margin: 0 }}>Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHead}>
                <th style={styles.tableHeadCellFirst}>Patient</th>
                <th style={styles.tableHeadCell}>Date</th>
                <th style={styles.tableHeadCell}>Journal Entry Title</th>
                <th style={styles.tableHeadCell}>Mood</th>
                <th style={styles.tableHeadCell}>Sentiment</th>
                <th style={styles.tableHeadCell}>Emotions Detected</th>
                <th style={styles.tableHeadCellLast}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => {
                // Map API data to UI format
                const sentimentType = entry.sentiment?.type || 'neutral';
                const sentimentLabel = sentimentType.charAt(0).toUpperCase() + sentimentType.slice(1);
                const moodType = entry.mood?.label || sentimentType;
                const emotions = getEmotionTags(entry) || [];
                const isEven = index % 2 === 1;
                
                return (
                  <tr key={entry._id || `entry-${index}`} style={isEven ? styles.tableRowAlt : styles.tableRow}>
                    <td style={styles.tableCellFirst}>{entry.patientName || 'Unknown'}</td>
                    <td style={styles.tableCell}>{formatDateSafe(entry.date)}</td>
                    <td style={styles.tableCell}>
                      {entry.title || entry.templateName || 'Journal Entry'}
                    </td>
                    <td style={styles.tableCell}>
                      <MoodIndicator mood={moodType} />
                    </td>
                    <td style={styles.tableCell}>
                      <SentimentIndicator sentiment={sentimentLabel} />
                    </td>
                    <td style={styles.tableCell}>
                      <div style={styles.emotionTags}>
                        {emotions.slice(0, 3).map((emotion, i) => (
                          <span
                            key={i}
                            style={styles.emotionTag}
                          >
                            {emotion.charAt(0).toUpperCase() + emotion.slice(1)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={styles.tableCellLast}>
                      <div style={styles.actionIcons}>
                        <img
                          src="/assets/icons/view_icon.svg"
                          style={styles.actionIconView}
                          onClick={() => viewEntry(entry._id)}
                          title="View Entry"
                          alt="View"
                        />
                        <img
                          src="/assets/icons/edit_icon.svg"
                          style={styles.actionIconEdit}
                          onClick={() => editEntry(entry._id)}
                          title="Edit Entry"
                          alt="Edit"
                        />
                        <img
                          src="/assets/icons/delete_icon.svg"
                          style={styles.actionIconDelete}
                          onClick={() => deleteEntry(entry._id)}
                          title="Delete Entry"
                          alt="Delete"
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Pagination */}
      {total > rowsPerPage && (
        <div style={styles.pagination}>
          <button
            style={page === 0 ? styles.paginationButtonDisabled : styles.paginationButton}
            onClick={() => handleChangePage(Math.max(0, page - 1))}
            disabled={page === 0}
          >
            &laquo; Previous
          </button>
          
          <div style={styles.paginationInfo}>
            Page {page + 1} of {Math.ceil(total / rowsPerPage)}
          </div>
          
          <button
            style={page >= Math.ceil(total / rowsPerPage) - 1 ? styles.paginationButtonDisabled : styles.paginationButton}
            onClick={() => handleChangePage(Math.min(Math.ceil(total / rowsPerPage) - 1, page + 1))}
            disabled={page >= Math.ceil(total / rowsPerPage) - 1}
          >
            Next &raquo;
          </button>
        </div>
      )}
      
      {/* Rows per page */}
      <div style={styles.rowsPerPage}>
        <span>Rows per page:</span>
        <select
          style={styles.rowsPerPageSelect}
          value={rowsPerPage}
          onChange={handleChangeRowsPerPage}
        >
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
        </select>
      </div>
    </div>
  );
};

export default JournalList;