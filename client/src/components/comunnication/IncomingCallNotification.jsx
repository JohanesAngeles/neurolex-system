// client/src/components/communication/IncomingCallNotification.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import notificationService from '../../services/notificationService';
import '../../styles/components/communication/IncomingCall.css';

const IncomingCallNotification = ({ callData, onAccept, onDecline, autoCloseTime = 30000 }) => {
  const [remainingTime, setRemainingTime] = useState(autoCloseTime / 1000);
  const navigate = useNavigate();
  
  // Get caller info
  const caller = callData?.caller || {};
  const callType = callData?.callType || 'video';
  const callId = callData?.callId;
  
  // Handle declining the call (wrapped in useCallback to use as dependency)
  const handleDecline = useCallback(() => {
    // 1. Update call status
    if (callId) {
      notificationService.updateCallStatus(callId, 'declined', caller.id);
    }
    
    // 2. Trigger parent callback
    if (onDecline) {
      onDecline(callData);
    }
  }, [callId, caller.id, callData, onDecline]);
  
  // Timer to auto-decline after timeout
  useEffect(() => {
    if (!callData) return;
    
    // Set up countdown timer
    const intervalId = setInterval(() => {
      setRemainingTime(prev => {
        if (prev <= 1) {
          clearInterval(intervalId);
          handleDecline();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    // Auto-decline when timeout expires
    const timeoutId = setTimeout(() => {
      handleDecline();
    }, autoCloseTime);
    
    // Join call room for updates
    if (callId) {
      notificationService.joinCallRoom(callId);
    }
    
    // Cleanup
    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
      if (callId) {
        notificationService.leaveCallRoom(callId);
      }
    };
  }, [callId, handleDecline, autoCloseTime, callData]);
  
  // Handle accepting the call
  const handleAccept = () => {
    // 1. Update call status
    if (callId) {
      notificationService.updateCallStatus(callId, 'accepted', caller.id);
    }
    
    // 2. Trigger parent callback
    if (onAccept) {
      onAccept(callData);
    } else {
      // 3. Or navigate to the call page
      navigate(`/call/${callId}`, { 
        state: { 
          callData, 
          isIncoming: true, 
          autoJoin: true 
        } 
      });
    }
  };
  
  // Don't render if no call data
  if (!callData || !callId) {
    return null;
  }
  
  return (
    <div className="incoming-call-overlay">
      <div className="incoming-call-container">
        <div className="caller-info">
          {caller.profilePicture ? (
            <img 
              src={caller.profilePicture} 
              alt={caller.name || 'Caller'} 
              className="caller-avatar"
            />
          ) : (
            <div className="default-avatar">
              {(caller.name || 'User').charAt(0).toUpperCase()}
            </div>
          )}
          <h3>{caller.name || 'Someone'} is calling...</h3>
          <p className="call-type">{callType === 'video' ? 'Video Call' : 'Audio Call'}</p>
          <p className="timer">Auto-decline in {remainingTime}s</p>
        </div>
        
        <div className="call-actions">
          <button 
            className="decline-button" 
            onClick={handleDecline}
            aria-label="Decline call"
          >
            Decline
          </button>
          <button 
            className="accept-button" 
            onClick={handleAccept}
            aria-label="Accept call"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallNotification;