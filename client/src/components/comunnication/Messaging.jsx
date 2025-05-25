// client/src/components/dashboard/Messages.jsx
import React, { useState, useEffect } from 'react';
import CommunicationHub from '../comunnication/CommunicationHub'; // Fixed typo in path
import { useAuth } from '../../App';
import '../../styles/components/communication/Messaging.css';
import conversationService from '../../services/conversationService';

// Import placeholder user avatar for fallback
import userPlaceholder from '../../assets/icons/appointment_icon.svg';

const Messages = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [error, setError] = useState(null);
  const { user } = useAuth();

  // Fetch conversations when component mounts
  useEffect(() => {
    const fetchConversations = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        const response = await conversationService.getConversations();

        if (response && response.success) {
          console.log(`Fetched ${response.conversations.length} conversations`);
          setConversations(response.conversations);
          
          // Select first conversation by default if available
          if (response.conversations.length > 0) {
            setSelectedConversation(response.conversations[0]);
          }
        } else {
          console.warn('Failed to fetch conversations:', response);
        }
      } catch (error) {
        console.error('Error fetching conversations:', error);
        // Handle error appropriately (e.g., show error message)
      } finally {
        setIsLoading(false);
      }
    };

    fetchConversations();
  }, [user]);

  // Filter conversations based on search term
  const filteredConversations = conversations.filter(conv => 
    conv.recipientName && conv.recipientName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter available users based on search term - with safety checks
  const filteredUsers = availableUsers.filter(user => 
    user && user.firstName && user.lastName && 
    `${user.firstName} ${user.lastName}`.toLowerCase().includes(userSearchTerm.toLowerCase())
  );

  // Format timestamp to readable format
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      // Today: show time
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      // Yesterday
      return 'Yesterday';
    } else if (diffDays < 7) {
      // This week: show day name
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      // Older: show date
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  // Handle conversation selection
  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
    
    // Mark conversation as read when selected
    if (conversation.unreadCount > 0) {
      markConversationAsRead(conversation.id);
    }
  };

  // Mark conversation as read
  const markConversationAsRead = async (conversationId) => {
    try {
      await conversationService.markAsRead(conversationId);
      
      // Update local state to reflect read status
      setConversations(prev => prev.map(conv => 
        conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
      ));
    } catch (error) {
      console.error('Error marking conversation as read:', error);
    }
  };

  // Open new message modal with improved error handling
  const handleNewMessage = async () => {
    setShowNewMessageModal(true);
    setUsersLoading(true);
    setUserSearchTerm('');
    setError(null); // Clear any previous errors
    
    try {
      console.log('Fetching available users...');
      const token = localStorage.getItem('token');
      console.log('Auth token available:', !!token);
      
      const response = await conversationService.getUsers();
      console.log('User response:', response);
      
      if (response && response.success) {
        console.log(`Found ${response.users.length} users`); 
        setAvailableUsers(response.users);
        
        if (response.users.length === 0) {
          setError('No other users found in the system.');
        }
      } else {
        setError('Failed to retrieve users. Please try again.');
        console.warn('Response not successful:', response);
      }
    } catch (error) {
      setError(`Error: ${error.response?.data?.message || error.message || 'Failed to load users'}`);
      console.error('Error fetching users:', error);
      console.error('Error details:', error.response?.data || error.message);
    } finally {
      setUsersLoading(false);
    }
  };

  // Start a new conversation with a user
  const startConversation = async (userId) => {
    if (!userId) {
      console.error('No user ID provided');
      return;
    }
    
    try {
      console.log(`Starting conversation with user ID: ${userId}`);
      const response = await conversationService.createOrGetConversation(userId);
      
      if (response && response.success) {
        console.log('Conversation created/fetched:', response.conversation);
        // Check if this conversation already exists in our list
        const existingConvIndex = conversations.findIndex(
          conv => conv.id === response.conversation.id
        );
        
        if (existingConvIndex === -1) {
          // New conversation - add to list
          setConversations(prev => [response.conversation, ...prev]);
        }
        
        // Select this conversation
        setSelectedConversation(response.conversation);
        setShowNewMessageModal(false);
      } else {
        console.warn('Failed to create conversation:', response);
        setError('Failed to start conversation. Please try again.');
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
      setError(`Error: ${error.response?.data?.message || error.message || 'Failed to start conversation'}`);
    }
  };

  return (
    <div className="inner-page">
      <div className="inner-page-content messages-page">
        <div className="messages-header">
          <h1>Messages</h1>
          <p className="subtitle">Connect with your healthcare professionals and support network</p>
        </div>
        
        <div className="messages-layout">
          {/* Conversations Sidebar */}
          <div className="conversations-sidebar">
            <div className="conversations-header">
              <div className="search-container">
                <input 
                  type="text" 
                  placeholder="Search conversations..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>
              <button className="new-message-btn" onClick={handleNewMessage}>
                New Message
              </button>
            </div>
            
            <div className="conversations-list">
              {isLoading ? (
                <div className="loading-state">Loading conversations...</div>
              ) : filteredConversations.length === 0 ? (
                <div className="empty-state">
                  <p>No conversations found</p>
                  {searchTerm ? (
                    <p>Try a different search term</p>
                  ) : (
                    <button className="start-conversation-btn" onClick={handleNewMessage}>
                      Start a new conversation
                    </button>
                  )}
                </div>
              ) : (
                filteredConversations.map(conversation => (
                  <div 
                    key={conversation.id} 
                    className={`conversation-item ${selectedConversation && 
                      selectedConversation.id === conversation.id ? 'selected' : ''}`}
                    onClick={() => handleSelectConversation(conversation)}
                  >
                    <div className="avatar-container">
                      {conversation.recipientAvatar ? (
                        <img 
                          src={conversation.recipientAvatar} 
                          alt={conversation.recipientName} 
                          className="avatar"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = userPlaceholder;
                          }}
                        />
                      ) : (
                        <div className="avatar-placeholder">
                          {conversation.recipientName.charAt(0)}
                        </div>
                      )}
                      {conversation.unreadCount > 0 && (
                        <span className="unread-badge">{conversation.unreadCount}</span>
                      )}
                      {conversation.isOnline && <span className="online-indicator"></span>}
                    </div>
                    
                    <div className="conversation-details">
                      <div className="conversation-header">
                        <span className="recipient-name">{conversation.recipientName}</span>
                        <span className="timestamp">{formatTime(conversation.lastMessageTime)}</span>
                      </div>
                      <div className="last-message">
                        {conversation.lastMessage && conversation.lastMessage.length > 40 
                          ? `${conversation.lastMessage.substring(0, 40)}...` 
                          : conversation.lastMessage || 'No messages yet'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
          {/* Communication Area */}
          <div className="communication-area">
            {selectedConversation ? (
              <CommunicationHub 
                targetUserId={selectedConversation.recipientId} 
                conversationId={selectedConversation.id}
                recipientName={selectedConversation.recipientName}
                recipientAvatar={selectedConversation.recipientAvatar}
                recipientRole={selectedConversation.recipientRole}
                onMessageSent={(message) => {
                  // Update conversation list to show latest message
                  setConversations(prev => prev.map(conv => 
                    conv.id === selectedConversation.id 
                      ? { 
                          ...conv, 
                          lastMessage: message.content,
                          lastMessageTime: message.timestamp
                        } 
                      : conv
                  ));
                }}
              />
            ) : (
              <div className="empty-communication">
                <div className="empty-state-message">
                  <h3>No conversation selected</h3>
                  <p>Select a conversation from the sidebar or start a new one</p>
                  <button className="start-conversation-btn" onClick={handleNewMessage}>
                    Start a new conversation
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Message Modal */}
      {showNewMessageModal && (
        <div className="modal-overlay">
          <div className="new-message-modal">
            <div className="modal-header">
              <h3>New Message</h3>
              <button 
                className="close-modal-btn"
                onClick={() => setShowNewMessageModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-content">
              <div className="user-search">
                <input 
                  type="text"
                  placeholder="Search for a user..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="user-search-input"
                />
              </div>
              
              <div className="users-list">
                {usersLoading ? (
                  <div className="loading-state">Loading users...</div>
                ) : error ? (
                  <div className="error-state">
                    <p>{error}</p>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="empty-state">
                    <p>No users found</p>
                    {userSearchTerm ? (
                      <p>Try a different search term</p>
                    ) : (
                      <p>No other users are registered in the system</p>
                    )}
                  </div>
                ) : (
                  filteredUsers.map(user => (
                    <div 
                      key={user._id} 
                      className="user-item"
                      onClick={() => startConversation(user._id)}
                    >
                      <div className="user-avatar">
                        {user.profilePicture ? (
                          <img 
                            src={user.profilePicture} 
                            alt={`${user.firstName} ${user.lastName}`} 
                            className="avatar"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = userPlaceholder;
                            }}
                          />
                        ) : (
                          <div className="avatar-placeholder">
                            {user.firstName.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="user-details">
                        <div className="user-name">{user.firstName} {user.lastName}</div>
                        <div className="user-email">{user.email}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Messages;