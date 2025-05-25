// client/src/components/communication/CommunicationHub.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import '../../styles/components/communication/CommunicationHub.css';
import { useAuth } from '../../App';
import axios from 'axios';
import userPlaceholder from '../../assets/icons/appointment_icon.svg';
import VideoCall from './VideoCall'; // Import the VideoCall component
import {
  initializeRtmClient,
  joinRtmChannel,
  leaveRtmChannel,
  logoutRtm,
  setupRtmListeners,
  removeRtmListeners,
  sendRtmMessage
} from '../../services/agoraService';

const CommunicationHub = ({
  targetUserId,
  conversationId,
  recipientName,
  recipientAvatar,
  recipientRole,
  onMessageSent
}) => {
  const [activeTab, setActiveTab] = useState('message');
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [connection, setConnection] = useState({ status: 'disconnected' });
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const rtmClientRef = useRef(null);
  const rtmChannelRef = useRef(null);
  const { user } = useAuth();
 
  console.log("CommunicationHub loaded with conversationId:", conversationId);
  console.log("targetUserId:", targetUserId);
 
  // Fetch message history when conversation changes - use the original URL parameter method
  useEffect(() => {
    const fetchMessages = async () => {
      if (!conversationId) {
        console.log("No conversationId provided, skipping message fetch");
        setIsLoading(false);
        return;
      }
     
      try {
        setIsLoading(true);
        setError(null);
       
        // Create a safe conversation ID by removing any potentially problematic characters
        const safeConversationId = conversationId.toString().replace(/[^a-fA-F0-9]/g, '');
        console.log(`Fetching messages for conversation ID (sanitized): ${safeConversationId}`);
       
        // Try with direct axios without using interceptors
        const response = await axios({
          method: 'get',
          url: `http://localhost:5000/api/conversations/${safeConversationId}/messages`,
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        });
       
        console.log('Raw response:', response);
       
        if (response.data && response.data.success) {
          console.log(`Successfully fetched ${response.data.messages.length} messages`);
          setMessages(response.data.messages);
        } else {
          console.warn('Response was not successful:', response.data);
          setError('Failed to fetch messages');
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
        console.error('Error details:', error.response?.data || error.message);
        setError(`Error: ${error.response?.data?.message || 'Failed to load messages'}`);
      } finally {
        setIsLoading(false);
      }
    };
   
    fetchMessages();
   
    // Mark conversation as read when opened
    const markAsRead = async () => {
      if (!conversationId) return;
     
      try {
        console.log(`Marking conversation as read: ${conversationId}`);
       
        // Create a safe conversation ID
        const safeConversationId = conversationId.toString().replace(/[^a-fA-F0-9]/g, '');
       
        // Direct axios call
        await axios({
          method: 'put',
          url: `http://localhost:5000/api/conversations/${safeConversationId}/read`,
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          data: {}
        });
       
        console.log('Conversation marked as read successfully');
      } catch (error) {
        console.error('Error marking conversation as read:', error);
        console.error('Error details:', error.response?.data || error.message);
      }
    };
   
    markAsRead();
  }, [conversationId]);

  // Handle RTM channel message
  const handleChannelMessage = useCallback((message, senderId) => {
    console.log(`New channel message from ${senderId}:`, message.text);
    
    // Only process messages from the target user in this conversation
    if (senderId === targetUserId.toString()) {
      const newMessage = {
        _id: 'rtm-' + Date.now(),
        senderId: senderId,
        recipientId: user?.id || user?._id,
        content: message.text,
        timestamp: new Date().toISOString(),
        status: 'delivered'
      };
      
      setMessages(prev => [...prev, newMessage]);
    }
  }, [targetUserId, user]);

  // Handle RTM connection state change
  const handleConnectionStateChange = useCallback((newState, reason) => {
    console.log(`RTM connection state changed to ${newState}, reason: ${reason}`);
    
    switch (newState) {
      case 'CONNECTED':
        setConnection({ status: 'connected' });
        break;
      case 'CONNECTING':
        setConnection({ status: 'connecting' });
        break;
      case 'DISCONNECTED':
      case 'ABORTED':
        setConnection({ status: 'disconnected' });
        break;
      default:
        setConnection({ status: 'error', message: reason });
    }
  }, []);

  // Handle peer-to-peer messages
  const handleMessageFromPeer = useCallback((message, peerId) => {
    console.log(`New P2P message from ${peerId}:`, message.text);
    
    // Only process messages from the target user in this conversation
    if (peerId === targetUserId.toString()) {
      const newMessage = {
        _id: 'rtm-' + Date.now(),
        senderId: peerId,
        recipientId: user?.id || user?._id,
        content: message.text,
        timestamp: new Date().toISOString(),
        status: 'delivered'
      };
      
      setMessages(prev => [...prev, newMessage]);
    }
  }, [targetUserId, user]);
 
  // Setup Agora RTM for messaging
  useEffect(() => {
    const initializeAgoraRTM = async () => {
      if (!targetUserId || !user || !conversationId) return;
     
      try {
        setConnection({ status: 'connecting' });
        
        // 1. Initialize Agora RTM client
        const rtmClient = await initializeRtmClient();
        rtmClientRef.current = rtmClient;
        
        // 2. Create and join RTM channel using conversation ID as channel name
        const channelName = `conversation_${conversationId.toString()}`;
        const rtmChannel = await joinRtmChannel(channelName);
        rtmChannelRef.current = rtmChannel;
        
        // 3. Set up message listeners
        setupRtmListeners(rtmClient, rtmChannel, {
          onChannelMessage: handleChannelMessage,
          onMessageFromPeer: handleMessageFromPeer,
          onConnectionStateChanged: handleConnectionStateChange
        });
        
        // Update connection status
        setConnection({ status: 'connected' });
        console.log('RTM setup complete');
        
      } catch (error) {
        console.error('Error connecting to Agora RTM:', error);
        setConnection({ status: 'error', message: error.message });
      }
    };
   
    initializeAgoraRTM();
   
    // Cleanup function
    return () => {
      const cleanup = async () => {
        try {
          // Remove event listeners
          if (rtmClientRef.current && rtmChannelRef.current) {
            removeRtmListeners(rtmClientRef.current, rtmChannelRef.current);
          }
          
          // Leave RTM channel
          await leaveRtmChannel();
          
          // Logout from RTM client
          await logoutRtm();
          
          rtmChannelRef.current = null;
          rtmClientRef.current = null;
          
          console.log('RTM cleanup complete');
        } catch (error) {
          console.error('Error during RTM cleanup:', error);
        }
      };
      
      cleanup();
    };
  }, [targetUserId, user, conversationId, handleChannelMessage, handleMessageFromPeer, handleConnectionStateChange]);
 
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
 
  // Format timestamp to readable time
  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
 
  // Send message function
  const sendMessage = async (e) => {
    e.preventDefault();
   
    if (!inputMessage.trim() || !conversationId || connection.status !== 'connected') {
      return;
    }
   
    try {
      // Create message object
      const newMessage = {
        _id: 'temp-' + Date.now(), // Temporary ID until server assigns real one
        senderId: user.id || user._id,
        recipientId: targetUserId,
        content: inputMessage,
        timestamp: new Date().toISOString(),
        status: 'sending'
      };
     
      // Add to UI immediately for better UX
      setMessages(prev => [...prev, newMessage]);
      setInputMessage('');
     
      // Create a safe conversation ID
      const safeConversationId = conversationId.toString().replace(/[^a-fA-F0-9]/g, '');
      console.log(`Sending message to conversation ID (sanitized): ${safeConversationId}`);
     
      // 1. Send to server for persistent storage
      const response = await axios({
        method: 'post',
        url: `http://localhost:5000/api/conversations/${safeConversationId}/messages`,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        data: { content: inputMessage }
      });
      
      // 2. Also send via RTM for real-time delivery
      if (rtmChannelRef.current) {
        // Send as channel message
        await sendRtmMessage(inputMessage);
      } else {
        // Fall back to peer-to-peer if no channel
        await sendRtmMessage(inputMessage, targetUserId.toString());
      }
     
      if (response.data && response.data.success) {
        console.log('Message sent successfully:', response.data.message);
       
        // Update message with server data (real ID, confirmed status, etc.)
        setMessages(prev => prev.map(msg =>
          msg._id === newMessage._id ? response.data.message : msg
        ));
       
        // Call the callback function if provided
        if (typeof onMessageSent === 'function') {
          onMessageSent(response.data.message);
        }
      } else {
        console.warn('Message sending response was not successful:', response.data);
        // Mark message as failed
        setMessages(prev => prev.map(msg =>
          msg._id === newMessage._id ? { ...msg, status: 'failed' } : msg
        ));
      }
    } catch (error) {
      console.error('Error sending message:', error);
      console.error('Error details:', error.response?.data || error.message);
     
      // Mark message as failed
      setMessages(prev => prev.map(msg =>
        msg._id === 'temp-' + Date.now() ? { ...msg, status: 'failed' } : msg
      ));
    }
  };
 
  // Start video call function
  const startVideoCall = async () => {
    try {
      setActiveTab('call');
      console.log('Starting video call with:', targetUserId);
      console.log('Using conversation ID as channel name:', conversationId);
      
      // We don't need to do anything else here, as the VideoCall component
      // will handle the connection when it mounts
    } catch (error) {
      console.error('Error starting video call:', error);
    }
  };
 
  // Retry sending failed message
  const retryMessage = async (messageId) => {
    const failedMessage = messages.find(msg => msg._id === messageId);
    if (!failedMessage) return;
   
    try {
      // Update UI state
      setMessages(prev => prev.map(msg =>
        msg._id === messageId ? { ...msg, status: 'sending' } : msg
      ));
     
      // Create a safe conversation ID
      const safeConversationId = conversationId.toString().replace(/[^a-fA-F0-9]/g, '');
      console.log(`Retrying message in conversation ID (sanitized): ${safeConversationId}`);
     
      // Send to server
      const response = await axios({
        method: 'post',
        url: `http://localhost:5000/api/conversations/${safeConversationId}/messages`,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        data: { content: failedMessage.content }
      });
      
      // Also retry sending via RTM
      if (rtmChannelRef.current) {
        await sendRtmMessage(failedMessage.content);
      } else {
        await sendRtmMessage(failedMessage.content, targetUserId.toString());
      }
     
      if (response.data && response.data.success) {
        console.log('Message retry successful:', response.data.message);
       
        // Update message with server data
        setMessages(prev => prev.map(msg =>
          msg._id === messageId ? response.data.message : msg
        ));
      } else {
        console.warn('Message retry response was not successful:', response.data);
        // Keep as failed
        setMessages(prev => prev.map(msg =>
          msg._id === messageId ? { ...msg, status: 'failed' } : msg
        ));
      }
    } catch (error) {
      console.error('Error retrying message:', error);
      console.error('Error details:', error.response?.data || error.message);
     
      // Keep as failed
      setMessages(prev => prev.map(msg =>
        msg._id === messageId ? { ...msg, status: 'failed' } : msg
      ));
    }
  };
 
  return (
    <div className="communication-hub">
      <div className="hub-header">
        <div className="recipient-info">
          <div className="recipient-avatar">
            {recipientAvatar ? (
              <img
                src={recipientAvatar}
                alt={recipientName}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = userPlaceholder;
                }}
              />
            ) : (
              <div className="avatar-placeholder">{recipientName?.charAt(0)}</div>
            )}
          </div>
          <div className="recipient-details">
            <h3>{recipientName || 'Contact'}</h3>
            {recipientRole && <span className="recipient-role">{recipientRole}</span>}
            <span className={`connection-status ${connection.status}`}>
              {connection.status === 'connected' ? 'Connected' :
               connection.status === 'connecting' ? 'Connecting...' :
               connection.status === 'error' ? 'Connection error' :
               'Disconnected'}
            </span>
          </div>
        </div>
       
        <div className="hub-actions">
          <div className="tabs">
            <button
              className={`tab ${activeTab === 'message' ? 'active' : ''}`}
              onClick={() => setActiveTab('message')}
            >
              Messages
            </button>
            <button
              className={`tab ${activeTab === 'call' ? 'active' : ''}`}
              onClick={startVideoCall}
            >
              Video Call
            </button>
          </div>
        </div>
      </div>
     
      <div className="hub-content">
        {activeTab === 'message' && (
          <div className="messaging-container">
            {isLoading ? (
              <div className="messages-loading">Loading messages...</div>
            ) : error ? (
              <div className="messages-error">
                <p>{error}</p>
                <p className="conversation-debug">
                  Conversation ID: {conversationId}
                </p>
              </div>
            ) : (
              <>
                <div className="messages-area">
                  {messages.length === 0 ? (
                    <div className="empty-messages">
                      <p>No messages yet</p>
                      <p>Start the conversation by sending a message</p>
                    </div>
                  ) : (
                    <div className="message-list">
                      {messages.map(message => {
                        const isCurrentUser = (message.senderId === (user.id || user._id));
                       
                        return (
                          <div
                            key={message._id}
                            className={`message ${isCurrentUser ? 'outgoing' : 'incoming'}`}
                          >
                            {!isCurrentUser && (
                              <div className="message-avatar">
                                {recipientAvatar ? (
                                  <img
                                    src={recipientAvatar}
                                    alt={recipientName}
                                    onError={(e) => {
                                      e.target.onerror = null;
                                      e.target.src = userPlaceholder;
                                    }}
                                  />
                                ) : (
                                  <div className="avatar-placeholder-small">{recipientName?.charAt(0)}</div>
                                )}
                              </div>
                            )}
                           
                            <div className="message-content">
                              <div className="message-text">{message.content}</div>
                              <div className="message-info">
                                <span className="message-time">
                                  {formatMessageTime(message.timestamp)}
                                </span>
                                {isCurrentUser && (
                                  <span className="message-status">
                                    {message.status === 'sending' ? 'Sending...' :
                                     message.status === 'failed' ? (
                                       <button
                                         onClick={() => retryMessage(message._id)}
                                         className="retry-button"
                                       >
                                         Failed - Retry
                                       </button>
                                     ) :
                                     message.status === 'delivered' ? 'Delivered' :
                                     message.status === 'read' ? 'Read' : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>
               
                <form onSubmit={sendMessage} className="message-input-form">
                  <input
                    type="text"
                    placeholder={connection.status === 'connected' ?
                      "Type a message..." : "Connecting..."}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    disabled={connection.status !== 'connected'}
                  />
                  <button
                    type="submit"
                    disabled={!inputMessage.trim() || connection.status !== 'connected'}
                  >
                    Send
                  </button>
                </form>
              </>
            )}
          </div>
        )}
       
        {activeTab === 'call' && (
          <VideoCall 
            channelName={conversationId.toString()} 
            userId={user?.id || user?._id || Date.now().toString()}
          />
        )}
      </div>
    </div>
  );
};

export default CommunicationHub;