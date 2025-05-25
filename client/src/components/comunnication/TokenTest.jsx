// client/src/components/TokenTest.jsx
import React, { useState } from 'react';

const TokenTest = () => {
  const [tokenData, setTokenData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const testRtcToken = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:5000/api/agora/rtc-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          channelName: 'test',
          uid: 0
        })
      });

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      const data = await response.json();
      console.log('RTC Token response:', data);
      console.log('Token first 20 chars:', data.token?.substring(0, 20));
      console.log('Token length:', data.token?.length);
      
      setTokenData(data);
    } catch (error) {
      console.error('Error getting token:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Test using the token with Agora SDK
  const testConnection = async () => {
    if (!tokenData) {
      setError("Please get a token first");
      return;
    }

    setLoading(true);
    try {
      // Load Agora SDK dynamically to avoid issues
      const AgoraRTC = await import('agora-rtc-sdk-ng').then(m => m.default);
      
      // Create client
      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      
      console.log('Testing connection with:');
      console.log('- App ID:', tokenData.appId);
      console.log('- Channel:', 'test');
      console.log('- Token length:', tokenData.token.length);
      console.log('- UID:', 0);
      
      // Join channel
      await client.join(
        tokenData.appId,
        'test',
        tokenData.token,
        0
      );
      
      console.log('Successfully joined channel!');
      
      // Leave after 3 seconds
      setTimeout(async () => {
        await client.leave();
        console.log('Left channel');
        setLoading(false);
      }, 3000);
      
    } catch (error) {
      console.error('Connection test failed:', error);
      setError(`Connection test failed: ${error.message}`);
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2>Agora Token Test</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={testRtcToken} 
          disabled={loading}
          style={{ padding: '10px 15px', marginRight: '10px' }}
        >
          {loading ? 'Loading...' : 'Get RTC Token'}
        </button>
        
        <button 
          onClick={testConnection}
          disabled={!tokenData || loading}
          style={{ padding: '10px 15px' }}
        >
          Test Connection
        </button>
      </div>
      
      {error && (
        <div style={{ 
          padding: '10px', 
          backgroundColor: '#ffebee', 
          color: '#d32f2f',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          Error: {error}
        </div>
      )}
      
      {tokenData && (
        <div style={{ 
          padding: '10px', 
          backgroundColor: '#f1f8e9', 
          borderRadius: '4px',
          marginBottom: '20px',
          wordBreak: 'break-all'
        }}>
          <h3>Token Data:</h3>
          <p><strong>App ID:</strong> {tokenData.appId}</p>
          <p><strong>Token (first 20 chars):</strong> {tokenData.token.substring(0, 20)}...</p>
          <p><strong>Token Length:</strong> {tokenData.token.length}</p>
          <p><strong>UID:</strong> {tokenData.uid}</p>
          {tokenData.channelName && <p><strong>Channel:</strong> {tokenData.channelName}</p>}
          {tokenData.expiresAt && <p><strong>Expires:</strong> {new Date(tokenData.expiresAt * 1000).toLocaleString()}</p>}
        </div>
      )}
      
      <div style={{ marginTop: '20px' }}>
        <h3>Console Instructions:</h3>
        <p>Open your browser console (F12) to see detailed logs.</p>
        <p>Check your server logs to see if the token request is hitting the server correctly.</p>
      </div>
    </div>
  );
};

export default TokenTest;