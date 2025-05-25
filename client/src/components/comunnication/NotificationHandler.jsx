// client/src/components/NotificationHandler.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSocket } from '../../services/socketService';
import IncomingCallNotification from './IncomingCallNotification';

/**
 * NotificationHandler - Global component to handle real-time notifications
 * This should be placed in your app's main layout component
 */
const NotificationHandler = () => {
  const [callData, setCallData] = useState(null);
  // Store notifications for future display functionality
  const [, setNotifications] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const socket = getSocket();
    
    if (!socket) {
      console.warn('No socket connection available for notifications');
      return;
    }
    
    // Listen for incoming calls
    socket.on('incomingCall', (data) => {
      console.log('Incoming call notification received:', data);
      setCallData(data.callData);
      
      // Add the notification to the list
      if (data.notification) {
        setNotifications(prev => [data.notification, ...prev].slice(0, 10));
      }
    });
    
    // Listen for regular notifications
    socket.on('notification', (data) => {
      console.log('Notification received:', data);
      if (data.notification) {
        setNotifications(prev => [data.notification, ...prev].slice(0, 10));
      }
    });
    
    // Clean up listeners on unmount
    return () => {
      if (socket) {
        socket.off('incomingCall');
        socket.off('notification');
      }
    };
  }, []);
  
  // Handle accepting a call
  const handleAcceptCall = (callData) => {
    // Navigate to call page
    navigate(`/call/${callData.callId}`, { 
      state: { 
        callData,
        isIncoming: true,
        autoJoin: true
      }
    });
    
    // Clear the call data
    setCallData(null);
  };
  
  // Handle declining a call
  const handleDeclineCall = () => {
    setCallData(null);
  };

  return (
    <>
      {/* Incoming call notification overlay */}
      {callData && (
        <IncomingCallNotification
          callData={callData}
          onAccept={handleAcceptCall}
          onDecline={handleDeclineCall}
        />
      )}
      
      {/* You could add a notification display component here */}
      {/* Example:
      {notifications.length > 0 && (
        <NotificationList 
          notifications={notifications}
          onMarkAsRead={(id) => {
            // Handle marking notifications as read
          }}
        />
      )}
      */}
    </>
  );
};

export default NotificationHandler;