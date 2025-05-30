// client/src/components/admin/layout/SystemSettings.jsx - Complete Enhanced with HIRS Toggle
import React, { useState, useEffect, useCallback } from 'react';
import adminService from '../../services/adminService';
import HirsToggleModal from './layout/HirsToggleModal'; // Import the modal component

const SystemSettings = () => {
  // State management
  const [selectedTenant, setSelectedTenant] = useState('');
  const [tenants, setTenants] = useState([]);
  const [isLoadingTenants, setIsLoadingTenants] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  
  // 🔄 NEW: Modal state for HIRS toggle
  const [modalState, setModalState] = useState({
    isOpen: false,
    hirsSetting: null,
    action: null, // 'enable' or 'disable'
    isLoading: false
  });
  
  // Preview URLs state for ALL image types (Logo + Favicon)
  const [previewUrls, setPreviewUrls] = useState({
    lightLogo: '',
    darkLogo: '',
    lightFavicon: '',
    darkFavicon: ''
  });
  
  // Settings state
  const [settings, setSettings] = useState({
    platformName: '',
    platformDescription: '',
    systemLogo: { light: null, dark: null },
    favicon: { light: null, dark: null },
    primaryColor: '',
    secondaryColor: '',
    hirsSettings: []
  });

  // 🔄 Broadcast settings update to all open tabs/windows
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

  // 🔄 ENHANCED: Individual setting save function with real-time updates
  const saveIndividualSetting = async (settingType, value) => {
    if (!selectedTenant) {
      alert('Please select a clinic first');
      return;
    }
    try {
      const updateData = { [settingType]: value };
      const data = await adminService.updateIndividualSetting(selectedTenant, updateData);
      if (data.success) {
        // 🔄 Broadcast the update to all open tabs
        broadcastSettingsUpdate(selectedTenant, { [settingType]: value });
        
        alert(`✅ ${settingType.replace(/([A-Z])/g, ' $1').toLowerCase()} saved successfully!`);
        
        // 🔄 Small delay to ensure backend is updated, then refresh preview
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

  // 🆕 NEW: Toggle HIRS feature function
  const toggleHirsFeature = async (hirsId, newStatus) => {
  if (!selectedTenant) {
    alert('Please select a clinic first');
    return;
  }

  try {
    setModalState(prev => ({ ...prev, isLoading: true }));

    console.log('🔄 Toggling HIRS feature:', { hirsId, newStatus, selectedTenant });

    // 🚨 FIXED: Use the dedicated HIRS toggle endpoint that exists in your routes
    const response = await fetch(`/api/admin/tenant-settings/${selectedTenant}/hirs/${hirsId}`, {
      method: 'PATCH',
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
    console.log('🔄 API Response:', data);
    
    if (data.success) {
      // Update local state
      const updatedHirsSettings = settings.hirsSettings.map(hirs => 
        hirs.id === hirsId 
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

      // 🔄 Broadcast the update to all open tabs (this will update doctor interface)
      const updateData = { hirsSettings: updatedHirsSettings };
      broadcastSettingsUpdate(selectedTenant, updateData);

      // Show success message
      const featureName = settings.hirsSettings.find(h => h.id === hirsId)?.name || 'Feature';
      alert(`✅ ${featureName} has been ${newStatus ? 'enabled' : 'disabled'} successfully!`);

      // Close modal
      setModalState({ isOpen: false, hirsSetting: null, action: null, isLoading: false });

      // Refresh settings after a short delay to confirm the update
      setTimeout(() => {
        fetchTenantSettings();
      }, 1000);
    } else {
      throw new Error(data.message || 'Update failed');
    }
  } catch (error) {
    console.error('❌ Error toggling HIRS feature:', error);
    alert(`❌ Failed to update feature: ${error.message}`);
    setModalState(prev => ({ ...prev, isLoading: false }));
  }
};

  // 🆕 NEW: Handle HIRS toggle button click
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

  // 🆕 NEW: Handle modal confirmation
  const handleModalConfirm = () => {
    if (modalState.hirsSetting) {
      const newStatus = modalState.action === 'enable';
      toggleHirsFeature(modalState.hirsSetting.id, newStatus);
    }
  };

  // 🆕 NEW: Handle modal close
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
        // 🔄 Broadcast the update
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
          hirsSettings: data.data.hirsSettings || []
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

  // 🔄 ENHANCED: File upload function with real-time updates
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
        // 🔄 Update preview with new URL immediately
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

        // 🔄 Broadcast the image update to all open tabs
        const updateData = {
          [imageType === 'logo' ? 'systemLogo' : 'favicon']: {
            ...settings[imageType === 'logo' ? 'systemLogo' : 'favicon'],
            [variant]: data.url
          }
        };
        broadcastSettingsUpdate(selectedTenant, updateData);

        alert(`✅ ${imageType} uploaded successfully!`);

        // Auto-save
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

  // 🔄 ENHANCED: Save settings with real-time updates
  const saveSettings = async () => {
    if (!selectedTenant) {
      alert('Please select a clinic first');
      return;
    }
    try {
      setIsSaving(true);
      const data = await adminService.updateTenantSettings(selectedTenant, settings);
      if (data.success) {
        // 🔄 Broadcast the complete settings update
        broadcastSettingsUpdate(selectedTenant, settings);
        
        alert('✅ Settings saved successfully!');
        
        // 🔄 Small delay to ensure all tabs receive the update
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

  // 🔄 Show notification when settings are updated from another tab
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

  return (
    <>
      {/* 🔧 CRITICAL CSS OVERRIDE TO FORCE SCROLLING */}
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

              {/* Logo Section */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                {/* System Logo Light */}
                <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <h3 style={{ margin: '0 0 24px 0', fontSize: '20px', fontWeight: '600', color: '#1e293b' }}>System Logo (Version 1 - Light)</h3>
                  <div style={{ width: '200px', height: '200px', border: '2px dashed #d1d5db', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto', backgroundColor: '#f8fafc', overflow: 'hidden', position: 'relative' }}>
                    {(previewUrls.lightLogo || settings.systemLogo?.light) ? (
                      <img src={previewUrls.lightLogo || settings.systemLogo?.light} alt="Light Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    ) : (
                      <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>
                        <div style={{ fontSize: '48px', marginBottom: '8px' }}>🖼️</div>
                        <div>NEUROLEX_Logo_Light.png</div>
                      </div>
                    )}
                  </div>
                  <button style={{ width: '100%', backgroundColor: '#22c55e', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }} onClick={() => document.getElementById('light-logo-input').click()}>Change Image</button>
                  <input id="light-logo-input" type="file" accept="image/*" onChange={(e) => e.target.files[0] && handleFileUpload('logo', 'light', e.target.files[0])} style={{ display: 'none' }} />
                </div>

                {/* System Logo Dark */}
                <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <h3 style={{ margin: '0 0 24px 0', fontSize: '20px', fontWeight: '600', color: '#1e293b' }}>System Logo (Version 1 - Dark)</h3>
                  <div style={{ width: '200px', height: '200px', border: '2px dashed #d1d5db', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto', backgroundColor: '#1f2937', overflow: 'hidden', position: 'relative' }}>
                    {(previewUrls.darkLogo || settings.systemLogo?.dark) ? (
                      <img src={previewUrls.darkLogo || settings.systemLogo?.dark} alt="Dark Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    ) : (
                      <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>
                        <div style={{ fontSize: '48px', marginBottom: '8px' }}>🖼️</div>
                        <div>NEUROLEX_Logo_Dark.png</div>
                      </div>
                    )}
                  </div>
                  <button style={{ width: '100%', backgroundColor: '#22c55e', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }} onClick={() => document.getElementById('dark-logo-input').click()}>Change Image</button>
                  <input id="dark-logo-input" type="file" accept="image/*" onChange={(e) => e.target.files[0] && handleFileUpload('logo', 'dark', e.target.files[0])} style={{ display: 'none' }} />
                </div>
              </div>

              {/* Favicon Section */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                {/* Favicon Light */}
                <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <h3 style={{ margin: '0 0 24px 0', fontSize: '20px', fontWeight: '600', color: '#1e293b' }}>Favicon (Light)</h3>
                  <div style={{ width: '200px', height: '200px', border: '2px dashed #d1d5db', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto', backgroundColor: '#f8fafc', overflow: 'hidden', position: 'relative' }}>
                    {(previewUrls.lightFavicon || settings.favicon?.light) ? (
                      <img src={previewUrls.lightFavicon || settings.favicon?.light} alt="Light Favicon" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    ) : (
                      <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>
                        <div style={{ fontSize: '48px', marginBottom: '8px' }}>🔗</div>
                        <div>NEUROLEX_Favicon_Light.ico</div>
                      </div>
                    )}
                  </div>
                  <button style={{ width: '100%', backgroundColor: '#22c55e', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }} onClick={() => document.getElementById('light-favicon-input').click()}>Change Image</button>
                  <input id="light-favicon-input" type="file" accept="image/*,.ico" onChange={(e) => e.target.files[0] && handleFileUpload('favicon', 'light', e.target.files[0])} style={{ display: 'none' }} />
                </div>

                {/* Favicon Dark */}
                <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <h3 style={{ margin: '0 0 24px 0', fontSize: '20px', fontWeight: '600', color: '#1e293b' }}>Favicon (Dark)</h3>
                  <div style={{ width: '200px', height: '200px', border: '2px dashed #d1d5db', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto', backgroundColor: '#1f2937', overflow: 'hidden', position: 'relative' }}>
                    {(previewUrls.darkFavicon || settings.favicon?.dark) ? (
                      <img src={previewUrls.darkFavicon || settings.favicon?.dark} alt="Dark Favicon" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    ) : (
                      <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>
                        <div style={{ fontSize: '48px', marginBottom: '8px' }}>🔗</div>
                        <div>NEUROLEX_Favicon_Dark.ico</div>
                      </div>
                    )}
                  </div>
                  <button style={{ width: '100%', backgroundColor: '#22c55e', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }} onClick={() => document.getElementById('dark-favicon-input').click()}>Change Image</button>
                  <input id="dark-favicon-input" type="file" accept="image/*,.ico" onChange={(e) => e.target.files[0] && handleFileUpload('favicon', 'dark', e.target.files[0])} style={{ display: 'none' }} />
                </div>
              </div>

              {/* 🆕 ENHANCED: HIRS Management Table with Toggle Functionality */}
              <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '600', color: '#1e293b' }}>Doctor Navigation Menu Control</h2>
                    <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#64748b' }}>
                      Control which features are visible in the doctor sidebar menu ({settings.hirsSettings.length} items)
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                      {settings.hirsSettings.filter(h => h.isActive).length} enabled, {settings.hirsSettings.filter(h => !h.isActive).length} disabled
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
                  {settings.hirsSettings.map((hirs, index) => (
                    <div key={hirs.id} style={{ display: 'grid', gridTemplateColumns: '80px 200px 1fr 150px 120px', gap: '16px', padding: '16px', borderBottom: index < settings.hirsSettings.length - 1 ? '1px solid #f3f4f6' : 'none', alignItems: 'center', backgroundColor: 'white' }}>
                      <div style={{ fontSize: '32px', textAlign: 'center' }}>{hirs.icon}</div>
                      <div style={{ fontWeight: '500', color: '#1f2937' }}>{hirs.name}</div>
                      <div style={{ fontSize: '14px', color: '#6b7280' }}>{hirs.description}</div>
                      <div style={{ fontSize: '14px', color: '#6b7280' }}>{hirs.lastUpdated}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleHirsToggleClick(hirs)}
                          disabled={modalState.isLoading || (hirs.id === 1)} // Dashboard cannot be disabled
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
                
                {/* 🆕 NEW: Feature Summary */}
                <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '12px', height: '12px', backgroundColor: '#22c55e', borderRadius: '50%' }}></div>
                      <span style={{ fontSize: '14px', color: '#374151' }}>
                        {settings.hirsSettings.filter(h => h.isActive).length} Features Enabled
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '12px', height: '12px', backgroundColor: '#dc2626', borderRadius: '50%' }}></div>
                      <span style={{ fontSize: '14px', color: '#374151' }}>
                        {settings.hirsSettings.filter(h => !h.isActive).length} Features Disabled
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

        {/* 🆕 NEW: HIRS Toggle Modal */}
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