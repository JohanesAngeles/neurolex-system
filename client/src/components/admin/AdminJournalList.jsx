// client/src/components/admin/AdminJournalList.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import adminService from '../../services/adminService';
import { format } from 'date-fns';

const AdminJournalList = () => {
  const navigate = useNavigate();
  
  // State for entries and pagination
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);
  
  // State for filters
  const [filters, setFilters] = useState({
    patient: '',
    doctor: '',
    tenant: '',
    dateFrom: '',
    dateTo: '',
    sentiment: '',
    mood: '',
    search: ''
  });
  
  // State for filter options
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [tenants, setTenants] = useState([]);
  
  // State for modals
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);

  // Load data when component mounts or filters change
  useEffect(() => {
    loadJournalEntries();
  }, [currentPage, itemsPerPage, filters]);

  // Load filter options when component mounts
  useEffect(() => {
    loadFilterOptions();
  }, []);

  const loadJournalEntries = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        ...filters
      };
      
      const response = await adminService.getJournalEntries(params);
      
      if (response.success) {
        setEntries(response.data || []);
        setTotalEntries(response.total || 0);
        setTotalPages(Math.ceil((response.total || 0) / itemsPerPage));
      } else {
        throw new Error(response.message || 'Failed to load journal entries');
      }
    } catch (err) {
      console.error('Error loading journal entries:', err);
      setError(err.message);
      
      // Mock data for development
      if (process.env.NODE_ENV === 'development') {
        const mockEntries = [
          {
            _id: '1',
            title: 'Today\'s Reflection',
            patientName: 'John Doe',
            doctorName: 'Dr. Sarah Wilson',
            tenantName: 'MindBridge Health',
            date: new Date().toISOString(),
            sentiment: { type: 'positive', score: 0.8 },
            mood: { label: 'good' },
            emotions: ['happiness', 'gratitude'],
            wordCount: 150,
            content: 'Today I realized how much progress I\'ve made...'
          },
          {
            _id: '2',
            title: 'Challenging Day',
            patientName: 'Jane Smith',
            doctorName: 'Dr. Michael Chen',
            tenantName: 'NovaTherapy',
            date: new Date(Date.now() - 86400000).toISOString(),
            sentiment: { type: 'negative', score: -0.6 },
            mood: { label: 'struggling' },
            emotions: ['sadness', 'anxiety'],
            wordCount: 200,
            content: 'Today was particularly difficult...'
          }
        ];
        setEntries(mockEntries);
        setTotalEntries(mockEntries.length);
        setTotalPages(1);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadFilterOptions = async () => {
    try {
      // Load patients, doctors, and tenants for filter dropdowns
      const [patientsResponse, doctorsResponse, tenantsResponse] = await Promise.all([
        adminService.getAllPatientsForFilter().catch(() => ({ data: [] })),
        adminService.getAllDoctorsForFilter().catch(() => ({ data: [] })),
        adminService.getTenants().catch(() => ({ data: [] }))
      ]);
      
      setPatients(patientsResponse.data || []);
      setDoctors(doctorsResponse.data || []);
      setTenants(tenantsResponse.data || []);
    } catch (err) {
      console.error('Error loading filter options:', err);
      
      // Mock data for development
      if (process.env.NODE_ENV === 'development') {
        setPatients([
          { _id: '1', firstName: 'John', lastName: 'Doe' },
          { _id: '2', firstName: 'Jane', lastName: 'Smith' }
        ]);
        setDoctors([
          { _id: '1', firstName: 'Dr. Sarah', lastName: 'Wilson' },
          { _id: '2', firstName: 'Dr. Michael', lastName: 'Chen' }
        ]);
        setTenants([
          { _id: '1', name: 'MindBridge Health' },
          { _id: '2', name: 'NovaTherapy' }
        ]);
      }
    }
  };

  // Handle filter changes
  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
    setCurrentPage(1); // Reset to first page when filters change
  };

  // Reset filters
  const resetFilters = () => {
    setFilters({
      patient: '',
      doctor: '',
      tenant: '',
      dateFrom: '',
      dateTo: '',
      sentiment: '',
      mood: '',
      search: ''
    });
    setCurrentPage(1);
  };

  // Handle pagination
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (e) => {
    setItemsPerPage(parseInt(e.target.value));
    setCurrentPage(1);
  };

  // Handle entry deletion
  const handleDelete = async () => {
    if (!selectedEntry) return;
    
    try {
      const response = await adminService.deleteJournalEntry(selectedEntry._id);
      
      if (response.success) {
        toast.success('Journal entry deleted successfully');
        setShowDeleteModal(false);
        loadJournalEntries();
      } else {
        throw new Error(response.message || 'Failed to delete journal entry');
      }
    } catch (err) {
      console.error('Error deleting journal entry:', err);
      toast.error(err.message);
    }
  };

  // Handle PDF export
  const handleExportPDF = async () => {
    try {
      await adminService.exportJournalEntriesToPDF(filters);
      toast.success('PDF exported successfully');
    } catch (err) {
      console.error('Error exporting PDF:', err);
      toast.error('Failed to export PDF');
    }
  };

  // View entry details
  const viewEntry = (entryId) => {
    navigate(`/admin/journal-entries/${entryId}`);
  };

  // Open delete modal
  const openDeleteModal = (entry) => {
    setSelectedEntry(entry);
    setShowDeleteModal(true);
  };

  // Utility functions
  const formatDateSafe = (dateString) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const getSentimentColor = (sentiment) => {
    const type = sentiment?.type || 'neutral';
    switch (type) {
      case 'positive': return '#4CAF50';
      case 'negative': return '#F44336';
      default: return '#FFD700';
    }
  };

  const getMoodEmoji = (mood) => {
    const label = mood?.label || 'neutral';
    switch (label) {
      case 'good': return '😊';
      case 'struggling': return '😟';
      case 'neutral': return '😐';
      default: return '😐';
    }
  };

  const getMoodText = (mood) => {
    const label = mood?.label || 'neutral';
    switch (label) {
      case 'good': return "I'm good";
      case 'struggling': return "I'm struggling";
      case 'neutral': return "I'm okay";
      default: return "I'm okay";
    }
  };

  // Get pagination info
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalEntries);

  // Inline styles (following the same pattern as your doctor journal list)
  const styles = {
    container: {
      padding: '40px 24px 24px 24px',
      backgroundColor: '#FFFFFF'
    },
    header: {
      marginBottom: '32px'
    },
    headerTitle: {
      fontSize: '45px',
      fontFamily: 'Poppins, sans-serif',
      fontWeight: 400,
      lineHeight: '50px',
      color: '#000000',
      marginBottom: '8px'
    },
    headerSubtitle: {
      fontSize: '15px',
      fontFamily: 'IBM Plex Mono, monospace',
      fontStyle: 'italic',
      fontWeight: 400,
      lineHeight: '20px',
      color: '#3D6B59',
      margin: 0,
      marginTop: '12px'
    },
    dividerLine: {
      width: '100%',
      height: '1px',
      border: 'none',
      backgroundColor: '#A7D7C5',
      margin: '24px 0'
    },
    filtersSection: {
      marginBottom: '24px'
    },
    topControlsRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px',
      gap: '16px'
    },
    searchContainer: {
      position: 'relative',
      flex: 1,
      maxWidth: '421px'
    },
    searchInput: {
      width: '100%',
      height: '54px',
      padding: '15px 16px 15px 48px',
      border: '1px solid #A7D7C5',
      borderRadius: '10px',
      fontSize: '15px',
      fontFamily: 'IBM Plex Mono, monospace',
      backgroundColor: '#FFFFFF',
      boxSizing: 'border-box'
    },
    searchIcon: {
      position: 'absolute',
      left: '16px',
      top: '50%',
      transform: 'translateY(-50%)',
      width: '20px',
      height: '20px',
      color: '#3D6B59'
    },
    exportButton: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      width: '165px',
      height: '54px',
      backgroundColor: '#548170',
      border: '1px solid #548170',
      borderRadius: '10px',
      color: '#FFFFFF',
      fontSize: '15px',
      fontFamily: 'IBM Plex Mono, monospace',
      fontWeight: 700,
      cursor: 'pointer'
    },
    filtersRow: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'flex-end',
      gap: '16px',
      marginBottom: '16px'
    },
    filterGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    },
    filterLabel: {
      fontSize: '15px',
      fontWeight: 700,
      fontFamily: 'IBM Plex Mono, monospace',
      color: '#3D6B59',
      lineHeight: '20px'
    },
    filterSelect: {
      width: '200px',
      height: '54px',
      padding: '15px 16px',
      border: '1px solid #A7D7C5',
      borderRadius: '10px',
      backgroundColor: 'rgba(167, 215, 197, 0.1)',
      fontSize: '15px',
      fontFamily: 'IBM Plex Mono, monospace',
      color: '#548170',
      boxSizing: 'border-box'
    },
    dateInput: {
      width: '200px',
      height: '54px',
      padding: '15px 16px',
      border: '1px solid #A7D7C5',
      borderRadius: '10px',
      backgroundColor: 'rgba(167, 215, 197, 0.1)',
      fontSize: '15px',
      fontFamily: 'IBM Plex Mono, monospace',
      color: '#548170',
      boxSizing: 'border-box'
    },
    resetButton: {
      height: '54px',
      padding: '15px 20px',
      backgroundColor: 'transparent',
      border: '1px solid #A7D7C5',
      borderRadius: '10px',
      color: '#548170',
      fontSize: '15px',
      fontFamily: 'IBM Plex Mono, monospace',
      cursor: 'pointer'
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
      fontFamily: 'IBM Plex Mono, monospace',
      verticalAlign: 'middle'
    },
    tableCellFirst: {
      padding: '12px 16px',
      borderTop: '1px solid #A7D7C5',
      borderBottom: '1px solid #A7D7C5',
      borderLeft: '1px solid #A7D7C5',
      borderTopLeftRadius: '12px',
      borderBottomLeftRadius: '12px',
      fontSize: '15px',
      fontFamily: 'IBM Plex Mono, monospace',
      verticalAlign: 'middle'
    },
    tableCellLast: {
      padding: '12px 16px',
      borderTop: '1px solid #A7D7C5',
      borderBottom: '1px solid #A7D7C5',
      borderRight: '1px solid #A7D7C5',
      borderTopRightRadius: '12px',
      borderBottomRightRadius: '12px',
      fontSize: '15px',
      fontFamily: 'IBM Plex Mono, monospace',
      verticalAlign: 'middle'
    },
    sentimentIndicator: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    sentimentDot: {
      width: '10px',
      height: '10px',
      borderRadius: '50%'
    },
    moodIndicator: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
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
    actionButtons: {
      display: 'flex',
      gap: '8px'
    },
    actionButton: {
      width: '36px',
      height: '36px',
      borderRadius: '8px',
      border: '1px solid #A7D7C5',
      backgroundColor: 'rgba(167, 215, 197, 0.1)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '16px'
    },
    pagination: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: '20px'
    },
    paginationInfo: {
      fontSize: '14px',
      color: '#666'
    },
    paginationControls: {
      display: 'flex',
      gap: '8px'
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
    paginationButtonActive: {
      padding: '8px 16px',
      backgroundColor: '#548170',
      border: '1px solid #548170',
      borderRadius: '6px',
      color: '#fff',
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
    modal: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    },
    modalContent: {
      backgroundColor: '#fff',
      borderRadius: '12px',
      padding: '24px',
      maxWidth: '500px',
      width: '90%'
    },
    modalHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px'
    },
    modalTitle: {
      fontSize: '24px',
      fontWeight: 600,
      color: '#333'
    },
    modalClose: {
      background: 'none',
      border: 'none',
      fontSize: '24px',
      cursor: 'pointer',
      color: '#666'
    },
    modalActions: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '12px',
      marginTop: '24px'
    },
    btnSecondary: {
      padding: '10px 20px',
      backgroundColor: '#fff',
      border: '1px solid #A7D7C5',
      borderRadius: '8px',
      color: '#548170',
      cursor: 'pointer'
    },
    btnDanger: {
      padding: '10px 20px',
      backgroundColor: '#F44336',
      border: '1px solid #F44336',
      borderRadius: '8px',
      color: '#fff',
      cursor: 'pointer'
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>Journal Entries Management</h1>
        <p style={styles.headerSubtitle}>Monitor and manage journal entries across all tenants and patients</p>
      </div>
      
      {/* Divider Line */}
      <hr style={styles.dividerLine} />
      
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
      
      {/* Filters Section */}
      <div style={styles.filtersSection}>
        {/* Top Row - Search and Export */}
        <div style={styles.topControlsRow}>
          <div style={styles.searchContainer}>
            {/* Search Icon */}
            <svg style={styles.searchIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              style={styles.searchInput}
              type="text"
              placeholder="Search journal entries..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
            />
          </div>
          
          <button style={styles.exportButton} onClick={handleExportPDF}>
            📄 Export PDF
          </button>
        </div>
        
        {/* Filters Row */}
        <div style={styles.filtersRow}>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Patient</label>
            <select
              style={styles.filterSelect}
              value={filters.patient}
              onChange={(e) => handleFilterChange('patient', e.target.value)}
            >
              <option value="">All Patients</option>
              {patients.map(patient => (
                <option key={patient._id} value={patient._id}>
                  {patient.firstName} {patient.lastName}
                </option>
              ))}
            </select>
          </div>
          
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Doctor</label>
            <select
              style={styles.filterSelect}
              value={filters.doctor}
              onChange={(e) => handleFilterChange('doctor', e.target.value)}
            >
              <option value="">All Doctors</option>
              {doctors.map(doctor => (
                <option key={doctor._id} value={doctor._id}>
                  {doctor.firstName} {doctor.lastName}
                </option>
              ))}
            </select>
          </div>
          
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Tenant</label>
            <select
              style={styles.filterSelect}
              value={filters.tenant}
              onChange={(e) => handleFilterChange('tenant', e.target.value)}
            >
              <option value="">All Tenants</option>
              {tenants.map(tenant => (
                <option key={tenant._id} value={tenant._id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </div>
          
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>From Date</label>
            <input
              style={styles.dateInput}
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            />
          </div>
          
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>To Date</label>
            <input
              style={styles.dateInput}
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            />
          </div>
          
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Sentiment</label>
            <select
              style={styles.filterSelect}
              value={filters.sentiment}
              onChange={(e) => handleFilterChange('sentiment', e.target.value)}
            >
              <option value="">All</option>
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Negative</option>
            </select>
          </div>
          
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Mood</label>
            <select
              style={styles.filterSelect}
              value={filters.mood}
              onChange={(e) => handleFilterChange('mood', e.target.value)}
            >
              <option value="">All</option>
              <option value="good">Good</option>
              <option value="neutral">Neutral</option>
              <option value="struggling">Struggling</option>
            </select>
          </div>
          
          <button style={styles.resetButton} onClick={resetFilters}>
            Reset Filters
          </button>
        </div>
        
        {/* Items per page */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '14px', fontFamily: 'IBM Plex Mono, monospace', color: '#666' }}>
            Items per page:
          </span>
          <select
            style={{ ...styles.filterSelect, width: '80px' }}
            value={itemsPerPage}
            onChange={handleItemsPerPageChange}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>
        
      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            border: '3px solid #f3f3f3', 
            borderTop: '3px solid #548170', 
            borderRadius: '50%', 
            animation: 'spin 1s linear infinite' 
          }}></div>
        </div>
      ) : entries.length === 0 ? (
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
                <th style={styles.tableHeadCellFirst}>Date</th>
                <th style={styles.tableHeadCell}>Patient</th>
                <th style={styles.tableHeadCell}>Doctor</th>
                <th style={styles.tableHeadCell}>Tenant</th>
                <th style={styles.tableHeadCell}>Entry Title</th>
                <th style={styles.tableHeadCell}>Mood</th>
                <th style={styles.tableHeadCell}>Sentiment</th>
                <th style={styles.tableHeadCell}>Emotions</th>
                <th style={styles.tableHeadCell}>Words</th>
                <th style={styles.tableHeadCellLast}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => {
                const isEven = index % 2 === 1;
                const sentimentType = entry.sentiment?.type || 'neutral';
                const sentimentLabel = sentimentType.charAt(0).toUpperCase() + sentimentType.slice(1);
                const emotions = Array.isArray(entry.emotions) ? entry.emotions : [];
                
                return (
                  <tr key={entry._id} style={isEven ? styles.tableRowAlt : styles.tableRow}>
                    <td style={styles.tableCellFirst}>{formatDateSafe(entry.date)}</td>
                    <td style={styles.tableCell}>{entry.patientName || 'Unknown'}</td>
                    <td style={styles.tableCell}>{entry.doctorName || 'N/A'}</td>
                    <td style={styles.tableCell}>{entry.tenantName || 'N/A'}</td>
                    <td style={styles.tableCell}>
                      {entry.title || 'Journal Entry'}
                    </td>
                    <td style={styles.tableCell}>
                      <div style={styles.moodIndicator}>
                        <span style={{ fontSize: '18px' }}>{getMoodEmoji(entry.mood)}</span>
                        <span style={{ fontSize: '14px', color: '#666' }}>{getMoodText(entry.mood)}</span>
                      </div>
                    </td>
                    <td style={styles.tableCell}>
                      <div style={styles.sentimentIndicator}>
                        <div 
                          style={{
                            ...styles.sentimentDot,
                            backgroundColor: getSentimentColor(entry.sentiment)
                          }}
                        ></div>
                        <span style={{ fontSize: '14px' }}>{sentimentLabel}</span>
                      </div>
                    </td>
                    <td style={styles.tableCell}>
                      <div style={styles.emotionTags}>
                        {emotions.slice(0, 2).map((emotion, i) => (
                          <span key={i} style={styles.emotionTag}>
                            {emotion.charAt(0).toUpperCase() + emotion.slice(1)}
                          </span>
                        ))}
                        {emotions.length > 2 && (
                          <span style={styles.emotionTag}>+{emotions.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td style={styles.tableCell}>
                      {entry.wordCount || 0}
                    </td>
                    <td style={styles.tableCellLast}>
                      <div style={styles.actionButtons}>
                        <button
                          style={styles.actionButton}
                          onClick={() => viewEntry(entry._id)}
                          title="View Entry"
                        >
                          👁️
                        </button>
                        <button
                          style={styles.actionButton}
                          onClick={() => openDeleteModal(entry)}
                          title="Delete Entry"
                        >
                          🗑️
                        </button>
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
      {totalPages > 1 && (
        <div style={styles.pagination}>
          <div style={styles.paginationInfo}>
            Showing {startItem} to {endItem} of {totalEntries} entries
          </div>
          
          <div style={styles.paginationControls}>
            <button
              style={currentPage === 1 ? styles.paginationButtonDisabled : styles.paginationButton}
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let page;
              if (totalPages <= 5) {
                page = i + 1;
              } else if (currentPage <= 3) {
                page = i + 1;
              } else if (currentPage >= totalPages - 2) {
                page = totalPages - 4 + i;
              } else {
                page = currentPage - 2 + i;
              }
              
              return (
                <button
                  key={page}
                  style={currentPage === page ? styles.paginationButtonActive : styles.paginationButton}
                  onClick={() => handlePageChange(page)}
                >
                  {page}
                </button>
              );
            })}
            
            <button
              style={currentPage === totalPages ? styles.paginationButtonDisabled : styles.paginationButton}
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedEntry && (
        <div style={styles.modal} onClick={() => setShowDeleteModal(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Confirm Deletion</h2>
              <button 
                style={styles.modalClose}
                onClick={() => setShowDeleteModal(false)}
              >
                ×
              </button>
            </div>
            
            <div>
              <p>Are you sure you want to permanently delete this journal entry?</p>
              <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
                <strong>Entry:</strong> {selectedEntry.title || 'Journal Entry'}<br />
                <strong>Patient:</strong> {selectedEntry.patientName}<br />
                <strong>Date:</strong> {formatDateSafe(selectedEntry.date)}<br />
                <strong>Words:</strong> {selectedEntry.wordCount || 0}
              </div>
              <p style={{ color: '#F44336', marginTop: '16px' }}>
                ⚠️ This action cannot be undone.
              </p>
            </div>
            
            <div style={styles.modalActions}>
              <button 
                style={styles.btnSecondary}
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
              <button 
                style={styles.btnDanger}
                onClick={handleDelete}
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminJournalList;