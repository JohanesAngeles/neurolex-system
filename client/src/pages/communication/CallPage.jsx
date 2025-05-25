// client/src/pages/CallPage.jsx
import React from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import VideoCall from '../../components/comunnication/VideoCall';
import '../../styles/components/communication/CallPage.css';

const CallPage = () => {
  const { callId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Get state passed from navigation
  const { callData, isIncoming, autoJoin } = location.state || {};
  
  // Extract recipient ID from call data or default to URL param
  const recipientId = callData?.caller?.id || '';
  
  // Handle back navigation
  const handleBack = () => {
    navigate(-1);
  };

  return (
    <div className="call-page">
      <div className="call-page-header">
        <button className="back-button" onClick={handleBack}>
          ← Back
        </button>
        <h2>{isIncoming ? 'Incoming Call' : 'Make a Call'}</h2>
      </div>
      
      <div className="call-container">
        <VideoCall 
          channelName={callId}
          recipientId={recipientId}
          isIncoming={isIncoming}
          autoJoin={autoJoin}
        />
      </div>
    </div>
  );
};

export default CallPage;