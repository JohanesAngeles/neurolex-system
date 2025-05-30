import React from 'react';

const HirsToggleModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  hirsSetting, 
  action, // 'enable' or 'disable'
  isLoading 
}) => {
  if (!isOpen || !hirsSetting) return null;

  const isDisabling = action === 'disable';
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '32px',
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}>
        {/* Header */}
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: isDisabling ? '#fee2e2' : '#dcfce7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto',
            fontSize: '24px'
          }}>
            {isDisabling ? '⚠️' : '✅'}
          </div>
          
          <h3 style={{
            margin: '0 0 8px 0',
            fontSize: '20px',
            fontWeight: '600',
            color: '#1f2937'
          }}>
            {isDisabling ? 'Disable Feature' : 'Enable Feature'}
          </h3>
          
          <p style={{
            margin: 0,
            fontSize: '14px',
            color: '#6b7280'
          }}>
            This action will affect all users in the doctor interface
          </p>
        </div>

        {/* Feature Info */}
        <div style={{
          backgroundColor: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              backgroundColor: hirsSetting.isActive ? '#22c55e' : '#9ca3af',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 'bold'
            }}>
              {hirsSetting.icon}
            </div>
            <div>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '500', color: '#1f2937' }}>
                {hirsSetting.name}
              </h4>
              <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
                Current Status: <span style={{ 
                  color: hirsSetting.isActive ? '#22c55e' : '#ef4444',
                  fontWeight: '500'
                }}>
                  {hirsSetting.isActive ? 'Enabled' : 'Disabled'}
                </span>
              </p>
            </div>
          </div>
          
          <p style={{ margin: 0, fontSize: '14px', color: '#374151', lineHeight: '1.5' }}>
            {hirsSetting.description}
          </p>
        </div>

        {/* Warning/Info Message */}
        <div style={{
          backgroundColor: isDisabling ? '#fef2f2' : '#f0fdf4',
          border: `1px solid ${isDisabling ? '#fecaca' : '#bbf7d0'}`,
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ 
              fontSize: '16px',
              color: isDisabling ? '#dc2626' : '#16a34a'
            }}>
              {isDisabling ? '⚠️' : 'ℹ️'}
            </div>
            <div>
              <h5 style={{
                margin: '0 0 8px 0',
                fontSize: '14px',
                fontWeight: '600',
                color: isDisabling ? '#dc2626' : '#16a34a'
              }}>
                {isDisabling ? 'Warning: This will disable the feature' : 'This will enable the feature'}
              </h5>
              <ul style={{
                margin: 0,
                paddingLeft: '16px',
                fontSize: '13px',
                color: '#374151',
                lineHeight: '1.4'
              }}>
                <li>
                  {isDisabling 
                    ? 'The sidebar menu item will be hidden from all doctors'
                    : 'The sidebar menu item will be visible to all doctors'
                  }
                </li>
                <li>
                  {isDisabling 
                    ? 'Doctors will lose access to this functionality immediately'
                    : 'Doctors will gain access to this functionality immediately'
                  }
                </li>
                <li>Changes take effect in real-time across all sessions</li>
                <li>You can {isDisabling ? 'enable' : 'disable'} this feature again at any time</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={isLoading}
            style={{
              backgroundColor: 'white',
              color: '#374151',
              border: '1px solid #d1d5db',
              padding: '12px 20px',
              borderRadius: '8px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              opacity: isLoading ? 0.6 : 1
            }}
          >
            Cancel
          </button>
          
          <button
            onClick={onConfirm}
            disabled={isLoading}
            style={{
              backgroundColor: isDisabling ? '#dc2626' : '#22c55e',
              color: 'white',
              border: 'none',
              padding: '12px 20px',
              borderRadius: '8px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              opacity: isLoading ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {isLoading ? (
              <>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTop: '2px solid white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                Processing...
              </>
            ) : (
              <>
                {isDisabling ? '🚫' : '✅'}
                {isDisabling ? 'Disable Feature' : 'Enable Feature'}
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* CSS for spinner animation */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default HirsToggleModal;