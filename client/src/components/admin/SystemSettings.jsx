import React, { useState, useEffect, useCallback } from 'react';
import adminService from '../../services/adminService';

const SystemSettings = () => {
  // State management
  const [selectedTenant, setSelectedTenant] = useState('');
  const [tenants, setTenants] = useState([]);
  const [isLoadingTenants, setIsLoadingTenants] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  
  // 🎯 NEW: Preview URLs state for immediate image display
  const [previewUrls, setPreviewUrls] = useState({
    lightLogo: '',
    darkLogo: ''
  });
  
  // Settings state - EMPTY by default, filled from API
  const [settings, setSettings] = useState({
    platformName: '',
    platformDescription: '',
    systemLogo: {
      light: null,
      dark: null
    },
    favicon: {
      light: null,
      dark: null
    },
    primaryColor: '',
    secondaryColor: '',
    hirsSettings: []
  });

  // ✅ FIXED: Individual setting save function using adminService
  const saveIndividualSetting = async (settingType, value) => {
    if (!selectedTenant) {
      alert('Please select a clinic first');
      return;
    }

    try {
      console.log(`💾 Saving ${settingType}:`, value);
      
      // Create partial update object
      const updateData = {
        [settingType]: value
      };
      
      // ✅ FIXED: Use adminService instead of fetch
      const data = await adminService.updateIndividualSetting(selectedTenant, updateData);
      
      if (data.success) {
        alert(`✅ ${settingType.replace(/([A-Z])/g, ' $1').toLowerCase()} saved successfully!`);
        console.log(`✅ ${settingType} saved`);
      } else {
        throw new Error(data.message || 'Save failed');
      }
    } catch (error) {
      console.error(`❌ Error saving ${settingType}:`, error);
      alert(`❌ Failed to save ${settingType}: ${error.response?.data?.message || error.message}`);
    }
  };

  // Create default settings if none exist - wrapped in useCallback to fix dependency warning
  const createDefaultTenantSettings = useCallback(async () => {
    try {
      console.log('🔧 Creating default settings for tenant:', selectedTenant);
      
      const defaultSettings = {
        platformName: 'NEUROLEX',
        platformDescription: 'AI-powered mental wellness platform',
        primaryColor: '#4CAF50',
        secondaryColor: '#2196F3',
        hirsSettings: [
          {
            id: 1,
            icon: 'HR',
            name: 'User Dashboard',
            description: 'Controls the displays, names, and icons used by End Users on the Dashboard.',
            lastUpdated: new Date().toLocaleDateString(),
            isActive: true
          },
          {
            id: 2,
            icon: 'JE',
            name: 'Journal Entries',
            description: 'Control what journal prompts are available for users.',
            lastUpdated: new Date().toLocaleDateString(),
            isActive: true
          },
          {
            id: 3,
            icon: 'DR',
            name: 'Mood Tracking-Dr',
            description: 'Set up mood tracking functionality for doctors and patients.',
            lastUpdated: new Date().toLocaleDateString(),
            isActive: true
          },
          {
            id: 4,
            icon: 'MA',
            name: 'Dr Mental Assessments',
            description: 'Mental health assessment tools for healthcare professionals.',
            lastUpdated: new Date().toLocaleDateString(),
            isActive: true
          },
          {
            id: 5,
            icon: 'SM',
            name: 'Stress Managing',
            description: 'Stress management tools and resources.',
            lastUpdated: new Date().toLocaleDateString(),
            isActive: true
          },
          {
            id: 6,
            icon: 'PS',
            name: 'User Profiles',
            description: 'User profile management and customization.',
            lastUpdated: new Date().toLocaleDateString(),
            isActive: true
          },
          {
            id: 7,
            icon: 'NT',
            name: 'Notifications',
            description: 'Push notifications and alert system.',
            lastUpdated: new Date().toLocaleDateString(),
            isActive: true
          },
          {
            id: 8,
            icon: 'DA',
            name: 'Data Analytics',
            description: 'Analytics dashboard and reporting tools.',
            lastUpdated: new Date().toLocaleDateString(),
            isActive: true
          },
          {
            id: 9,
            icon: 'CA',
            name: 'Care / Report',
            description: 'Care management and reporting functionality.',
            lastUpdated: new Date().toLocaleDateString(),
            isActive: true
          },
          {
            id: 10,
            icon: 'CF',
            name: 'Config',
            description: 'System configuration and settings.',
            lastUpdated: new Date().toLocaleDateString(),
            isActive: true
          }
        ]
      };

      // ✅ FIXED: Use adminService instead of fetch
      const data = await adminService.updateTenantSettings(selectedTenant, defaultSettings);
      
      if (data.success) {
        setSettings(defaultSettings);
        console.log('✅ Default settings created successfully');
      } else {
        console.error('❌ Failed to create default settings:', data.message);
        // Set local defaults even if save fails
        setSettings(defaultSettings);
      }
    } catch (error) {
      console.error('❌ Error creating default settings:', error);
      // Set local defaults even if API fails
      setSettings({
        platformName: 'NEUROLEX',
        platformDescription: 'AI-powered mental wellness platform',
        primaryColor: '#4CAF50',
        secondaryColor: '#2196F3',
        hirsSettings: []
      });
    }
  }, [selectedTenant]);

  // Fetch tenant settings - wrapped in useCallback to fix dependency warning
  const fetchTenantSettings = useCallback(async () => {
    if (!selectedTenant) return;

    try {
      setIsLoading(true);
      console.log(`🔍 Fetching settings for tenant: ${selectedTenant}`);
      
      // ✅ FIXED: Use adminService instead of fetch
      const data = await adminService.getTenantSettings(selectedTenant);
      console.log('📊 Tenant settings response:', data);
      
      if (data.success) {
        // Use the fetched data, with fallbacks only if data is missing
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
        
        // 🎯 Set preview URLs from existing data
        setPreviewUrls({
          lightLogo: fetchedSettings.systemLogo?.light || '',
          darkLogo: fetchedSettings.systemLogo?.dark || ''
        });
        
        console.log('✅ Settings loaded successfully');
      } else {
        console.error('❌ Failed to fetch settings:', data.message);
        // If tenant settings don't exist, create default ones
        await createDefaultTenantSettings();
      }
    } catch (error) {
      console.error('❌ Error fetching tenant settings:', error);
      // If API call fails, try to create default settings
      await createDefaultTenantSettings();
    } finally {
      setIsLoading(false);
    }
  }, [selectedTenant, createDefaultTenantSettings]);

  // Load tenants on component mount
  useEffect(() => {
    const fetchTenants = async () => {
      try {
        setIsLoadingTenants(true);
        console.log('🔍 Fetching tenants...');
        
        // ✅ FIXED: Use adminService instead of fetch
        const data = await adminService.getTenants();
        console.log('📊 Tenants response:', data);
        
        if (data.success) {
          setTenants(data.data);
          console.log(`✅ Loaded ${data.data.length} tenants`);
          
          // Auto-select first tenant if only one exists
          if (data.data.length === 1) {
            setSelectedTenant(data.data[0]._id);
          }
        } else {
          console.error('❌ Failed to fetch tenants:', data.message);
          alert('Failed to load clinics: ' + (data.message || 'Unknown error'));
        }
      } catch (error) {
        console.error('❌ Error fetching tenants:', error);
        alert('Failed to load clinics. Please check your connection.');
      } finally {
        setIsLoadingTenants(false);
      }
    };

    fetchTenants();
  }, []);

  // Load settings when tenant is selected - fixed dependency warning
  useEffect(() => {
    if (selectedTenant) {
      fetchTenantSettings();
    }
  }, [selectedTenant, fetchTenantSettings]);

  const handleInputChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 🎯 COMPLETELY FIXED: File upload function with immediate preview
  const handleFileUpload = async (logoType, file) => {
    if (!file) return;
    
    if (!selectedTenant) {
      alert('Please select a clinic first');
      return;
    }

    try {
      setIsUploadingFile(true);
      console.log(`📤 Uploading ${logoType} file:`, {
        name: file.name,
        size: file.size,
        type: file.type
      });
      
      // Validate file before upload
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select an image file');
      }
      
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        throw new Error('File size must be less than 10MB');
      }
      
      const formData = new FormData();
      formData.append('logo', file);
      formData.append('logoType', logoType);
      formData.append('tenantId', selectedTenant);
      
      console.log('🚀 Sending upload request...');
      
      const response = await fetch('/api/admin/upload-logo', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
          // Don't set Content-Type for FormData - browser handles it
        },
        body: formData
      });
      
      console.log('📥 Response status:', response.status);
      
      // Handle different response types
      let data;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        // If we get HTML instead of JSON, it's an error
        const text = await response.text();
        console.error('❌ Received HTML instead of JSON:', text.substring(0, 200));
        throw new Error('Server returned HTML instead of JSON. Check server logs.');
      }
      
      console.log('📊 Upload response:', data);
      
      if (data.success && response.ok) {
        console.log('✅ File uploaded successfully:', data.url);
        
        // 🎯 IMMEDIATE UI UPDATE: Update preview URLs instantly
        const variant = logoType === 'light' ? 'lightLogo' : 'darkLogo';
        setPreviewUrls(prev => ({
          ...prev,
          [variant]: data.url
        }));
        
        // 🎯 Update settings state
        setSettings(prev => ({
          ...prev,
          systemLogo: {
            ...prev.systemLogo,
            [logoType]: data.url
          }
        }));
        
        // ✅ Show success message
        alert('✅ File uploaded successfully!');
        
        // 🎯 Save to database immediately
        try {
          const updateData = {
            systemLogo: {
              ...settings.systemLogo,
              [logoType]: data.url
            }
          };
          
          await adminService.updateIndividualSetting(selectedTenant, updateData);
          console.log('✅ Logo URL saved to database');
        } catch (saveError) {
          console.warn('⚠️ Upload successful but failed to save to database:', saveError);
          // Don't show error to user since upload worked
        }
      } else {
        throw new Error(data.message || 'Upload failed');
      }
      
    } catch (error) {
      console.error('❌ Error uploading file:', error);
      
      let errorMessage = 'Failed to upload file';
      
      if (error.message.includes('HTML instead of JSON')) {
        errorMessage = 'Server configuration error. Please contact administrator.';
      } else if (error.message.includes('Network')) {
        errorMessage = 'Network error. Please check your connection.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert(`❌ Upload failed: ${errorMessage}`);
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleHirsToggle = (hirsId) => {
    setSettings(prev => ({
      ...prev,
      hirsSettings: prev.hirsSettings.map(hirs => 
        hirs.id === hirsId 
          ? { ...hirs, isActive: !hirs.isActive, lastUpdated: new Date().toLocaleDateString() }
          : hirs
      )
    }));
    console.log(`🔄 Toggled HIRS feature ${hirsId}`);
  };

  const saveSettings = async () => {
    if (!selectedTenant) {
      alert('Please select a clinic first');
      return;
    }

    try {
      setIsSaving(true);
      console.log('💾 Saving settings for tenant:', selectedTenant);
      
      // ✅ FIXED: Use adminService instead of fetch
      const data = await adminService.updateTenantSettings(selectedTenant, settings);
      
      if (data.success) {
        alert('✅ Settings saved successfully!');
        console.log('✅ Settings saved successfully');
      } else {
        throw new Error(data.message || 'Save failed');
      }
    } catch (error) {
      console.error('❌ Error saving settings:', error);
      alert(`❌ Failed to save settings: ${error.response?.data?.message || error.message}`);
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

  return (
    <div className="system-settings-container" style={{ 
      fontFamily: 'Arial, sans-serif', 
      backgroundColor: '#f5f5f5', 
      minHeight: '100vh',
      maxHeight: '100vh',
      overflowY: 'auto',
      overflowX: 'hidden'
    }}>
      {/* Header */}
      <div style={{ 
        backgroundColor: 'white', 
        padding: '20px', 
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            style={{ 
              width: '40px', 
              height: '40px', 
              borderRadius: '50%', 
              border: '1px solid #e0e0e0',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: '18px'
            }}
            onClick={() => window.history.back()}
          >
            ←
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>System Settings</h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#666' }}>
              Configure platform settings for each clinic (All data loaded dynamically)
            </p>
          </div>
        </div>
        <button 
          style={{ 
            border: 'none', 
            background: 'none', 
            fontSize: '24px', 
            cursor: 'pointer' 
          }}
          onClick={() => window.history.back()}
        >
          ×
        </button>
      </div>

      <div className="system-settings-content" style={{ 
        padding: '20px', 
        maxWidth: '1024px', 
        margin: '0 auto',
        minHeight: 'calc(100vh - 80px)'
      }}>
        {/* Tenant Selection */}
        <div style={{ 
          backgroundColor: 'white', 
          padding: '24px', 
          borderRadius: '12px', 
          marginBottom: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: '600' }}>Select Clinic</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <select
              value={selectedTenant}
              onChange={(e) => setSelectedTenant(e.target.value)}
              disabled={isLoadingTenants}
              style={{
                padding: '12px 16px',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '16px',
                minWidth: '200px'
              }}
            >
              <option value="">-- Select Clinic --</option>
              {tenants.map(tenant => (
                <option key={tenant._id} value={tenant._id}>
                  {tenant.name}
                </option>
              ))}
            </select>
            {isLoadingTenants && <span style={{ fontSize: '14px', color: '#666' }}>Loading clinics...</span>}
          </div>
        </div>

        {selectedTenant && (
          <>
            {/* Loading State */}
            {isLoading && (
              <div style={{
                backgroundColor: 'white', 
                padding: '60px 24px', 
                borderRadius: '12px',
                textAlign: 'center',
                marginBottom: '24px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
              }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '20px', color: '#333' }}>Loading Settings...</h3>
                <p style={{ margin: 0, color: '#666', fontSize: '16px' }}>
                  Fetching configuration for selected clinic...
                </p>
              </div>
            )}

            {!isLoading && (
              <>
                {/* General Settings */}
                <div style={{ 
                  backgroundColor: 'white', 
                  padding: '24px', 
                  borderRadius: '12px', 
                  marginBottom: '24px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                }}>
                  <h2 style={{ margin: '0 0 24px 0', fontSize: '20px', fontWeight: '600' }}>General Settings</h2>
                  
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Platform Name</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <input
                        type="text"
                        value={settings.platformName}
                        onChange={(e) => handleInputChange('platformName', e.target.value)}
                        placeholder="Enter platform name"
                        style={{
                          flex: 1,
                          padding: '12px 16px',
                          border: '1px solid #e0e0e0',
                          borderRadius: '8px',
                          fontSize: '16px'
                        }}
                      />
                      <button 
                        onClick={() => saveIndividualSetting('platformName', settings.platformName)}
                        style={{
                          backgroundColor: '#4CAF50',
                          color: 'white',
                          border: 'none',
                          padding: '12px 20px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        Save and Update
                      </button>
                    </div>
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Platform Description</label>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <textarea
                        value={settings.platformDescription}
                        onChange={(e) => handleInputChange('platformDescription', e.target.value)}
                        placeholder="Enter platform description"
                        rows={4}
                        style={{
                          flex: 1,
                          padding: '12px 16px',
                          border: '1px solid #e0e0e0',
                          borderRadius: '8px',
                          fontSize: '16px',
                          resize: 'vertical'
                        }}
                      />
                      <button 
                        onClick={() => saveIndividualSetting('platformDescription', settings.platformDescription)}
                        style={{
                          backgroundColor: '#4CAF50',
                          color: 'white',
                          border: 'none',
                          padding: '12px 20px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        Save and Update
                      </button>
                    </div>
                  </div>
                </div>

                {/* Logo Settings - FIXED */}
                <div style={{ 
                  backgroundColor: 'white', 
                  padding: '24px', 
                  borderRadius: '12px', 
                  marginBottom: '24px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                }}>
                  <h2 style={{ margin: '0 0 24px 0', fontSize: '20px', fontWeight: '600' }}>Logo Settings</h2>
                  
                  {isUploadingFile && (
                    <div style={{ 
                      backgroundColor: '#e3f2fd', 
                      padding: '12px 16px', 
                      borderRadius: '8px', 
                      marginBottom: '16px',
                      color: '#1976d2'
                    }}>
                      📤 Uploading file... Please wait.
                    </div>
                  )}
                  
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                    gap: '24px' 
                  }}>
                    {/* Light Logo - FIXED with preview */}
                    <div style={{ textAlign: 'center' }}>
                      <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '500' }}>
                        System Logo (Light)
                      </h3>
                      <div style={{
                        width: '150px',
                        height: '150px',
                        border: '2px dashed #e0e0e0',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px auto',
                        backgroundColor: '#f9f9f9',
                        overflow: 'hidden'
                      }}>
                        {(previewUrls.lightLogo || settings.systemLogo?.light) ? (
                          <img 
                            src={previewUrls.lightLogo || settings.systemLogo.light} 
                            alt="Light Logo" 
                            style={{ 
                              maxWidth: '100%', 
                              maxHeight: '100%', 
                              objectFit: 'contain',
                              borderRadius: '4px'
                            }}
                            onError={(e) => {
                              console.warn('Light logo failed to load:', e.target.src);
                              e.target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <span style={{ fontSize: '48px', color: '#ccc' }}>🔗</span>
                        )}
                      </div>
                      <button 
                        style={{
                          backgroundColor: '#4CAF50',
                          color: 'white',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          opacity: isUploadingFile ? 0.6 : 1
                        }}
                        disabled={isUploadingFile}
                        onClick={() => document.getElementById('light-logo-input').click()}
                      >
                        {isUploadingFile ? 'Uploading...' : 'Change Image'}
                      </button>
                      <input
                        id="light-logo-input"
                        type="file"
                        accept="image/*"
                        onChange={(e) => e.target.files[0] && handleFileUpload('light', e.target.files[0])}
                        style={{ display: 'none' }}
                      />
                    </div>

                    {/* Dark Logo - FIXED with preview */}
                    <div style={{ textAlign: 'center' }}>
                      <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '500' }}>
                        System Logo (Dark)
                      </h3>
                      <div style={{
                        width: '150px',
                        height: '150px',
                        border: '2px dashed #e0e0e0',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px auto',
                        backgroundColor: '#2a2a2a',
                        overflow: 'hidden'
                      }}>
                        {(previewUrls.darkLogo || settings.systemLogo?.dark) ? (
                          <img 
                            src={previewUrls.darkLogo || settings.systemLogo.dark} 
                            alt="Dark Logo" 
                            style={{ 
                              maxWidth: '100%', 
                              maxHeight: '100%', 
                              objectFit: 'contain',
                              borderRadius: '4px'
                            }}
                            onError={(e) => {
                              console.warn('Dark logo failed to load:', e.target.src);
                              e.target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <span style={{ fontSize: '48px', color: '#888' }}>🔗</span>
                        )}
                      </div>
                      <button 
                        style={{
                          backgroundColor: '#4CAF50',
                          color: 'white',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          opacity: isUploadingFile ? 0.6 : 1
                        }}
                        disabled={isUploadingFile}
                        onClick={() => document.getElementById('dark-logo-input').click()}
                      >
                        {isUploadingFile ? 'Uploading...' : 'Change Image'}
                      </button>
                      <input
                        id="dark-logo-input"
                        type="file"
                        accept="image/*"
                        onChange={(e) => e.target.files[0] && handleFileUpload('dark', e.target.files[0])}
                        style={{ display: 'none' }}
                      />
                    </div>
                  </div>
                </div>

                {/* HIRS Management */}
                <div style={{ 
                  backgroundColor: 'white', 
                  padding: '24px', 
                  borderRadius: '12px', 
                  marginBottom: '24px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '24px' 
                  }}>
                    <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
                      HIRS Management ({settings.hirsSettings.length} modules)
                    </h2>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <select style={{
                        padding: '8px 12px',
                        border: '1px solid #e0e0e0',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}>
                        <option>Year - 2025</option>
                        <option>Year - 2024</option>
                      </select>
                      <button style={{
                        backgroundColor: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}>
                        + Add Entry
                      </button>
                    </div>
                  </div>

                  {/* HIRS Table */}
                  <div className="hirs-table-container" style={{ 
                    overflowX: 'auto',
                    overflowY: 'auto',
                    maxHeight: '600px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px'
                  }}>
                    {/* Table Header */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '80px 200px 1fr 150px 120px',
                      gap: '16px',
                      padding: '12px 16px',
                      backgroundColor: '#f8f9fa',
                      fontWeight: '600',
                      fontSize: '14px',
                      position: 'sticky',
                      top: 0,
                      zIndex: 10
                    }}>
                      <div>Icon</div>
                      <div>Function / Menu Name</div>
                      <div>Description</div>
                      <div>Last Updated</div>
                      <div>Actions</div>
                    </div>

                    {/* Table Rows */}
                    {settings.hirsSettings.map((hirs) => (
                      <div 
                        key={hirs.id} 
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '80px 200px 1fr 150px 120px',
                          gap: '16px',
                          padding: '16px',
                          borderBottom: '1px solid #e0e0e0',
                          alignItems: 'center',
                          opacity: hirs.isActive ? 1 : 0.6
                        }}
                      >
                        <div style={{
                          width: '40px',
                          height: '40px',
                          backgroundColor: hirs.isActive ? '#4CAF50' : '#ccc',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}>
                          {hirs.icon}
                        </div>
                        <div style={{ fontWeight: '500' }}>{hirs.name}</div>
                        <div style={{ fontSize: '14px', color: '#666' }}>{hirs.description}</div>
                        <div style={{ fontSize: '14px', color: '#666' }}>{hirs.lastUpdated}</div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            style={{
                              border: 'none',
                              background: 'none',
                              cursor: 'pointer',
                              fontSize: '18px',
                              padding: '4px'
                            }}
                            title="View"
                          >
                            👁️
                          </button>
                          <button 
                            style={{
                              border: 'none',
                              background: 'none',
                              cursor: 'pointer',
                              fontSize: '18px',
                              padding: '4px'
                            }}
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button 
                            style={{
                              border: 'none',
                              background: 'none',
                              cursor: 'pointer',
                              fontSize: '18px',
                              padding: '4px'
                            }}
                            onClick={() => handleHirsToggle(hirs.id)}
                            title={hirs.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {hirs.isActive ? '🟢' : '🔴'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Save/Reset Actions */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'flex-end', 
                  gap: '12px',
                  backgroundColor: 'white',
                  padding: '24px',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                }}>
                  <button 
                    onClick={resetSettings}
                    disabled={isLoading || isSaving}
                    style={{
                      backgroundColor: 'white',
                      color: '#666',
                      border: '1px solid #e0e0e0',
                      padding: '12px 24px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '16px',
                      opacity: (isLoading || isSaving) ? 0.6 : 1
                    }}
                  >
                    Reset Changes
                  </button>
                  <button 
                    onClick={saveSettings}
                    disabled={isLoading || isSaving}
                    style={{
                      backgroundColor: '#4CAF50',
                      color: 'white',
                      border: 'none',
                      padding: '12px 24px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '16px',
                      fontWeight: '500',
                      opacity: (isLoading || isSaving) ? 0.6 : 1
                    }}
                  >
                    {isSaving ? 'Saving...' : 'Save All Settings'}
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {!selectedTenant && !isLoadingTenants && (
          <div style={{ 
            backgroundColor: 'white', 
            padding: '60px 24px', 
            borderRadius: '12px',
            textAlign: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '20px', color: '#333' }}>No Clinic Selected</h3>
            <p style={{ margin: 0, color: '#666', fontSize: '16px' }}>
              Please select a clinic from the dropdown above to configure its settings.
            </p>
            <p style={{ margin: '16px 0 0 0', color: '#999', fontSize: '14px', fontStyle: 'italic' }}>
              All data will be loaded dynamically from your database.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SystemSettings;