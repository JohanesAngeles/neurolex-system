// client/src/components/common/FeatureWrapper.jsx
import React from 'react';
import { useFeatureControl } from '../../hooks/useFeatureControl';

const FeatureWrapper = ({ 
  feature, 
  children, 
  fallback = null,
  showMessage = false 
}) => {
  const { isFeatureEnabled } = useFeatureControl();
  
  if (!isFeatureEnabled(feature)) {
    if (showMessage) {
      return (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          backgroundColor: '#f9f9f9',
          borderRadius: '8px',
          border: '1px solid #e0e0e0'
        }}>
          <h3>Feature Not Available</h3>
          <p>This feature has been disabled for your clinic.</p>
          <p>Contact your administrator for more information.</p>
        </div>
      );
    }
    return fallback;
  }
  
  return children;
};

export default FeatureWrapper;