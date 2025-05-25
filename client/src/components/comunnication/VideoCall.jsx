// client/src/components/communication/VideoCall.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { getRtcToken } from '../../services/agoraService';
import notificationService from '../../services/notificationService';
import '../../styles/components/communication/VideoCall.css';

// Updated hardcoded credentials with the new token from Agora console
const HARDCODED_CHANNEL = 'test';
const HARDCODED_TOKEN = '007eJxTYFiY8e3tMt6GoE25Fw/yOZ9j9Cper+TOxX6zT6y76cmdQ00KDKZmiQYmpqlJFgYmKSbGKRaJhobJZikmFpYmqZZJhoam1yu5MhoCGRk0z9uwMjIwMrAAMYjPBCaZwSQLlCxJLS5hYAAAcSMhPw==';
const HARDCODED_APPID = '56a045eb804d43d8a11c6d4894e9b115';

const VideoCall = ({ channelName = HARDCODED_CHANNEL, userId, recipientId, isIncoming = false, autoJoin = false }) => {
  const [localVideoTrack, setLocalVideoTrack] = useState(null);
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [connectionState, setConnectionState] = useState('DISCONNECTED');
  const [useHardcoded, setUseHardcoded] = useState(true); // Default to using hardcoded token for testing
  const [callState, setCallState] = useState(isIncoming ? 'RINGING' : 'IDLE'); // 'IDLE', 'CALLING', 'RINGING', 'CONNECTED'
  
  const localVideoRef = useRef(null);
  const clientRef = useRef(null);
  
  // Handle remote user published media
  const handleUserPublished = useCallback(async (user, mediaType) => {
    console.log('Remote user published:', user.uid, mediaType);
    if (!clientRef.current) return;
    
    try {
      await clientRef.current.subscribe(user, mediaType);
      console.log(`Subscribed to ${mediaType} track of user:`, user.uid);
      
      if (mediaType === 'video') {
        setRemoteUsers(prev => {
          const exists = prev.find(u => u.uid === user.uid);
          if (exists) {
            return prev.map(u => u.uid === user.uid ? { ...u, videoTrack: user.videoTrack } : u);
          } else {
            return [...prev, { uid: user.uid, videoTrack: user.videoTrack, audioTrack: null }];
          }
        });
      }
      
      if (mediaType === 'audio') {
        user.audioTrack?.play();
        setRemoteUsers(prev => {
          const exists = prev.find(u => u.uid === user.uid);
          if (exists) {
            return prev.map(u => u.uid === user.uid ? { ...u, audioTrack: user.audioTrack } : u);
          } else {
            return [...prev, { uid: user.uid, videoTrack: null, audioTrack: user.audioTrack }];
          }
        });
      }
      
      // When we detect a remote user joining with media, change call state to CONNECTED
      setCallState('CONNECTED');
    } catch (error) {
      console.error(`Error subscribing to ${mediaType}:`, error);
    }
  }, []);

  // Handle remote user unpublished media
  const handleUserUnpublished = useCallback((user, mediaType) => {
    console.log('Remote user unpublished:', user.uid, mediaType);
    if (mediaType === 'video') {
      setRemoteUsers(prev =>
        prev.map(u => u.uid === user.uid ? { ...u, videoTrack: null } : u)
      );
    }
    if (mediaType === 'audio') {
      setRemoteUsers(prev =>
        prev.map(u => u.uid === user.uid ? { ...u, audioTrack: null } : u)
      );
    }
  }, []);

  // Handle remote user left
  const handleUserLeft = useCallback((user) => {
    console.log('Remote user left:', user.uid);
    setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
    
    // If all remote users left, go back to IDLE state
    if (remoteUsers.length <= 1) {
      setCallState('IDLE');
    }
  }, [remoteUsers.length]);

  // Handle connection state changes
  const handleConnectionStateChange = useCallback((curState, prevState, reason) => {
    console.log(`RTC connection state changed from ${prevState} to ${curState}, reason: ${reason}`);
    setConnectionState(curState);
    
    if (curState === 'DISCONNECTED') {
      setJoined(false);
      setRemoteUsers([]);
      setCallState('IDLE');
    }
  }, []);

  // Create local tracks with improved fallback handling
  const createLocalTracks = useCallback(async () => {
    try {
      // Get available devices
      const devices = await AgoraRTC.getDevices();
      const hasVideoDevices = devices.some(device => device.kind === 'videoinput');
      const hasAudioDevices = devices.some(device => device.kind === 'audioinput');
      
      console.log('Available devices:', {
        video: hasVideoDevices,
        audio: hasAudioDevices
      });
      
      // Audio-only mode if no camera is available
      if (!hasVideoDevices && hasAudioDevices) {
        console.log("No camera detected. Creating audio-only track");
        try {
          const audioTrack = await AgoraRTC.createMicrophoneAudioTrack({ 
            encoderConfig: 'music_standard' 
          });
          console.log("Audio track created successfully");
          return { audioTrack, videoTrack: null };
        } catch (error) {
          console.error("Failed to create audio track:", error);
          throw error;
        }
      } 
      
      // If both devices are available, try to create both tracks
      else if (hasVideoDevices && hasAudioDevices) {
        try {
          console.log("Creating both camera and microphone tracks");
          const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
            { encoderConfig: 'music_standard' },
            { encoderConfig: 'standard' }
          );
          return { audioTrack, videoTrack };
        } catch (error) {
          console.warn("Failed to create both tracks, trying individual creation:", error);
          // Fall through to individual creation
        }
        
        // Try individual creation as fallback
        let audioTrack = null;
        let videoTrack = null;
        
        if (hasAudioDevices) {
          try {
            console.log("Creating microphone track only");
            audioTrack = await AgoraRTC.createMicrophoneAudioTrack({ 
              encoderConfig: 'music_standard' 
            });
            console.log("Audio track created successfully");
          } catch (audioError) {
            console.error("Failed to create audio track:", audioError);
          }
        }
        
        if (hasVideoDevices) {
          try {
            console.log("Creating camera track only");
            videoTrack = await AgoraRTC.createCameraVideoTrack({ 
              encoderConfig: 'standard' 
            });
            console.log("Video track created successfully");
          } catch (videoError) {
            console.error("Failed to create video track:", videoError);
          }
        }
        
        if (audioTrack || videoTrack) {
          return { audioTrack, videoTrack };
        }
      }
      
      // No usable devices
      throw new Error("No usable audio or video devices found. Please check your device connections and browser permissions.");
      
    } catch (error) {
      console.error("Error creating local tracks:", error);
      throw error;
    }
  }, []);

  // Check device availability before joining
  const checkDeviceAvailability = useCallback(async () => {
    try {
      const devices = await AgoraRTC.getDevices();
      const hasVideoDevices = devices.some(device => device.kind === 'videoinput');
      const hasAudioDevices = devices.some(device => device.kind === 'audioinput');
      
      console.log('Available devices:', {
        video: hasVideoDevices,
        audio: hasAudioDevices
      });
      
      if (!hasVideoDevices && !hasAudioDevices) {
        throw new Error('No camera or microphone detected. Please check your device connections and browser permissions.');
      }
      
      return {
        hasVideo: hasVideoDevices,
        hasAudio: hasAudioDevices
      };
    } catch (error) {
      console.error('Error checking devices:', error);
      throw error;
    }
  }, []);
  
  // Attempt to join with the hardcoded token (more reliable for testing)
  const joinWithHardcodedToken = useCallback(async () => {
    if (connectionState === 'CONNECTING' || connectionState === 'CONNECTED') {
      console.log("Already in connecting/connected state, not joining again");
      setError("Already trying to connect or connected");
      return;
    }
    
    if (!clientRef.current) {
      console.error("Cannot join call: missing client");
      setError("Cannot join: missing client");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // First, clear any existing connections
      try {
        await clientRef.current.leave();
        console.log("Left previous channel if any");
      } catch (err) {
        // Ignore errors when trying to leave
      }
      
      // Add a small delay to ensure resources are reset
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log("Using hardcoded credentials");
      console.log("App ID:", HARDCODED_APPID);
      console.log("Channel:", HARDCODED_CHANNEL);
      console.log("Token length:", HARDCODED_TOKEN.length);
      
      // Use 0 as the UID to let Agora assign one
      const numericUserId = 0;
      
      console.log("Attempting to join with hardcoded credentials");
      await clientRef.current.join(
        HARDCODED_APPID, 
        HARDCODED_CHANNEL, 
        HARDCODED_TOKEN, 
        numericUserId
      );
      
      console.log("Joined channel successfully with hardcoded credentials");
      
      // *** Important fix: Add a delay after joining to ensure connection is fully established ***
      console.log("Waiting 2 seconds to ensure connection is fully established...");
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Set joined to true immediately after successful join
      setJoined(true);
      
      // Create and publish local tracks with fallback
      try {
        console.log("Creating local tracks...");
        const { audioTrack, videoTrack } = await createLocalTracks();
        
        // Set the local tracks in state
        if (audioTrack) {
          setLocalAudioTrack(audioTrack);
          console.log("Audio track created and assigned to state");
        }
        
        if (videoTrack) {
          setLocalVideoTrack(videoTrack);
          // Play local video track
          if (localVideoRef.current) {
            videoTrack.play(localVideoRef.current);
            console.log("Playing local video track");
          }
        }
        
        // Publish available tracks
        const tracksToPublish = [];
        if (audioTrack) tracksToPublish.push(audioTrack);
        if (videoTrack) tracksToPublish.push(videoTrack);
        
        // Only try to publish if we have tracks to publish
        if (tracksToPublish.length > 0) {
          console.log("Publishing local tracks to channel:", tracksToPublish.length);
          await clientRef.current.publish(tracksToPublish);
          console.log("Local tracks published successfully");
        } else {
          console.warn("No tracks to publish");
        }
        
        // Join the call room
        notificationService.joinCallRoom(channelName);
      } catch (trackError) {
        console.error("Error with local tracks:", trackError);
        setError(`Device access error: ${trackError.message}`);
        
        // We're still joined to the channel even without media
        // so we shouldn't throw away the connection
      }
    } catch (error) {
      console.error('Error joining with hardcoded token:', error);
      setError(`Failed to join with hardcoded token: ${error.message}`);
      
      // Attempt to clean up
      try {
        await clientRef.current?.leave();
      } catch (leaveError) {
        console.warn("Could not leave channel after join failure:", leaveError);
      }
      
      setJoined(false);
    } finally {
      setIsLoading(false);
    }
  }, [connectionState, channelName, createLocalTracks]);

  // Join call with dynamically generated token
  const joinCall = useCallback(async () => {
    // Check if already joined or connecting
    if (connectionState === 'CONNECTING' || connectionState === 'CONNECTED') {
      console.log("Already in connecting/connected state, not joining again");
      setError("Already trying to connect or connected");
      return;
    }
    
    if (!clientRef.current || !channelName) {
      console.error("Cannot join call: missing client or channelName");
      setError("Cannot join: missing client or channel");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // First, clear any existing connections
      try {
        await clientRef.current.leave();
        console.log("Left previous channel if any");
      } catch (err) {
        // Ignore errors when trying to leave
      }
      
      // Add a small delay to ensure resources are reset
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log("Getting token for channel:", channelName);
      
      // Clean the channel name to only allow alphanumeric characters
      const cleanChannelName = channelName.toString().replace(/[^a-zA-Z0-9]/g, '');
      console.log("Using clean channel name:", cleanChannelName);
      
      // Get token from your server
      const { token, appId } = await getRtcToken(cleanChannelName);
      console.log("Token received, length:", token.length);
      console.log("App ID:", appId);
      
      // Ensure userId is a number for RTC
      const numericUserId = userId ? parseInt(userId, 10) : 0;
      console.log("Using numeric user ID:", numericUserId);
      
      // Join the channel
      console.log("Attempting to join channel with params:", {
        appId: appId,
        channelName: cleanChannelName,
        tokenLength: token.length,
        uid: numericUserId
      });
      
      await clientRef.current.join(appId, cleanChannelName, token, numericUserId);
      console.log("Joined channel successfully with user ID:", numericUserId);
      
      // *** Important fix: Add a delay after joining to ensure connection is fully established ***
      console.log("Waiting 2 seconds to ensure connection is fully established...");
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Set joined to true immediately after successful join
      setJoined(true);
      
      // Create and publish local tracks with fallback
      try {
        console.log("Creating local tracks...");
        const { audioTrack, videoTrack } = await createLocalTracks();
        
        // Set the local tracks in state
        if (audioTrack) {
          setLocalAudioTrack(audioTrack);
          console.log("Audio track created and assigned to state");
        }
        
        if (videoTrack) {
          setLocalVideoTrack(videoTrack);
          // Play local video track
          if (localVideoRef.current) {
            videoTrack.play(localVideoRef.current);
            console.log("Playing local video track");
          }
        }
        
        // Publish available tracks
        const tracksToPublish = [];
        if (audioTrack) tracksToPublish.push(audioTrack);
        if (videoTrack) tracksToPublish.push(videoTrack);
        
        // Only try to publish if we have tracks to publish
        if (tracksToPublish.length > 0) {
          console.log("Publishing local tracks to channel:", tracksToPublish.length);
          await clientRef.current.publish(tracksToPublish);
          console.log("Local tracks published successfully");
        } else {
          console.warn("No tracks to publish");
        }
        
        // Join the call room for real-time updates
        notificationService.joinCallRoom(cleanChannelName);
      } catch (trackError) {
        console.error("Error with local tracks:", trackError);
        setError(`Device access error: ${trackError.message}`);
        
        // We're still joined to the channel even without media
        // so we shouldn't throw away the connection
      }
    } catch (error) {
      console.error('Error joining call:', error);
      
      // More detailed error logging
      if (error.code) {
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        
        if (error.message.includes('GATEWAY_SERVER')) {
          console.error('Token validation failed. Check your AppID and Certificate.');
          setError(`Token validation failed. Try using the hardcoded test token instead.`);
        } else {
          setError(`Failed to join call: ${error.message}`);
        }
      } else {
        setError(`Unknown error joining call: ${error.message || 'No error details available'}`);
      }
      
      // Attempt to clean up on failure
      try {
        await clientRef.current?.leave();
        console.log("Left channel after join failure");
      } catch (leaveError) {
        console.warn("Could not leave channel after join failure:", leaveError);
      }
      
      setJoined(false);
    } finally {
      setIsLoading(false);
    }
  }, [channelName, userId, connectionState, createLocalTracks]);

  // Initiate a call (notify recipient)
  const initiateCall = useCallback(async () => {
    setCallState('CALLING');
    setIsLoading(true);
    
    try {
      // First, send notification to recipient through your backend
      await notificationService.sendCallNotification(
        recipientId,
        channelName,
        'video'
      );
      
      console.log('Call notification sent to recipient:', recipientId);
      
      // Now join the call
      if (useHardcoded) {
        await joinWithHardcodedToken();
      } else {
        await joinCall();
      }
      
    } catch (error) {
      console.error('Failed to initiate call:', error);
      setError(`Failed to initiate call: ${error.message}`);
      setCallState('IDLE');
    } finally {
      setIsLoading(false);
    }
  }, [recipientId, channelName, useHardcoded, joinWithHardcodedToken, joinCall]);

  // Answer an incoming call
  const answerCall = useCallback(async () => {
    setCallState('CONNECTED');
    
    try {
      // Notify caller that call was accepted
      notificationService.updateCallStatus(channelName, 'accepted', recipientId);
      
      // Join the call
      if (useHardcoded) {
        await joinWithHardcodedToken();
      } else {
        await joinCall();
      }
    } catch (error) {
      console.error('Failed to answer call:', error);
      setError(`Failed to answer call: ${error.message}`);
      setCallState('IDLE');
    }
  }, [channelName, recipientId, useHardcoded, joinWithHardcodedToken, joinCall]);

  // Decline an incoming call
  const declineCall = useCallback(async () => {
    try {
      // Notify caller that call was declined
      notificationService.updateCallStatus(channelName, 'declined', recipientId);
      setCallState('IDLE');
    } catch (error) {
      console.error('Error declining call:', error);
      setCallState('IDLE');
    }
  }, [channelName, recipientId]);

  // Leave call
  const leaveCall = useCallback(async () => {
    try {
      if (localAudioTrack) {
        localAudioTrack.close();
        setLocalAudioTrack(null);
      }
      
      if (localVideoTrack) {
        localVideoTrack.close();
        setLocalVideoTrack(null);
      }
      
      if (clientRef.current && (connectionState === 'CONNECTED' || connectionState === 'CONNECTING')) {
        await clientRef.current.leave();
        console.log("Left channel successfully");
        
        // Leave the call room
        notificationService.leaveCallRoom(channelName);
        
        // Notify other participants that you left the call
        if (callState === 'CONNECTED' || callState === 'CALLING') {
          notificationService.updateCallStatus(channelName, 'ended');
        }
      }
      
      setJoined(false);
      setRemoteUsers([]);
      setCallState('IDLE');
    } catch (err) {
      console.error("Error leaving channel:", err);
    }
  }, [localAudioTrack, localVideoTrack, connectionState, channelName, callState]);

  // Helper function to get socket
  const getSocket = useCallback(() => {
    try {
      return require('../../services/socketService').getSocket();
    } catch (error) {
      console.error('Error getting socket:', error);
      return null;
    }
  }, []);

  // Initialize client on component mount
  useEffect(() => {
    console.log("Initializing VideoCall component with channelName:", channelName);
    console.log("User ID for call:", userId);
    
    // Create the client only once
    if (!clientRef.current) {
      clientRef.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      
      // Enable detailed logging for debugging
      AgoraRTC.setLogLevel(1); // 0 is most verbose, but we'll use 1 for regular use
    }
    
    // Setup event listeners
    const client = clientRef.current;
    client.on('user-published', handleUserPublished);
    client.on('user-unpublished', handleUserUnpublished);
    client.on('user-left', handleUserLeft);
    client.on('connection-state-change', handleConnectionStateChange);
    
    client.on('token-privilege-will-expire', async () => {
      console.log('Token is about to expire, renewing...');
      try {
        // For hardcoded token, just notify the user
        if (useHardcoded) {
          alert('The token is about to expire. You may need to rejoin the call soon.');
          return;
        }
        
        // For dynamic token, try to renew
        const { token } = await getRtcToken(channelName);
        await client.renewToken(token);
        console.log('Token renewed successfully');
      } catch (error) {
        console.error('Error renewing token:', error);
      }
    });

    // Auto-join call if needed (for incoming calls)
    if (autoJoin && isIncoming) {
      answerCall();
    }

    // Listen for call status updates
    const socket = getSocket();
    if (socket) {
      socket.on('callStatusUpdate', (data) => {
        console.log('Call status update received:', data);
        
        if (data.callId === channelName) {
          if (data.status === 'ended' || data.status === 'declined') {
            // The other person ended or declined the call
            leaveCall();
          } else if (data.status === 'accepted') {
            // Call was accepted
            setCallState('CONNECTED');
          }
        }
      });
      
      socket.on('incomingCall', (data) => {
        console.log('Incoming call notification:', data);
        // This will be handled by the parent component
      });
    }

    // Cleanup on component unmount
    return () => {
      leaveCall();
      
      // Remove event listeners
      if (client) {
        client.removeAllListeners();
        console.log('Removed all RTC client event listeners');
      }
      
      // Remove socket listeners
      if (socket) {
        socket.off('callStatusUpdate');
        socket.off('incomingCall');
      }
    };
  }, [channelName, userId, handleUserPublished, handleUserUnpublished, handleUserLeft, 
      handleConnectionStateChange, leaveCall, useHardcoded, autoJoin, isIncoming, answerCall, getSocket]);

  // Effect for rendering remote video tracks
  useEffect(() => {
    remoteUsers.forEach(user => {
      if (user.videoTrack) {
        const playerElement = document.getElementById(`remote-video-${user.uid}`);
        if (playerElement) {
          try {
            user.videoTrack.play(`remote-video-${user.uid}`);
            console.log(`Playing remote video for user ${user.uid}`);
          } catch (error) {
            console.error(`Error playing remote video for user ${user.uid}:`, error);
          }
        }
      }
    });
  }, [remoteUsers]);

  // Toggle audio mute
  const toggleMute = async () => {
    if (localAudioTrack) {
      await localAudioTrack.setEnabled(!muted);
      setMuted(!muted);
      console.log(`Audio ${!muted ? 'muted' : 'unmuted'}`);
    }
  };

  // Toggle video
  const toggleVideo = async () => {
    if (localVideoTrack) {
      await localVideoTrack.setEnabled(!videoOff);
      setVideoOff(!videoOff);
      console.log(`Video ${!videoOff ? 'disabled' : 'enabled'}`);
    }
  };

  // Reset connection function for error recovery
  const resetConnection = async () => {
    await leaveCall();
    setError(null);
    // Force clientRef recreation on next render
    clientRef.current = null;
    // Re-create the client
    clientRef.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    // Setup event listeners
    const client = clientRef.current;
    client.on('user-published', handleUserPublished);
    client.on('user-unpublished', handleUserUnpublished);
    client.on('user-left', handleUserLeft);
    client.on('connection-state-change', handleConnectionStateChange);
    setConnectionState('DISCONNECTED');
    setCallState('IDLE');
  };

  return (
    <div className="video-call-container">
      <div className="video-header">
        <h3>Video Call: {channelName}</h3>
        {error && (
          <div className="error-message">
            {error}
            <button onClick={resetConnection} className="reset-btn">Reset Connection</button>
          </div>
        )}
        <div className="connection-status">
          Status: {connectionState} | Call State: {callState}
        </div>
        
        {/* Token selection toggle */}
        <div className="debug-options">
          <label>
            <input 
              type="checkbox" 
              checked={useHardcoded} 
              onChange={() => setUseHardcoded(!useHardcoded)} 
            />
            Use hardcoded test token (recommended)
          </label>
        </div>
      </div>
      
      <div className="video-streams">
        {callState === 'CALLING' ? (
          <div className="calling-status">
            <p>Calling...</p>
            <button onClick={leaveCall} className="cancel-btn">Cancel</button>
          </div>
        ) : callState === 'RINGING' ? (
          <div className="ringing-status">
            <p>Incoming call...</p>
            <div className="ringing-controls">
              <button onClick={answerCall} className="answer-btn">Answer</button>
              <button onClick={declineCall} className="decline-btn">Decline</button>
            </div>
          </div>
        ) : (
          <>
            <div className="local-stream">
              {isLoading ? (
                <div className="loading-indicator">Connecting...</div>
              ) : (
                <>
                  <div id="local-video" className="video-player" ref={localVideoRef}></div>
                  <div className="user-name">You {muted && '(Muted)'}</div>
                </>
              )}
            </div>
            
            {remoteUsers.map(user => (
              <div key={user.uid} className="remote-stream">
                <div id={`remote-video-${user.uid}`} className="video-player"></div>
                <div className="user-name">
                  User {user.uid} {user.audioTrack?.enabled === false && '(Muted)'}
                </div>
              </div>
            ))}
            
            {joined && remoteUsers.length === 0 && (
              <div className="waiting-message">
                Waiting for others to join...
              </div>
            )}
          </>
        )}
      </div>
      
      <div className="controls">
        {!joined && callState === 'IDLE' ? (
          <div className="call-controls">
            <button 
              onClick={initiateCall} 
              className="call-btn"
              disabled={isLoading || !recipientId}
            >
              {isLoading ? "Connecting..." : "Make Call"}
            </button>
            
            <button 
              onClick={useHardcoded ? joinWithHardcodedToken : joinCall} 
              className="join-btn"
              disabled={isLoading}
            >
              {isLoading ? "Connecting..." : "Join Directly"}
            </button>
          </div>
        ) : joined && (
          <div className="active-call-controls">
            <button onClick={toggleMute} className={`control-btn ${muted ? 'active' : ''}`}>
              {muted ? 'Unmute' : 'Mute'}
            </button>
            <button onClick={toggleVideo} className={`control-btn ${videoOff ? 'active' : ''}`}>
              {videoOff ? 'Show Video' : 'Hide Video'}
            </button>
            <button onClick={leaveCall} className="leave-btn">End Call</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoCall;