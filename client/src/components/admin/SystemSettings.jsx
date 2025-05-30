// client/src/components/admin/layout/SystemSettings.jsx - COMPLETELY FIXED VERSION
import React, { useState, useEffect, useCallback } from 'react';
import adminService from '../../services/adminService';
import HirsToggleModal from './layout/HirsToggleModal';

const SystemSettings = () => {
  // State management
  const [selectedTenant, setSelectedTenant] = useState('');
  const [tenants, setTenants] = useState([]);
  const [isLoadingTenants, setIsLoadingTenants] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  
  // Modal state for HIRS toggle
  const [modalState, setModalState] = useState({
    isOpen: false,
    hirsSetting: null,
    action: null,
    isLoading: false
  });
  
  // Preview URLs state for ALL image types
  const [previewUrls, setPreviewUrls] = useState({
    lightLogo: '',
    darkLogo: '',
    lightFavicon: '',
    darkFavicon: ''
  });
  
  // Settings state with proper defaults
  const [settings, setSettings] = useState({
    platformName: '',
    platformDescription: '',
    systemLogo: { light: null, dark: null },
    favicon: { light: null, dark: null },
    primaryColor: '',
    secondaryColor: '',
    hirsSettings: [] // Always initialize as empty array
  });

  // 🔧 HELPER: Safely get hirsSettings array
  const getHirsSettings = useCallback(() => {
    if (settings && settings.hirsSettings && Array.isArray(settings.hirsSettings)) {
      return settings.hirsSettings;
    }
    return [];
  }, [settings]);

  // 🔧 HELPER: Safely count active/inactive features
  const getFeatureCounts = useCallback(() => {
    const hirsArray = getHirsSettings();
    return {
      active: hirsArray.filter(h => h && h.isActive).length,
      inactive: hirsArray.filter(h => h && !h.isActive).length,
      total: hirsArray.length
    };
  }, [getHirsSettings]);

  // Broadcast settings update to all open tabs/windows
  const broadcastSettingsUpdate = useCallback((tenantId, updatedSettings) => {
    console.log('📡 Broadcasting settings update to all tabs...');
    
    // Method 1: Custom event for same tab
    const updateEvent = new CustomEvent('tenantSettingsUpdated', {
      detail: {
        tenantId,
        updatedSettings,
        timestamp: Date.now()
      }
    });
    window.dispatchEvent(updateEvent);
    
    // Method 2: LocalStorage event for other tabs
    localStorage.setItem('tenantSettingsUpdated', JSON.stringify({
      tenantId,
      timestamp: Date.now(),
      updatedSettings
    }));
    
    // Clean up the localStorage flag after a short delay
    setTimeout(() => {
      localStorage.removeItem('tenantSettingsUpdated');
    }, 1000);
    
    console.log('✅ Settings update broadcasted successfully');
  }, []);

  // Individual setting save function with real-time updates
  const saveIndividualSetting = async (settingType, value) => {
    if (!selectedTenant) {
      alert('Please select a clinic first');
      return;
    }
    try {
      const updateData = { [settingType]: value };
      const data = await adminService.updateIndividualSetting(selectedTenant, updateData);
      if (data.success) {
        broadcastSettingsUpdate(selectedTenant, { [settingType]: value });
        alert(`✅ ${settingType.replace(/([A-Z])/g, ' $1').toLowerCase()} saved successfully!`);
        setTimeout(() => {
          fetchTenantSettings();
        }, 500);
      } else {
        throw new Error(data.message || 'Save failed');
      }
    } catch (error) {
      alert(`❌ Failed to save ${settingType}: ${error.response?.data?.message || error.message}`);
    }
  };

  // 🔧 COMPLETELY FIXED: Toggle HIRS feature function
  const toggleHirsFeature = async (hirsId, newStatus) => {
    if (!selectedTenant) {
      alert('Please select a clinic first');
      return;
    }

    try {
      setModalState(prev => ({ ...prev, isLoading: true }));

      console.log('🔄 [ADMIN] Toggling HIRS feature:', { hirsId, newStatus, selectedTenant });

      const response = await fetch(`/api/admin/tenant-settings/${selectedTenant}/hirs/${hirsId}/toggle`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({
          isActive: newStatus,
          lastUpdated: new Date().toLocaleDateString()
        })
      });

      const data = await response.json();
      console.log('🔄 [ADMIN] API Response:', data);
      
      if (data.success) {
        // 🔧 SAFE: Get current hirsSettings array
        const currentHirsSettings = getHirsSettings();
        
        if (currentHirsSettings.length > 0) {
          // Update local state immediately
          const updatedHirsSettings = currentHirsSettings.map(hirs => 
            hirs && hirs.id === hirsId 
              ? { 
                  ...hirs, 
                  isActive: newStatus, 
                  lastUpdated: new Date().toLocaleDateString() 
                }
              : hirs
          );

          setSettings(prev => ({
            ...prev,
            hirsSettings: updatedHirsSettings
          }));

          // Broadcast the update to all doctor tabs
          const updateData = { hirsSettings: updatedHirsSettings };
          
          // Multiple broadcast methods
          window.dispatchEvent(new CustomEvent('tenantSettingsUpdated', {
            detail: {
              tenantId: selectedTenant,
              hirsId,
              isActive: newStatus,
              updatedSettings: updateData,
              timestamp: Date.now()
            }
          }));
          
          localStorage.setItem('tenantSettingsUpdated', JSON.stringify({
            tenantId: selectedTenant,
            hirsId,
            isActive: newStatus,
            timestamp: Date.now(),
            updatedSettings: updateData
          }));
          
          if (window.BroadcastChannel) {
            const channel = new BroadcastChannel('tenant-settings');
            channel.postMessage({
              type: 'HIRS_TOGGLE',
              tenantId: selectedTenant,
              hirsId,
              isActive: newStatus,
              timestamp: Date.now()
            });
            channel.close();
          }

          // Clean up localStorage
          setTimeout(() => {
            localStorage.removeItem('tenantSettingsUpdated');
          }, 1000);

          // 🔧 SAFE: Get feature name
          const featureName = (() => {
            try {
              const feature = currentHirsSettings.find(h => h && h.id === hirsId);
              return feature ? feature.name : 'Feature';
            } catch (error) {
              console.warn('Error getting feature name:', error);
              return 'Feature';
            }
          })();

          alert(`✅ ${featureName} has been ${newStatus ? 'enabled' : 'disabled'} successfully!`);

          // Force refresh signal for doctor tabs
          localStorage.setItem('forceRefreshTenantSettings', JSON.stringify({
            tenantId: selectedTenant,
            timestamp: Date.now()
          }));
          
          setTimeout(() => {
            localStorage.removeItem('forceRefreshTenantSettings');
          }, 2000);

        } else {
          console.warn('⚠️ hirsSettings array is empty, refreshing...');
          await fetchTenantSettings();
          alert(`✅ Feature has been ${newStatus ? 'enabled' : 'disabled'} successfully!`);
        }

        // Close modal
        setModalState({ isOpen: false, hirsSetting: null, action: null, isLoading: false });

      } else {
        throw new Error(data.message || 'Update failed');
      }
    } catch (error) {
      console.error('❌ [ADMIN] Error toggling HIRS feature:', error);
      
      let errorMessage = 'Failed to update feature';
      if (error.message) {
        if (error.message.includes('fetch')) {
          errorMessage = 'Network error - please check your connection';
        } else if (error.message.includes('401')) {
          errorMessage = 'Authentication failed - please login again';
        } else if (error.message.includes('404')) {
          errorMessage = 'API endpoint not found - please contact support';
        } else {
          errorMessage = error.message;
        }
      }
      
      alert(`❌ ${errorMessage}`);
      setModalState(prev => ({ ...prev, isLoading: false }));
    }
  };

  // Handle HIRS toggle button click
  const handleHirsToggleClick = (hirs) => {
    const newStatus = !hirs.isActive;
    const action = newStatus ? 'enable' : 'disable';
    
    setModalState({
      isOpen: true,
      hirsSetting: hirs,
      action: action,
      isLoading: false
    });
  };

  // Handle modal confirmation
  const handleModalConfirm = () => {
    if (modalState.hirsSetting) {
      const newStatus = modalState.action === 'enable';
      toggleHirsFeature(modalState.hirsSetting.id, newStatus);
    }
  };

  // Handle modal close
  const handleModalClose = () => {
    if (!modalState.isLoading) {
      setModalState({ isOpen: false, hirsSetting: null, action: null, isLoading: false });
    }
  };

  // Create default settings
  const createDefaultTenantSettings = useCallback(async () => {
    try {
      const defaultSettings = {
        platformName: 'NEUROLEX',
        platformDescription: 'Neurolex is an AI-powered system that uses Natural Language Processing (NLP) to analyze your journal entries and track your emotional well-being.',
        primaryColor: '#4CAF50',
        secondaryColor: '#2196F3',
        systemLogo: { light: null, dark: null },
        favicon: { light: null, dark: null },
        hirsSettings: [
          { id: 1, icon: '📊', name: 'Dashboard', description: 'Main dashboard overview for doctors.', lastUpdated: new Date().toLocaleDateString(), isActive: true },
          { id: 2, icon: '👥', name: 'Patients', description: 'Patient management and list view.', lastUpdated: new Date().toLocaleDateString(), isActive: true },
          { id: 3, icon: '📖', name: 'Patient Journal Management', description: 'View and manage patient journal entries.', lastUpdated: new Date().toLocaleDateString(), isActive: true },
          { id: 4, icon: '📝', name: 'Journal Template Management', description: 'Create and manage journal templates for patients.', lastUpdated: new Date().toLocaleDateString(), isActive: true },
          { id: 5, icon: '📅', name: 'Appointments', description: 'Schedule and manage appointments with patients.', lastUpdated: new Date().toLocaleDateString(), isActive: true },
          { id: 6, icon: '💬', name: 'Messages', description: 'Secure messaging with patients.', lastUpdated: new Date().toLocaleDateString(), isActive: true }
        ]
      };
      const data = await adminService.updateTenantSettings(selectedTenant, defaultSettings);
      if (data.success) {
        setSettings(defaultSettings);
        broadcastSettingsUpdate(selectedTenant, defaultSettings);
      }
    } catch (error) {
      console.error('Error creating default settings:', error);
    }
  }, [selectedTenant, broadcastSettingsUpdate]);

  // Fetch tenant settings
  const fetchTenantSettings = useCallback(async () => {
    if (!selectedTenant) return;
    try {
      setIsLoading(true);
      const data = await adminService.getTenantSettings(selectedTenant);
      if (data.success) {
        const fetchedSettings = {
          platformName: data.data.platformName || 'NEUROLEX',
          platformDescription: data.data.platformDescription || 'Mental wellness platform',
          systemLogo: data.data.systemLogo || { light: null, dark: null },
          favicon: data.data.favicon || { light: null, dark: null },
          primaryColor: data.data.primaryColor || '#4CAF50',
          secondaryColor: data.data.secondaryColor || '#2196F3',
          hirsSettings: Array.isArray(data.data.hirsSettings) ? data.data.hirsSettings : []
        };
        setSettings(fetchedSettings);
        setPreviewUrls({
          lightLogo: fetchedSettings.systemLogo?.light || '',
          darkLogo: fetchedSettings.systemLogo?.dark || '',
          lightFavicon: fetchedSettings.favicon?.light || '',
          darkFavicon: fetchedSettings.favicon?.dark || ''
        });
      } else {
        await createDefaultTenantSettings();
      }
    } catch (error) {
      await createDefaultTenantSettings();
    } finally {
      setIsLoading(false);
    }
  }, [selectedTenant, createDefaultTenantSettings]);

  // Load tenants
  useEffect(() => {
    const fetchTenants = async () => {
      try {
        setIsLoadingTenants(true);
        const data = await adminService.getTenants();
        if (data.success) {
          setTenants(data.data);
          if (data.data.length === 1) {
            setSelectedTenant(data.data[0]._id);
          }
        }
      } catch (error) {
        console.error('Error fetching tenants:', error);
      } finally {
        setIsLoadingTenants(false);
      }
    };
    fetchTenants();
  }, []);

  useEffect(() => {
    if (selectedTenant) {
      fetchTenantSettings();
    }
  }, [selectedTenant, fetchTenantSettings]);

  const handleInputChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  // File upload function with real-time updates
  const handleFileUpload = async (imageType, variant, file) => {
    if (!file || !selectedTenant) {
      alert('Please select a clinic first');
      return;
    }
    try {
      setIsUploadingFile(true);
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select an image file');
      }
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('File size must be less than 10MB');
      }
      if (imageType === 'favicon' && file.size > 2 * 1024 * 1024) {
        throw new Error('Favicon file size should be less than 2MB');
      }

      // Create immediate preview
      const fileReader = new FileReader();
      fileReader.onload = (e) => {
        const previewKey = `${variant}${imageType === 'logo' ? 'Logo' : 'Favicon'}`;
        setPreviewUrls(prev => ({ ...prev, [previewKey]: e.target.result }));
      };
      fileReader.readAsDataURL(file);

      // Upload to server
      const formData = new FormData();
      formData.append('logo', file);
      formData.append('logoType', variant);
      formData.append('imageType', imageType);
      formData.append('tenantId', selectedTenant);

      const response = await fetch('/api/admin/upload-logo', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        setTimeout(() => {
          const previewKey = `${variant}${imageType === 'logo' ? 'Logo' : 'Favicon'}`;
          setPreviewUrls(prev => ({ ...prev, [previewKey]: data.url + '?t=' + Date.now() }));
        }, 500);

        const updatedImageData = {
          [variant]: data.url
        };

        setSettings(prev => ({
          ...prev,
          [imageType === 'logo' ? 'systemLogo' : 'favicon']: {
            ...prev[imageType === 'logo' ? 'systemLogo' : 'favicon'],
            [variant]: data.url
          }
        }));

        const updateData = {
          [imageType === 'logo' ? 'systemLogo' : 'favicon']: {
            ...settings[imageType === 'logo' ? 'systemLogo' : 'favicon'],
            [variant]: data.url
          }
        };
        broadcastSettingsUpdate(selectedTenant, updateData);

        alert(`✅ ${imageType} uploaded successfully!`);

        try {
          await adminService.updateIndividualSetting(selectedTenant, updateData);
        } catch (saveError) {
          console.warn('Upload successful but auto-save failed:', saveError);
        }
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      alert(`❌ Upload failed: ${error.message}`);
    } finally {
      setIsUploadingFile(false);
    }
  };

  // Save settings with real-time updates
  const saveSettings = async () => {
    if (!selectedTenant) {
      alert('Please select a clinic first');
      return;
    }
    try {
      setIsSaving(true);
      const data = await adminService.updateTenantSettings(selectedTenant, settings);
      if (data.success) {
        broadcastSettingsUpdate(selectedTenant, settings);
        alert('✅ Settings saved successfully!');
        setTimeout(() => {
          fetchTenantSettings();
        }, 500);
      } else {
        throw new Error(data.message || 'Save failed');
      }
    } catch (error) {
      alert(`❌ Failed to save settings: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const resetSettings = () => {
    if (selectedTenant) {
      fetchTenantSettings();
      alert('Settings reset to saved values');
    }
  };

  // Show notification when settings are updated from another tab
  useEffect(() => {
    const handleSettingsUpdate = () => {
      console.log('🔔 Settings updated from another source, refreshing...');
      if (selectedTenant) {
        fetchTenantSettings();
      }
    };

    window.addEventListener('tenantSettingsUpdated', handleSettingsUpdate);
    return () => window.removeEventListener('tenantSettingsUpdated', handleSettingsUpdate);
  }, [selectedTenant, fetchTenantSettings]);

  // Get feature counts for display
  const featureCounts = getFeatureCounts();

  return (
    <>
      <style jsx global>{`
        .admin-content-container {
          height: 100vh !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          min-height: 0 !important;
        }
        
        .admin-content {
          height: 100vh !important;
          min-height: 0 !important;
          display: flex !important;
          flex-direction: column !important;
        }
        
        .admin-layout {
          height: 100vh !important;
          overflow: hidden !important;
        }
      `}</style>
      
      <div style={{ 
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif', 
        backgroundColor: '#f8fafc', 
        width: '100%',
        minHeight: 'auto',
        padding: '24px',
        paddingBottom: '150px',
        boxSizing: 'border-box'
      }}>
        
        {/* Header */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '600', color: '#1e293b' }}>General Settings</h1>
          <p style={{ margin: '8px 0 0 0', fontSize: '16px', color: '#64748b' }}>Configure platform settings for each clinic</p>
        </div>

        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* Tenant Selection */}
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: '600', color: '#1e293b' }}>Select Clinic</h2>
            <select value={selectedTenant} onChange={(e) => setSelectedTenant(e.target.value)} disabled={isLoadingTenants} style={{ padding: '12px 16px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '16px', minWidth: '300px', backgroundColor: 'white' }}>
              <option value="">-- Select Clinic --</option>
              {tenants.map(tenant => (
                <option key={tenant._id} value={tenant._id}>{tenant.name}</option>
              ))}
            </select>
          </div>

          {selectedTenant && !isLoading && (
            <>
              {/* Platform Settings */}
              <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ marginBottom: '32px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '16px', color: '#374151' }}>Platform Name</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input type="text" value={settings.platformName} onChange={(e) => handleInputChange('platformName', e.target.value)} placeholder="Enter platform name" style={{ flex: 1, padding: '12px 16px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '16px', backgroundColor: '#f8fafc' }} />
                    <button onClick={() => saveIndividualSetting('platformName', settings.platformName)} style={{ backgroundColor: '#22c55e', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>Save and Update</button>
                  </div>
                </div>
                <div style={{ marginBottom: '32px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '16px', color: '#374151' }}>Platform Description</label>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <textarea value={settings.platformDescription} onChange={(e) => handleInputChange('platformDescription', e.target.value)} placeholder="Enter platform description" rows={4} style={{ flex: 1, padding: '12px 16px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '16px', resize: 'vertical', backgroundColor: '#f8fafc', fontFamily: 'inherit' }} />
                    <button onClick={() => saveIndividualSetting('platformDescription', settings.platformDescription)} style={{ backgroundColor: '#22c55e', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>Save and Update</button>
                  </div>
                </div>
              </div>

              {/* HIRS Management Table with Fixed Toggle Functionality */}
              <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '600', color: '#1e293b' }}>Doctor Navigation Menu Control</h2>
                    <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#64748b' }}>
                      Control which features are visible in the doctor sidebar menu ({featureCounts.total} items)
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                      {featureCounts.active} enabled, {featureCounts.inactive} disabled
                    </div>
                    <div style={{ fontSize: '10px', color: '#9ca3af' }}>
                      Changes apply immediately to all doctor sessions
                    </div>
                  </div>
                </div>

                <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '80px 200px 1fr 150px 120px', gap: '16px', padding: '16px', backgroundColor: '#f9fafb', fontWeight: '600', fontSize: '14px', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                    <div>Icon</div>
                    <div>Menu Item</div>
                    <div>Description</div>
                    <div>Last Updated</div>
                    <div>Status</div>
                  </div>
                  {getHirsSettings().map((hirs, index) => (
                    <div key={hirs.id} style={{ display: 'grid', gridTemplateColumns: '80px 200px 1fr 150px 120px', gap: '16px', padding: '16px', borderBottom: index < getHirsSettings().length - 1 ? '1px solid #f3f4f6' : 'none', alignItems: 'center', backgroundColor: 'white' }}>
                      <div style={{ fontSize: '32px', textAlign: 'center' }}>{hirs.icon}</div>
                      <div style={{ fontWeight: '500', color: '#1f2937' }}>{hirs.name}</div>
                      <div style={{ fontSize: '14px', color: '#6b7280' }}>{hirs.description}</div>
                      <div style={{ fontSize: '14px', color: '#6b7280' }}>{hirs.lastUpdated}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleHirsToggleClick(hirs)}
                          disabled={modalState.isLoading || (hirs.id === 1)}
                          style={{
                            backgroundColor: hirs.id === 1 ? '#9ca3af' : (hirs.isActive ? '#dc2626' : '#22c55e'),
                            color: 'white',
                            border: 'none',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            cursor: (modalState.isLoading || hirs.id === 1) ? 'not-allowed' : 'pointer',
                            fontSize: '12px',
                            fontWeight: '500',
                            opacity: (modalState.isLoading || hirs.id === 1) ? 0.6 : 1,
                            minWidth: '80px'
                          }}
                          title={hirs.id === 1 ? 'Dashboard cannot be disabled (critical feature)' : `Click to ${hirs.isActive ? 'disable' : 'enable'} this feature for all doctors`}
                        >
                          {hirs.id === 1 ? '🔒 Always On' : (hirs.isActive ? '🚫 Disable' : '✅ Enable')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Feature Summary */}
                <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '12px', height: '12px', backgroundColor: '#22c55e', borderRadius: '50%' }}></div>
                      <span style={{ fontSize: '14px', color: '#374151' }}>
                        {featureCounts.active} Features Enabled
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '12px', height: '12px', backgroundColor: '#dc2626', borderRadius: '50%' }}></div>
                      <span style={{ fontSize: '14px', color: '#374151' }}>
                        {featureCounts.inactive} Features Disabled
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginLeft: 'auto' }}>
                      💡 Disabled features will be hidden from the doctor sidebar menu
                    </div>
                  </div>
                </div>
              </div>

              {/* Save Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '50px' }}>
                <button onClick={resetSettings} disabled={isLoading || isSaving} style={{ backgroundColor: 'white', color: '#6b7280', border: '1px solid #d1d5db', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: '500', opacity: (isLoading || isSaving) ? 0.6 : 1 }}>Reset Changes</button>
                <button onClick={saveSettings} disabled={isLoading || isSaving} style={{ backgroundColor: '#22c55e', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: '500', opacity: (isLoading || isSaving) ? 0.6 : 1 }}>{isSaving ? 'Saving...' : 'Save All Settings'}</button>
              </div>
            </>
          )}

          {/* Loading and Empty States */}
          {isLoading && (
            <div style={{ backgroundColor: 'white', padding: '60px 24px', borderRadius: '12px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '20px', color: '#1e293b' }}>Loading Settings...</h3>
              <p style={{ margin: 0, color: '#64748b', fontSize: '16px' }}>Fetching configuration for selected clinic...</p>
            </div>
          )}

          {!selectedTenant && !isLoadingTenants && (
            <div style={{ backgroundColor: 'white', padding: '60px 24px', borderRadius: '12px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '20px', color: '#1e293b' }}>No Clinic Selected</h3>
              <p style={{ margin: 0, color: '#64748b', fontSize: '16px' }}>Please select a clinic from the dropdown above to configure its settings.</p>
            </div>
          )}

          {/* Upload Progress Overlay */}
          {isUploadingFile && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', textAlign: 'center', minWidth: '300px' }}>
                <div style={{ width: '40px', height: '40px', border: '4px solid #f3f4f6', borderTop: '4px solid #22c55e', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px auto' }} />
                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#1e293b' }}>Uploading File...</h3>
                <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>Please wait while we upload your image to Cloudinary</p>
              </div>
            </div>
          )}
        </div>

        {/* HIRS Toggle Modal */}
        <HirsToggleModal
          isOpen={modalState.isOpen}
          onClose={handleModalClose}
          onConfirm={handleModalConfirm}
          hirsSetting={modalState.hirsSetting}
          action={modalState.action}
          isLoading={modalState.isLoading}
        />

        {/* CSS Animation for loading spinner */}
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </>
  );
};

export default SystemSettings;