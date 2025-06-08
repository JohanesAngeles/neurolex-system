// client/src/components/doctors/Appointments/DoctorAppointments.jsx
import React, { useState, useEffect } from 'react';
import doctorService from '../../../services/doctorService';
import billingService from '../../../services/billingService';
import { format, isToday, isTomorrow, isPast, addMinutes } from 'date-fns';
import '../../../styles/components/doctor/DoctorAppointments.css';

const DoctorAppointments = () => {
  // States
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showBilling, setShowBilling] = useState(false);
  
  // Modal states
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [showPaymentSetupModal, setShowPaymentSetupModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  
  // Form states
  const [responseMessage, setResponseMessage] = useState('');
  const [responseAction, setResponseAction] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  
  // Billing states
  const [billingData, setBillingData] = useState([]);
  const [billingSearchQuery, setBillingSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState('');
  const [billingStatusFilter, setBillingStatusFilter] = useState('all');
  
  // Payment setup states
  const [paymentMethods, setPaymentMethods] = useState({
    gcash: { qrCode: null, enabled: false },
    paymaya: { qrCode: null, enabled: false },
    bankAccounts: []
  });
  const [newBankAccount, setNewBankAccount] = useState({
    bankName: '',
    accountName: '',
    accountNumber: ''
  });

  // Fetch data on component mount
  useEffect(() => {
    fetchAppointments();
    fetchPatients();
    fetchBillingData();
    fetchPaymentMethods();
  }, []);

  const fetchAppointments = async () => {
  try {
    setLoading(true);
    const response = await doctorService.getAppointments();
    
    // 🚨 DEBUG: Log appointments data
    console.log('📋 Appointments response:', response);
    console.log('📋 Appointments array:', response.data);
    console.log('📋 Number of appointments:', response.data?.length || 0);
    
    // Log each appointment's payment info
    if (response.data) {
      response.data.forEach((apt, index) => {
        console.log(`📋 Appointment ${index + 1}:`, {
          id: apt._id,
          patient: `${apt.patient?.firstName || 'Unknown'} ${apt.patient?.lastName || 'Patient'}`,
          status: apt.status,
          appointmentType: apt.appointmentType,
          paymentAmount: apt.payment?.amount || apt.sessionFee || 'No payment info',
          paymentStatus: apt.payment?.status || apt.billingStatus || 'No payment status'
        });
      });
    }
    
    if (response.success) {
      setAppointments(response.data || []);
    } else {
      setError('Failed to load appointments');
    }
  } catch (err) {
    console.error('❌ Error fetching appointments:', err);
    setError('Error fetching appointments');
  } finally {
    setLoading(false);
  }
};
  const fetchPatients = async () => {
    try {
      const response = await doctorService.getPatients();
      if (response.success) {
        setPatients(response.patients || []);
      }
    } catch (err) {
      console.error('Error fetching patients:', err);
    }
  };

  const fetchBillingData = async () => {
  try {
    console.log('🔍 Starting billing data fetch...');
    
    // Check if billingService exists
    if (!billingService || !billingService.getBillingRecords) {
      console.error('❌ billingService or getBillingRecords method not found');
      return;
    }
    
    console.log('🔍 Calling billingService.getBillingRecords()...');
    const response = await billingService.getBillingRecords();
    
    // 🚨 DETAILED DEBUGGING
    console.log('📊 RAW billing response:', response);
    console.log('📊 Response success:', response?.success);
    console.log('📊 Response data:', response?.data);
    console.log('📊 Response data type:', typeof response?.data);
    console.log('📊 Response data length:', response?.data?.length);
    
    if (response && response.success && response.data) {
      console.log('✅ Setting billing data with', response.data.length, 'records');
      
      // 🚨 LOG EACH BILLING RECORD
      response.data.forEach((record, index) => {
        console.log(`📊 Billing Record ${index + 1}:`, {
          id: record.id,
          patientName: record.patientName,
          sessionFee: record.sessionFee,
          status: record.status,
          appointmentDate: record.appointmentDate
        });
      });
      
      setBillingData(response.data);
      console.log('✅ Billing data set in React state');
      
    } else {
      console.log('❌ Invalid response structure:', {
        hasResponse: !!response,
        hasSuccess: !!response?.success,
        hasData: !!response?.data,
        success: response?.success,
        dataType: typeof response?.data
      });
      
      // Set empty array instead of mock data
      setBillingData([]);
    }
    
  } catch (err) {
    console.error('❌ BILLING FETCH ERROR:', err);
    console.error('❌ Error name:', err.name);
    console.error('❌ Error message:', err.message);
    console.error('❌ Error stack:', err.stack);
    
    // 🚨 CHECK IF THIS IS A NETWORK ERROR
    if (err.response) {
      console.error('❌ Server responded with error:', {
        status: err.response.status,
        statusText: err.response.statusText,
        data: err.response.data
      });
    } else if (err.request) {
      console.error('❌ Network error - no response received:', err.request);
    }
    
    // 🚨 REMOVE MOCK DATA - Let's see what's actually happening
    setBillingData([]);
    setError('Failed to fetch billing data: ' + err.message);
  }
};

  const fetchPaymentMethods = async () => {
    try {
      const response = await billingService.getPaymentMethods();
      if (response.success) {
        setPaymentMethods(response.data || {
          gcash: { qrCode: null, enabled: false },
          paymaya: { qrCode: null, enabled: false },
          bankAccounts: []
        });
      }
    } catch (err) {
      console.error('Error fetching payment methods:', err);
      const mockPaymentMethods = {
        gcash: { qrCode: null, enabled: false },
        paymaya: { qrCode: null, enabled: false },
        bankAccounts: [
          { id: 1, bankName: 'BDO', accountName: 'Dr. John Smith', accountNumber: '1234567890' }
        ]
      };
      setPaymentMethods(mockPaymentMethods);
    }
  };

  const getUpcomingAppointments = () => {
    let filtered = appointments.filter(apt => 
      (apt.status === 'Scheduled' && !isPast(new Date(apt.appointmentDate))) ||
      isToday(new Date(apt.appointmentDate))
    );
    
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(apt => 
        apt.patient?.firstName?.toLowerCase().includes(query) || 
        apt.patient?.lastName?.toLowerCase().includes(query) || 
        apt.appointmentType?.toLowerCase().includes(query)
      );
    }
    
    return filtered.sort((a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate));
  };

  const getPendingAppointments = () => {
    let filtered = appointments.filter(apt => apt.status === 'Pending');
    
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(apt => 
        apt.patient?.firstName?.toLowerCase().includes(query) || 
        apt.patient?.lastName?.toLowerCase().includes(query) || 
        apt.appointmentType?.toLowerCase().includes(query)
      );
    }
    
    return filtered.sort((a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate));
  };

  const getHistoryAppointments = () => {
  console.log('🔍 Getting history appointments...');
  console.log('🔍 Total appointments available:', appointments.length);
  
  // Log all appointments to see their statuses
  appointments.forEach((apt, index) => {
    console.log(`🔍 Appointment ${index + 1}:`, {
      id: apt._id,
      patient: `${apt.patient?.firstName} ${apt.patient?.lastName}`,
      status: apt.status,
      date: apt.appointmentDate,
      isPast: isPast(new Date(apt.appointmentDate))
    });
  });
  
  // 🚀 ENHANCED FILTER: Include more statuses AND past appointments
  let filtered = appointments.filter(apt => {
    // Original history statuses
    const isHistoryStatus = apt.status === 'Completed' || 
                           apt.status === 'Cancelled' || 
                           apt.status === 'Declined';
    
    // 🚀 NEW: Also include past scheduled appointments
    const isPastScheduled = apt.status === 'Scheduled' && 
                           isPast(new Date(apt.appointmentDate));
    
    // 🚀 NEW: Include appointments with doctor responses (accepted/declined)
    const hasResponse = apt.doctorResponse && 
                       (apt.status === 'Scheduled' || apt.status === 'Declined');
    
    return isHistoryStatus || isPastScheduled || hasResponse;
  });
  
  console.log(`🔍 Found ${filtered.length} history appointments after filtering`);
  
  // Apply search filter if there's a search query
  if (searchQuery.trim() !== '') {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(apt => 
      apt.patient?.firstName?.toLowerCase().includes(query) || 
      apt.patient?.lastName?.toLowerCase().includes(query) || 
      apt.appointmentType?.toLowerCase().includes(query)
    );
    console.log(`🔍 After search filter: ${filtered.length} appointments`);
  }
  
  // Sort by most recent date first
  const sorted = filtered.sort((a, b) => new Date(b.appointmentDate) - new Date(a.appointmentDate));
  
  console.log(`🔍 Returning ${sorted.length} history appointments`);
  return sorted;
};

  const handleAppointmentResponse = async () => {
    if (!selectedAppointment || !responseAction) return;
    
    try {
      let response;
      if (responseAction === 'accept') {
        response = await doctorService.acceptAppointment(selectedAppointment._id, responseMessage);
      } else {
        response = await doctorService.declineAppointment(selectedAppointment._id, responseMessage);
      }
      
      if (response.success) {
        setAppointments(prevAppointments => 
          prevAppointments.map(apt => 
            apt._id === selectedAppointment._id 
              ? { 
                  ...apt, 
                  status: responseAction === 'accept' ? 'Scheduled' : 'Declined',
                  doctorResponse: {
                    responseDate: new Date().toISOString(),
                    responseMessage
                  }
                } 
              : apt
          )
        );
        closeResponseModal();
      }
    } catch (err) {
      setError(`Error ${responseAction}ing appointment`);
    }
  };

  const handleReschedule = async () => {
    if (!selectedAppointment || !newDate || !newTime) return;
    
    try {
      const appointmentDateTime = new Date(`${newDate}T${newTime}`);
      const response = await doctorService.rescheduleAppointment(
        selectedAppointment._id, 
        appointmentDateTime.toISOString()
      );
      
      if (response.success) {
        setAppointments(prevAppointments => 
          prevAppointments.map(apt => 
            apt._id === selectedAppointment._id 
              ? { ...apt, appointmentDate: appointmentDateTime.toISOString() } 
              : apt
          )
        );
        closeRescheduleModal();
      }
    } catch (err) {
      setError('Error rescheduling appointment');
    }
  };

  const handleQRCodeUpload = async (type, file) => {
    if (!file) return;
    
    try {
      console.log(`Uploading ${type} QR code...`);
      const response = await billingService.uploadQRCode(type, file);
      
      if (response.success) {
        setPaymentMethods(prev => ({
          ...prev,
          [type]: {
            ...prev[type],
            qrCode: response.qrCodeUrl,
            enabled: true
          }
        }));
        console.log(`${type} QR code uploaded successfully`);
      }
    } catch (error) {
      console.error(`Error uploading ${type} QR code:`, error);
      setError(`Failed to upload ${type} QR code`);
    }
  };

  const handleAddBankAccount = async () => {
    if (!newBankAccount.bankName || !newBankAccount.accountName || !newBankAccount.accountNumber) {
      setError('Please fill in all bank account fields');
      return;
    }
    
    try {
      console.log('Adding bank account:', newBankAccount);
      const response = await billingService.addBankAccount(newBankAccount);
      
      if (response.success) {
        setPaymentMethods(prev => ({
          ...prev,
          bankAccounts: [...prev.bankAccounts, response.bankAccount]
        }));
        
        setNewBankAccount({
          bankName: '',
          accountName: '',
          accountNumber: ''
        });
        
        console.log('Bank account added successfully');
      }
    } catch (error) {
      console.error('Error adding bank account:', error);
      setError('Failed to add bank account');
    }
  };

  const handleRemoveBankAccount = async (accountId) => {
    try {
      console.log('Removing bank account:', accountId);
      const response = await billingService.removeBankAccount(accountId);
      
      if (response.success) {
        setPaymentMethods(prev => ({
          ...prev,
          bankAccounts: prev.bankAccounts.filter(account => account.id !== accountId)
        }));
        
        console.log('Bank account removed successfully');
      }
    } catch (error) {
      console.error('Error removing bank account:', error);
      setError('Failed to remove bank account');
    }
  };

  const handleSavePaymentMethods = async () => {
    try {
      console.log('Saving payment methods:', paymentMethods);
      const response = await billingService.updatePaymentMethods(paymentMethods);
      
      if (response.success) {
        console.log('Payment methods saved successfully');
        setShowPaymentSetupModal(false);
        
        setTimeout(() => {
          setError(null);
        }, 3000);
      }
    } catch (error) {
      console.error('Error saving payment methods:', error);
      setError('Failed to save payment methods');
    }
  };

  const openResponseModal = (appointment, action) => {
    setSelectedAppointment(appointment);
    setResponseAction(action);
    setResponseMessage('');
    setShowResponseModal(true);
  };

  const closeResponseModal = () => {
    setShowResponseModal(false);
    setSelectedAppointment(null);
    setResponseMessage('');
    setResponseAction('');
  };

  // ✅ REPLACE openRescheduleModal function (around line 428)
const openRescheduleModal = (appointment) => {
  setSelectedAppointment(appointment);
  
  const appointmentDate = new Date(appointment.appointmentDate);
  setNewDate(format(appointmentDate, 'yyyy-MM-dd'));
  setNewTime(format(appointmentDate, 'HH:mm'));
  setShowRescheduleModal(true);
};

  const closeRescheduleModal = () => {
    setShowRescheduleModal(false);
    setSelectedAppointment(null);
    setNewDate('');
    setNewTime('');
  };

  const formatAppointmentTime = (dateString) => {
  const date = new Date(dateString);
  
  let dayDisplay;
  if (isToday(date)) {
    dayDisplay = 'Today';
  } else if (isTomorrow(date)) {
    dayDisplay = 'Tomorrow';
  } else {
    dayDisplay = format(date, 'MMM d, yyyy');
  }
  
  const timeDisplay = format(date, 'h:mm a');
  return `${dayDisplay} at ${timeDisplay}`;
};
  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending': return 'status-pending';
      case 'Scheduled': return 'status-scheduled';
      case 'Completed': return 'status-completed';
      case 'Cancelled': return 'status-cancelled';
      case 'Declined': return 'status-declined';
      default: return 'status-default';
    }
  };

  const getBillingStatusColor = (status) => {
    switch (status) {
      case 'paid': return 'billing-paid';
      case 'pending': return 'billing-pending';
      case 'overdue': return 'billing-overdue';
      default: return 'billing-default';
    }
  };

  const renderAppointmentsTable = (appointments, title, isPendingSection = false) => (
    <div className="doctor-appointments-section">
      <div className="doctor-appointments-section-header">
        <h2 className="doctor-appointments-section-title">{title}</h2>
        <span className="doctor-appointments-section-count">({appointments.length})</span>
      </div>
      
      <div className="doctor-appointments-table">
        <div className="doctor-appointments-table-header">
          <div className="doctor-appointments-header-cell">Patient</div>
          <div className="doctor-appointments-header-cell">Date & Time</div>
          <div className="doctor-appointments-header-cell">Type</div>
          <div className="doctor-appointments-header-cell">Duration</div>
          <div className="doctor-appointments-header-cell">Status</div>
          <div className="doctor-appointments-header-cell">Actions</div>
        </div>
        
        {appointments.length === 0 ? (
          <div className="doctor-appointments-empty-state">
            <p>No {title.toLowerCase()} found</p>
          </div>
        ) : (
          appointments.map((appointment) => (
            <div key={appointment._id} className="doctor-appointments-table-row">
              <div className="doctor-appointments-table-cell doctor-appointments-patient-cell">
                <div className="doctor-appointments-patient-avatar">
                  {appointment.patient?.firstName?.[0] || 'P'}
                </div>
                <div className="doctor-appointments-patient-info">
                  <span className="doctor-appointments-patient-name">
                    {appointment.patient?.firstName} {appointment.patient?.lastName}
                  </span>
                </div>
              </div>
              
              <div className="doctor-appointments-table-cell">
                <div className="doctor-appointments-date-time-info">
                  
<span className="doctor-appointments-time-range">
  {format(new Date(appointment.appointmentDate), 'h:mm a')} - 
  {format(addMinutes(new Date(appointment.appointmentDate), appointment.duration || 30), 'h:mm a')}
</span>
                </div>
              </div>
              
              <div className="doctor-appointments-table-cell">
                <span className="doctor-appointments-appointment-type">{appointment.appointmentType}</span>
              </div>
              
              <div className="doctor-appointments-table-cell">
                <span className="doctor-appointments-duration">{appointment.duration || 30} min</span>
              </div>
              
              <div className="doctor-appointments-table-cell">
                <span className={`doctor-appointments-status-badge doctor-appointments-${getStatusColor(appointment.status)}`}>
                  {appointment.status}
                </span>
              </div>
              
              <div className="doctor-appointments-table-cell doctor-appointments-actions-cell">
                {isPendingSection && appointment.status === 'Pending' && (
                  <>
                    <button 
                      className="doctor-appointments-action-btn doctor-appointments-accept-btn"
                      onClick={() => openResponseModal(appointment, 'accept')}
                    >
                      Accept
                    </button>
                    <button 
                      className="doctor-appointments-action-btn doctor-appointments-decline-btn"
                      onClick={() => openResponseModal(appointment, 'decline')}
                    >
                      Decline
                    </button>
                  </>
                )}
                
                {appointment.status === 'Scheduled' && (
                  <>
                    <button 
                      className="doctor-appointments-action-btn doctor-appointments-edit-btn"
                      onClick={() => openRescheduleModal(appointment)}
                    >
                      Reschedule
                    </button>
                    <button 
                      className="doctor-appointments-action-btn doctor-appointments-complete-btn"
                      onClick={() => {
                        // Handle mark as completed
                      }}
                    >
                      Complete
                    </button>
                  </>
                )}
                
                <button className="doctor-appointments-action-btn doctor-appointments-view-btn">
                  View
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderBillingTable = () => (
    <div className="doctor-appointments-billing-section">
      <div className="doctor-appointments-billing-header">
        <div className="doctor-appointments-billing-controls">
          <div className="doctor-appointments-search-bar">
            <input
              type="text"
              placeholder="Search billing records..."
              value={billingSearchQuery}
              onChange={(e) => setBillingSearchQuery(e.target.value)}
            />
          </div>
          
          <select
            value={selectedPatient}
            onChange={(e) => setSelectedPatient(e.target.value)}
            className="doctor-appointments-patient-filter"
          >
            <option value="">All Patients</option>
            {patients.map(patient => (
              <option key={patient._id} value={patient._id}>
                {patient.firstName} {patient.lastName}
              </option>
            ))}
          </select>
          
          <select
            value={billingStatusFilter}
            onChange={(e) => setBillingStatusFilter(e.target.value)}
            className="doctor-appointments-status-filter"
          >
            <option value="all">All Status</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="overdue">Overdue</option>
          </select>
          
          <button className="doctor-appointments-export-btn" onClick={() => console.log('Export PDF')}>
            Export PDF
          </button>
        </div>
        
        <button 
          className="doctor-appointments-setup-payment-btn"
          onClick={() => setShowPaymentSetupModal(true)}
        >
          Setup Payment Methods
        </button>
      </div>
      
      <div className="doctor-appointments-billing-table">
        <div className="doctor-appointments-table-header">
          <div className="doctor-appointments-header-cell">Appointment Schedule</div>
          <div className="doctor-appointments-header-cell">Patient Name</div>
          <div className="doctor-appointments-header-cell">Session Fee</div>
          <div className="doctor-appointments-header-cell">Billing Status</div>
          <div className="doctor-appointments-header-cell">Action</div>
        </div>
        
        {billingData.map((bill) => (
          <div key={bill.id} className="doctor-appointments-table-row">
            <div className="doctor-appointments-table-cell">
              <span className="doctor-appointments-appointment-date">
                {format(new Date(bill.appointmentDate), 'MMM dd, yyyy')}
              </span>
              <span className="doctor-appointments-appointment-time">
                {format(new Date(bill.appointmentDate), 'h:mm a')}
              </span>
            </div>
            
            <div className="doctor-appointments-table-cell">
              <span className="doctor-appointments-patient-name">{bill.patientName}</span>
            </div>
            
            <div className="doctor-appointments-table-cell">
              <span className="doctor-appointments-session-fee">${bill.sessionFee}</span>
            </div>
            
            <div className="doctor-appointments-table-cell">
              <span className={`doctor-appointments-status-badge doctor-appointments-billing-${getBillingStatusColor(bill.status)}`}>
                {bill.status.charAt(0).toUpperCase() + bill.status.slice(1)}
              </span>
            </div>
            
            <div className="doctor-appointments-table-cell">
              <button 
                className="doctor-appointments-action-btn doctor-appointments-view-btn"
                onClick={() => setShowBillingModal(true)}
              >
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="doctor-appointments-loading-container">
        <div className="doctor-appointments-loading-spinner"></div>
        <p>Loading appointments...</p>
      </div>
    );
  }

  return (
    <div className="doctor-appointments-container">
      <div className="doctor-appointments-header">
        <h1 className="doctor-appointments-page-title">My Appointments</h1>
        
        {error && (
          <div className="doctor-appointments-error-alert">
            <span className="doctor-appointments-alert-icon">⚠️</span>
            {error}
          </div>
        )}
        
        <div className="doctor-appointments-header-controls">
          <div className="doctor-appointments-search-container">
            <input
              type="text"
              placeholder="Search appointments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="doctor-appointments-search-input"
            />
          </div>
          
          <button 
            className="doctor-appointments-billing-toggle-btn"
            onClick={() => setShowBilling(!showBilling)}
          >
            {showBilling ? 'Hide Billing' : 'Show Billing & Payment'}
          </button>
        </div>
      </div>
      
      <div className="doctor-appointments-content">
        {renderAppointmentsTable(getUpcomingAppointments(), "Upcoming Appointments")}
        {renderAppointmentsTable(getPendingAppointments(), "Pending Appointment Requests", true)}
        {renderAppointmentsTable(getHistoryAppointments(), "Appointment History")}
        
        {showBilling && (
          <div className="doctor-appointments-billing-section-wrapper">
            <div className="doctor-appointments-section-header">
              <h2 className="doctor-appointments-section-title">Billing & Payment Information</h2>
            </div>
            {renderBillingTable()}
          </div>
        )}
      </div>
      
      {showResponseModal && (
        <div className="doctor-appointments-modal-overlay">
          <div className="doctor-appointments-modal">
            <div className="doctor-appointments-modal-header">
              <h3>{responseAction === 'accept' ? 'Accept' : 'Decline'} Appointment</h3>
              <button className="doctor-appointments-close-btn" onClick={closeResponseModal}>×</button>
            </div>
            
            <div className="doctor-appointments-modal-body">
              {selectedAppointment && (
                <div className="doctor-appointments-appointment-summary">
                  <p><strong>Patient:</strong> {selectedAppointment.patient?.firstName} {selectedAppointment.patient?.lastName}</p>
                  <p><strong>Date:</strong> {formatAppointmentTime(selectedAppointment.appointmentDate)}</p>
                </div>
              )}
              
              <div className="doctor-appointments-form-group">
                <label>Response Message (Optional)</label>
                <textarea
                  value={responseMessage}
                  onChange={(e) => setResponseMessage(e.target.value)}
                  placeholder="Leave a message for the patient..."
                  rows={3}
                />
              </div>
            </div>
            
            <div className="doctor-appointments-modal-footer">
              <button className="doctor-appointments-cancel-btn" onClick={closeResponseModal}>
                Cancel
              </button>
              <button 
                className={`doctor-appointments-confirm-btn doctor-appointments-${responseAction === 'accept' ? 'accept' : 'decline'}`}
                onClick={handleAppointmentResponse}
              >
                {responseAction === 'accept' ? 'Accept' : 'Decline'} Appointment
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showRescheduleModal && (
        <div className="doctor-appointments-modal-overlay">
          <div className="doctor-appointments-modal">
            <div className="doctor-appointments-modal-header">
              <h3>Reschedule Appointment</h3>
              <button className="doctor-appointments-close-btn" onClick={closeRescheduleModal}>×</button>
            </div>
            
            <div className="doctor-appointments-modal-body">
              <div className="doctor-appointments-form-row">
                <div className="doctor-appointments-form-group">
                  <label>New Date</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                  />
                </div>
                
                <div className="doctor-appointments-form-group">
                  <label>New Time</label>
                  <input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                  />
                </div>
              </div>
            </div>
            
            <div className="doctor-appointments-modal-footer">
              <button className="doctor-appointments-cancel-btn" onClick={closeRescheduleModal}>
                Cancel
              </button>
              <button className="doctor-appointments-confirm-btn doctor-appointments-reschedule" onClick={handleReschedule}>
                Reschedule Appointment
              </button>
            </div>
          </div>
        </div>
      )}

      {showPaymentSetupModal && (
        <div className="doctor-appointments-modal-overlay">
          <div className="doctor-appointments-modal doctor-appointments-large-modal">
            <div className="doctor-appointments-modal-header">
              <h3>Setup Payment Methods</h3>
              <button className="doctor-appointments-close-btn" onClick={() => setShowPaymentSetupModal(false)}>×</button>
            </div>
            
            <div className="doctor-appointments-modal-body">
              <div className="doctor-appointments-payment-setup-section">
                <h4>Digital Wallets</h4>
                
                <div className="doctor-appointments-payment-method">
                  <label>GCash QR Code</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleQRCodeUpload('gcash', e.target.files[0])}
                  />
                  {paymentMethods.gcash.qrCode && (
                    <img src={paymentMethods.gcash.qrCode} alt="GCash QR" className="doctor-appointments-qr-preview" />
                  )}
                </div>
                
                <div className="doctor-appointments-payment-method">
                  <label>PayMaya QR Code</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleQRCodeUpload('paymaya', e.target.files[0])}
                  />
                  {paymentMethods.paymaya.qrCode && (
                    <img src={paymentMethods.paymaya.qrCode} alt="PayMaya QR" className="doctor-appointments-qr-preview" />
                  )}
                </div>
              </div>
              
              <div className="doctor-appointments-payment-setup-section">
                <h4>Bank Accounts</h4>
                
                <div className="doctor-appointments-bank-account-form">
                  <div className="doctor-appointments-form-row">
                    <input
                      type="text"
                      placeholder="Bank Name"
                      value={newBankAccount.bankName}
                      onChange={(e) => setNewBankAccount(prev => ({...prev, bankName: e.target.value}))}
                    />
                    <input
                      type="text"
                      placeholder="Account Name"
                      value={newBankAccount.accountName}
                      onChange={(e) => setNewBankAccount(prev => ({...prev, accountName: e.target.value}))}
                    />
                    <input
                      type="text"
                      placeholder="Account Number"
                      value={newBankAccount.accountNumber}
                      onChange={(e) => setNewBankAccount(prev => ({...prev, accountNumber: e.target.value}))}
                    />
                    <button className="doctor-appointments-add-account-btn" onClick={handleAddBankAccount}>
                      Add
                    </button>
                  </div>
                </div>
                
                <div className="doctor-appointments-bank-accounts-list">
                  {paymentMethods.bankAccounts.map((account) => (
                    <div key={account.id} className="doctor-appointments-bank-account-item">
                      <span>{account.bankName}</span>
                      <span>{account.accountName}</span>
                      <span>{account.accountNumber}</span>
                      <button className="doctor-appointments-remove-btn" onClick={() => handleRemoveBankAccount(account.id)}>×</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="doctor-appointments-modal-footer">
              <button className="doctor-appointments-cancel-btn" onClick={() => setShowPaymentSetupModal(false)}>
                Cancel
              </button>
              <button className="doctor-appointments-confirm-btn doctor-appointments-save" onClick={handleSavePaymentMethods}>
               Save Payment Methods
             </button>
           </div>
         </div>
       </div>
     )}
     
     {showBillingModal && (
       <div className="doctor-appointments-modal-overlay">
         <div className="doctor-appointments-modal">
           <div className="doctor-appointments-modal-header">
             <h3>Billing Details</h3>
             <button className="doctor-appointments-close-btn" onClick={() => setShowBillingModal(false)}>×</button>
           </div>
           
           <div className="doctor-appointments-modal-body">
             <div className="doctor-appointments-billing-details">
               <p><strong>Patient:</strong> John Doe</p>
               <p><strong>Session Date:</strong> Jan 15, 2024</p>
               <p><strong>Session Fee:</strong> $150</p>
               <p><strong>Status:</strong> <span className="doctor-appointments-status-badge doctor-appointments-billing-paid">Paid</span></p>
               <p><strong>Payment Method:</strong> GCash</p>
               <p><strong>Transaction ID:</strong> TXN123456789</p>
             </div>
           </div>
           
           <div className="doctor-appointments-modal-footer">
             <button className="doctor-appointments-confirm-btn" onClick={() => setShowBillingModal(false)}>
               Close
             </button>
           </div>
         </div>
       </div>
     )}
   </div>
 );
};

export default DoctorAppointments;