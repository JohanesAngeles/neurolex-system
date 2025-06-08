// client/src/pages/doctors/DoctorMessages.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useTenant } from '../../../context/TenantContext';
import FeatureWrapper from '../../../components/common/FeatureWrapper';
import chatService from '../../../services/chatService';
import doctorService from '../../../services/doctorService';
import '../../../styles/components/doctor/DoctorMessages.css';

const DoctorMessages = () => {
  const { currentTenant, getThemeStyles, platformName } = useTenant();
  const theme = getThemeStyles();
  
  // State management
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [streamClient, setStreamClient] = useState(null);
  const [currentChannel, setCurrentChannel] = useState(null);
  const [doctorInfo, setDoctorInfo] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);
  
  // Refs
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);

  // Initialize doctor info and Stream Chat
  useEffect(() => {
  const initializeMessaging = async () => {
  try {
    console.log('🚀 [DEBUG] Starting initializeMessaging...');
    setLoading(true);
    setError(null);
    
    // Get doctor profile
    console.log('🚀 [DEBUG] Getting doctor profile...');
    const profileResponse = await doctorService.getProfile();
    console.log('🚀 [DEBUG] Profile response:', profileResponse);
    
    const profile = profileResponse.data || profileResponse;
    console.log('🚀 [DEBUG] Extracted profile:', profile);
    setDoctorInfo(profile);
    
    console.log('🔍 Initializing messaging for doctor:', profile.firstName, profile.lastName);
    
    // Initialize Stream Chat
    console.log('🚀 [DEBUG] About to generate chat token...');
    const chatToken = await chatService.generateChatToken();
    console.log('🚀 [DEBUG] Chat token generated:', chatToken ? 'SUCCESS' : 'FAILED');
    
    console.log('🚀 [DEBUG] About to initialize Stream Chat...');
    const client = await chatService.initializeStreamChat(
      profile._id,
      {
        name: `Dr. ${profile.firstName} ${profile.lastName}`,
        userType: 'doctor',
        specialty: profile.specialty || profile.specialization || 'General',
        title: profile.title || 'Dr.',
        profilePicture: profile.profilePicture
      },
      chatToken
    );
    console.log('🚀 [DEBUG] Stream Chat client result:', client ? 'SUCCESS' : 'FAILED');
      
      setStreamClient(client);
      console.log('✅ Stream Chat initialized for doctor');
      
      // 🔧 FIX: Pass the profile directly to loadPatients instead of using state
      await loadPatientsWithProfile(profile);
      
    } catch (error) {
      console.error('❌ Error initializing messaging:', error);
      setError('Failed to initialize messaging system. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  };

  initializeMessaging();
  
  // Cleanup on unmount
  return () => {
    if (streamClient) {
      streamClient.disconnectUser();
    }
  };
}, []);


const loadPatientsWithProfile = async (profile) => {
  try {
    console.log('🔍 Loading patients for messaging...');
    
    // Get appointments to find associated patients
    const appointmentsResponse = await doctorService.getAppointments();
    let appointments = [];
    
    if (appointmentsResponse.success && appointmentsResponse.data) {
      appointments = appointmentsResponse.data;
    } else if (Array.isArray(appointmentsResponse)) {
      appointments = appointmentsResponse;
    }
    
    console.log('📋 Found appointments:', appointments.length);
    
    // Extract unique patients from appointments
    const uniquePatients = [];
    const patientIds = new Set();
    
    appointments.forEach(appointment => {
      // 🔧 FIX: Use profile._id instead of doctorInfo._id
      if (appointment.patient && 
          appointment.patient._id !== profile._id && // Use profile instead of doctorInfo
          !patientIds.has(appointment.patient._id)) {
        
        patientIds.add(appointment.patient._id);
        uniquePatients.push({
          _id: appointment.patient._id,
          firstName: appointment.patient.firstName,
          lastName: appointment.patient.lastName,
          profilePicture: appointment.patient.profilePicture,
          email: appointment.patient.email,
          lastAppointment: appointment.appointmentDate,
          appointmentCount: appointments.filter(a => 
            a.patient?._id === appointment.patient._id && 
            a.patient._id !== profile._id // Use profile instead of doctorInfo
          ).length
        });
      }
    });
    
    console.log('👥 Unique patients found (excluding doctor):', uniquePatients.length);
    console.log('🔍 Doctor ID to exclude:', profile._id);
    setPatients(uniquePatients);
    
  } catch (error) {
    console.error('❌ Error loading patients:', error);
    setError('Failed to load patients. Please try again.');
  }
};

  // Load patients from appointments
  const loadPatients = async () => {
  try {
    console.log('🔍 Loading patients for messaging...');
    
    // Get appointments to find associated patients
    const appointmentsResponse = await doctorService.getAppointments();
    let appointments = [];
    
    if (appointmentsResponse.success && appointmentsResponse.data) {
      appointments = appointmentsResponse.data;
    } else if (Array.isArray(appointmentsResponse)) {
      appointments = appointmentsResponse;
    }
    
    console.log('📋 Found appointments:', appointments.length);
    
    // Extract unique patients from appointments
    const uniquePatients = [];
    const patientIds = new Set();
    
    appointments.forEach(appointment => {
      // 🔧 FIX: Make sure patient exists AND is not the same as the doctor
      if (appointment.patient && 
          appointment.patient._id !== doctorInfo._id && // 🚨 KEY FIX: Exclude doctor from patient list
          !patientIds.has(appointment.patient._id)) {
        
        patientIds.add(appointment.patient._id);
        uniquePatients.push({
          _id: appointment.patient._id,
          firstName: appointment.patient.firstName,
          lastName: appointment.patient.lastName,
          profilePicture: appointment.patient.profilePicture,
          email: appointment.patient.email,
          lastAppointment: appointment.appointmentDate,
          appointmentCount: appointments.filter(a => 
            a.patient?._id === appointment.patient._id && 
            a.patient._id !== doctorInfo._id // 🚨 Also exclude doctor from count
          ).length
        });
      }
    });
    
    console.log('👥 Unique patients found (excluding doctor):', uniquePatients.length);
    console.log('🔍 Doctor ID to exclude:', doctorInfo._id);
    setPatients(uniquePatients);
    
  } catch (error) {
    console.error('❌ Error loading patients:', error);
    setError('Failed to load patients. Please try again.');
  }
};

  // Filter patients based on search
  const filteredPatients = patients.filter(patient => {
    if (!searchTerm) return true;
    const fullName = `${patient.firstName} ${patient.lastName}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase());
  });

  // Select patient and load chat
  const selectPatient = async (patient) => {
  try {
    if (!streamClient || !doctorInfo) {
      console.error('❌ Stream client or doctor info not available');
      return;
    }
    
    console.log('💬 Selecting patient for chat:', patient.firstName, patient.lastName);
    setSelectedPatient(patient);
    setMessages([]);
    setError(null);
    
    // 🚀 FIXED: Use the SAME channel ID format as Flutter
    const channelId = `doctor_${patient._id}_${doctorInfo._id}`;
    
    console.log('🔍 Using channel ID:', channelId);
    
    const channel = streamClient.channel('messaging', channelId, {
      name: `Dr. ${doctorInfo.firstName} ${doctorInfo.lastName} & ${patient.firstName} ${patient.lastName}`,
      members: [doctorInfo._id, patient._id],
      created_by_id: doctorInfo._id,
      doctor_id: doctorInfo._id,
      patient_id: patient._id,
      channel_type: 'doctor_patient'
    });
    
    // Watch the channel
    await channel.watch();
    setCurrentChannel(channel);
    
    // Load existing messages
    const state = await channel.query({
      messages: { limit: 50 }
    });
    
    setMessages(state.messages || []);
    console.log('💬 Loaded', state.messages?.length || 0, 'messages');
    
    // Listen for new messages
    channel.on('message.new', (event) => {
      console.log('📩 New message received:', event.message.text);
      setMessages(prev => [...prev, event.message]);
    });
    
    // Scroll to bottom
    setTimeout(() => {
      scrollToBottom();
    }, 100);
    
  } catch (error) {
    console.error('❌ Error selecting patient:', error);
    setError('Failed to load chat. Please try again.');
  }
};

  // Send message
  const sendMessage = async () => {
  if (!newMessage.trim() || !currentChannel || sending) return;
  
  try {
    setSending(true);
    
    // ✅ STEP 1: Send message via Stream Chat (existing code)
    await currentChannel.sendMessage({
      text: newMessage.trim(),
      user_id: doctorInfo._id,
      sender_type: 'doctor'
    });
    
    // ✅ STEP 2: Trigger FCM notification to mobile user (FIXED ENDPOINT)
    try {
      console.log('🔔 Triggering mobile notification...');
      
      // Before the fetch call, add debug info:
      const token = localStorage.getItem('token');
      console.log('🔍 Auth token:', token ? 'EXISTS' : 'MISSING');
      console.log('🔍 Calling URL:', '/api/notifications/message');
      console.log('🔍 Recipient ID:', selectedPatient._id);
      console.log('🔍 Message content:', newMessage.trim());
      
      // 🔥 FIXED: Use the working endpoint (/message not /create-message)
      const response = await fetch('/api/notifications/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          recipientId: selectedPatient._id,
          messageContent: newMessage.trim(),
          conversationId: currentChannel.id
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ FCM notification triggered successfully!', result);
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to trigger FCM notification:', response.status, errorText);
        console.error('❌ Error details:', errorText);
      }
    } catch (notificationError) {
      console.error('❌ Error triggering notification:', notificationError);
      // Don't block message sending if notification fails
    }
    
    setNewMessage('');
    messageInputRef.current?.focus();
    
  } catch (error) {
    console.error('❌ Error sending message:', error);
    setError('Failed to send message. Please try again.');
  } finally {
    setSending(false);
  }
};

  // Handle Enter key
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Format message time
  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    
    return date.toLocaleDateString();
  };

  // Get patient initials for avatar
  const getPatientInitials = (patient) => {
    return `${patient.firstName?.charAt(0) || ''}${patient.lastName?.charAt(0) || ''}`.toUpperCase();
  };

  // Get doctor initials for avatar
  const getDoctorInitials = () => {
    if (!doctorInfo) return 'DR';
    return `${doctorInfo.firstName?.charAt(0) || ''}${doctorInfo.lastName?.charAt(0) || ''}`.toUpperCase();
  };

  if (loading) {
    return (
      <FeatureWrapper feature="Messages" showMessage={true}>
        <div className="doctor-messages-container">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading messaging system...</p>
          </div>
        </div>
      </FeatureWrapper>
    );
  }

  return (
  <FeatureWrapper feature="Messages" showMessage={true}>
    <div className="doctor-messages-container">
      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          <span className="error-text">{error}</span>
          <button 
            className="error-dismiss"
            onClick={() => setError(null)}
          >
            ×
          </button>
        </div>
      )}

      {/* Sidebar Container - simplified with integrated header */}
      <div className="sidebar-container">
        {/* Combined Header with Search */}
        <div className="messages-header">
          <div className="header-top">
            <div className="header-left">
              <h1 className="messages-title">Messages</h1>
              <p className="messages-subtitle">
                Communicate securely with your patients through {platformName}
              </p>
            </div>
            <div className="header-stats">
              <div className="stat-item">
                <span className="stat-number">{patients.length}</span>
                <span className="stat-label">Patients</span>
              </div>
            </div>
          </div>
          
          <div className="header-search">
            <h3 className="conversations-title">Conversations</h3>
            <div className="search-container">
              <input
                type="text"
                placeholder="Search patients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="patient-search"
              />
            </div>
          </div>
        </div>

        {/* Conversations List - directly under header */}
        <div className="conversations-list">
          {filteredPatients.length === 0 ? (
            <div className="no-patients">
              <p className="no-patients-text">
                {searchTerm ? 'No patients found matching your search.' : 'No patients with appointments found.'}
              </p>
              {!searchTerm && (
                <p className="no-patients-subtitle">
                  Patients will appear here after they book appointments with you.
                </p>
              )}
            </div>
          ) : (
            filteredPatients.map((patient) => (
              <div
                key={patient._id}
                className={`conversation-item ${selectedPatient?._id === patient._id ? 'selected' : ''}`}
                onClick={() => selectPatient(patient)}
              >
                <div className="conversation-avatar">
                  {patient.profilePicture ? (
                    <img src={patient.profilePicture} alt={`${patient.firstName} ${patient.lastName}`} />
                  ) : (
                    <div className="avatar-initials">{getPatientInitials(patient)}</div>
                  )}
                  <div className="online-indicator"></div>
                </div>
                <div className="conversation-info">
                  <div className="conversation-header">
                    <div className="patient-name">
                      {patient.firstName} {patient.lastName}
                    </div>
                    <div className="last-message-time">
                      {patient.lastAppointment ? formatMessageTime(patient.lastAppointment) : 'New'}
                    </div>
                  </div>
                  <div className="conversation-preview">
                    <span className="appointment-count">
                      {patient.appointmentCount} appointment{patient.appointmentCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <div className="conversation-badge">
                  <div className="unread-count">●</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="chat-area">
        {selectedPatient ? (
          <>
            {/* Chat Header */}
            <div className="chat-header">
              <div className="chat-patient-info">
                <div className="chat-patient-avatar">
                  {selectedPatient.profilePicture ? (
                    <img src={selectedPatient.profilePicture} alt={`${selectedPatient.firstName} ${selectedPatient.lastName}`} />
                  ) : (
                    <div className="avatar-initials">{getPatientInitials(selectedPatient)}</div>
                  )}
                </div>
                <div className="chat-patient-details">
                  <h3 className="chat-patient-name">
                    {selectedPatient.firstName} {selectedPatient.lastName}
                  </h3>
                  <p className="chat-patient-status">
                    {selectedPatient.appointmentCount} appointment{selectedPatient.appointmentCount !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="messages-container">
              {messages.length === 0 ? (
                <div className="no-messages">
                  <div className="no-messages-icon">💬</div>
                  <h3 className="no-messages-title">Start the conversation</h3>
                  <p className="no-messages-text">
                    Send a message to {selectedPatient.firstName} to begin your secure conversation.
                  </p>
                </div>
              ) : (
                <div className="messages-list">
                  {messages.map((message, index) => {
                    const isDoctor = message.user?.id === doctorInfo._id;
                    const isConsecutive = index > 0 && 
                      messages[index - 1].user?.id === message.user?.id &&
                      (new Date(message.created_at) - new Date(messages[index - 1].created_at)) < 60000;
                    
                    return (
                      <div
                        key={message.id}
                        className={`message ${isDoctor ? 'doctor-message' : 'patient-message'} ${isConsecutive ? 'consecutive' : ''}`}
                      >
                        {!isConsecutive && (
                          <div className="message-avatar">
                            {isDoctor ? (
                              <div className="avatar-initials doctor-avatar">
                                {getDoctorInitials()}
                              </div>
                            ) : (
                              selectedPatient.profilePicture ? (
                                <img src={selectedPatient.profilePicture} alt={selectedPatient.firstName} />
                              ) : (
                                <div className="avatar-initials">{getPatientInitials(selectedPatient)}</div>
                              )
                            )}
                          </div>
                        )}
                        <div className="message-content">
                          {!isConsecutive && (
                            <div className="message-header">
                              <span className="message-sender">
                                {isDoctor ? `Dr. ${doctorInfo.firstName} ${doctorInfo.lastName}` : `${selectedPatient.firstName} ${selectedPatient.lastName}`}
                              </span>
                              <span className="message-time">
                                {formatMessageTime(message.created_at)}
                              </span>
                            </div>
                          )}
                          <div className="message-text">
                            {message.text}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Message Input */}
            <div className="message-input-container">
              <div className="message-input-wrapper">
                <textarea
                  ref={messageInputRef}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={`Message ${selectedPatient.firstName}...`}
                  className="message-input"
                  rows="1"
                  disabled={sending}
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || sending}
                  className="send-button"
                  style={{ backgroundColor: theme?.primaryColor || '#4CAF50' }}
                >
                  {sending ? '⏳' : '📤'}
                </button>
              </div>
              <div className="message-input-hint">
                Press Enter to send, Shift+Enter for new line
              </div>
            </div>
          </>
        ) : (
          <div className="no-chat-selected">
            <div className="no-chat-icon">💬</div>
            <h3 className="no-chat-title">Select a patient to start messaging</h3>
            <p className="no-chat-text">
              Choose a patient from the list to begin a secure conversation through {platformName}.
            </p>
          </div>
        )}
      </div>
    </div>
  </FeatureWrapper>
);
};

export default DoctorMessages;