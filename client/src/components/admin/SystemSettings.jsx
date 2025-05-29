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
  
  // 🎯 ENHANCED: Preview URLs state for ALL image types (Logo + Favicon)
  const [previewUrls, setPreviewUrls] = useState({
    lightLogo: '',
    darkLogo: '',
    lightFavicon: '',
    darkFavicon: ''
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

  // ✅ Individual setting save function using adminService
  const saveIndividualSetting = async (settingType, value) => {
    if (!selectedTenant) {
      alert('Please select a clinic first');
      return;
    }

    try {
      console.log(`💾 Saving ${settingType}:`, value);
      
      const updateData = {
        [settingType]: value
      };
      
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

  // Create default settings if none exist
  const createDefaultTenantSettings = useCallback(async () => {
    try {
      console.log('🔧 Creating default settings for tenant:', selectedTenant);
      
      const defaultSettings = {
        platformName: 'NEUROLEX',
        platformDescription: 'Neurolex is an AI-powered system that uses Natural Language Processing (NLP) to analyze your journal entries and track your emotional well-being. It provides insights into your mental state, helping you understand your thoughts and feelings over time. With continuous monitoring, Neurolex supports your journey toward self-awareness, emotional growth, and overall well-being.',
        primaryColor: '#4CAF50',
        secondaryColor: '#2196F3',
        systemLogo: {
          light: null,
          dark: null
        },
        favicon: {
          light: null,
          dark: null
        },
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

      const data = await adminService.updateTenantSettings(selectedTenant, defaultSettings);
      
      if (data.success) {
        setSettings(defaultSettings);
        console.log('✅ Default settings created successfully');
      } else {
        console.error('❌ Failed to create default settings:', data.message);
        setSettings(defaultSettings);
      }
    } catch (error) {
      console.error('❌ Error creating default settings:', error);
      setSettings({
        platformName: 'NEUROLEX',
        platformDescription: 'AI-powered mental wellness platform',
        primaryColor: '#4CAF50',
        secondaryColor: '#2196F3',
        systemLogo: { light: null, dark: null },
        favicon: { light: null, dark: null },
        hirsSettings: []
      });
    }
  }, [selectedTenant]);

  // Fetch tenant settings
  const fetchTenantSettings = useCallback(async () => {
    if (!selectedTenant) return;

    try {
      setIsLoading(true);
      console.log(`🔍 Fetching settings for tenant: ${selectedTenant}`);
      
      const data = await adminService.getTenantSettings(selectedTenant);
      console.log('📊 Tenant settings response:', data);
      
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
        
        // 🎯 Set preview URLs from existing data (Logo + Favicon)
        setPreviewUrls({
          lightLogo: fetchedSettings.systemLogo?.light || '',
          darkLogo: fetchedSettings.systemLogo?.dark || '',
          lightFavicon: fetchedSettings.favicon?.light || '',
          darkFavicon: fetchedSettings.favicon?.dark || ''
        });
        
        console.log('✅ Settings loaded successfully');
        console.log('🖼️ Initial preview URLs set:', {
          lightLogo: fetchedSettings.systemLogo?.light || 'none',
          darkLogo: fetchedSettings.systemLogo?.dark || 'none',
          lightFavicon: fetchedSettings.favicon?.light || 'none',
          darkFavicon: fetchedSettings.favicon?.dark || 'none'
        });
      } else {
        console.error('❌ Failed to fetch settings:', data.message);
        await createDefaultTenantSettings();
      }
    } catch (error) {
      console.error('❌ Error fetching tenant settings:', error);
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

  // Load settings when tenant is selected
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

  // 🎯 ENHANCED: File upload function for BOTH logos and favicons
  const handleFileUpload = async (imageType, variant, file) => {
    if (!file) return;
    
    if (!selectedTenant) {
      alert('Please select a clinic first');
      return;
    }

    try {
      setIsUploadingFile(true);
      console.log(`📤 Uploading ${imageType} ${variant} file:`, {
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
      
      // Special validation for favicons (should be smaller)
      if (imageType === 'favicon' && file.size > 2 * 1024 * 1024) { // 2MB limit for favicons
        throw new Error('Favicon file size should be less than 2MB');
      }
      
      // 🎯 CREATE IMMEDIATE PREVIEW from file (before upload)
      const fileReader = new FileReader();
      fileReader.onload = (e) => {
        const previewKey = `${variant}${imageType === 'logo' ? 'Logo' : 'Favicon'}`;
        console.log(`🖼️ Setting immediate preview for ${previewKey}:`, e.target.result.substring(0, 50) + '...');
        
        setPreviewUrls(prev => {
          const newUrls = {
            ...prev,
            [previewKey]: e.target.result
          };
          console.log('🎯 Updated preview URLs:', Object.keys(newUrls).reduce((acc, key) => {
            acc[key] = newUrls[key] ? 'SET (BASE64)' : 'NONE';
            return acc;
          }, {}));
          return newUrls;
        });
      };
      fileReader.readAsDataURL(file);
      
      // Create FormData for upload
      const formData = new FormData();
      formData.append('logo', file); // Server expects 'logo' field for all image uploads
      formData.append('logoType', variant); // light or dark
      formData.append('imageType', imageType); // logo or favicon
      formData.append('tenantId', selectedTenant);
      
      console.log('🚀 Sending upload request to /api/admin/upload-logo...');
      console.log('📋 FormData contents:', {
        logo: file.name,
        logoType: variant,
        imageType: imageType,
        tenantId: selectedTenant
      });
      
      const response = await fetch('/api/admin/upload-logo', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: formData
      });
      
      console.log('📥 Response status:', response.status);
      
      // Handle response
      let data;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
        console.log('📊 Upload response:', data);
      } else {
        const text = await response.text();
        console.error('❌ Received non-JSON response:', text.substring(0, 500));
        throw new Error(`Server error: Expected JSON but received ${contentType}. Check server logs.`);
      }
      
      if (data.success && response.ok) {
        console.log('✅ File uploaded successfully:', data.url);
        
        // 🎯 UPDATE PREVIEW with Cloudinary URL
        setTimeout(() => {
          const previewKey = `${variant}${imageType === 'logo' ? 'Logo' : 'Favicon'}`;
          
          setPreviewUrls(prev => {
            const newUrls = {
              ...prev,
              [previewKey]: data.url + '?t=' + Date.now() // Cache buster
            };
            console.log('🔄 Updated to Cloudinary URL:', {
              [previewKey]: data.url
            });
            return newUrls;
          });
        }, 500);
        
        // 🎯 Update settings state
        setSettings(prev => ({
          ...prev,
          [imageType === 'logo' ? 'systemLogo' : 'favicon']: {
            ...prev[imageType === 'logo' ? 'systemLogo' : 'favicon'],
            [variant]: data.url
          }
        }));
        
        // ✅ Show success message
        alert(`✅ ${imageType} uploaded successfully!`);
        
        // 🎯 Auto-save to database
        try {
          const updateData = {
            [imageType === 'logo' ? 'systemLogo' : 'favicon']: {
              ...settings[imageType === 'logo' ? 'systemLogo' : 'favicon'],
              [variant]: data.url
            }
          };
          
          const saveResult = await adminService.updateIndividualSetting(selectedTenant, updateData);
          if (saveResult.success) {
            console.log(`✅ ${imageType} URL saved to database automatically`);
          }
        } catch (saveError) {
          console.warn('⚠️ Upload successful but auto-save failed:', saveError);
        }
      } else {
        throw new Error(data.message || `Upload failed with status ${response.status}`);
      }
      
    } catch (error) {
      console.error('❌ Error uploading file:', error);
      
      let errorMessage = 'Failed to upload file';
      
      if (error.message.includes('Expected JSON but received')) {
        errorMessage = 'Server configuration error. Please contact administrator.';
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (error.message.includes('413')) {
        errorMessage = 'File too large. Please choose a smaller image.';
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
    <div style={{ 
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif', 
      backgroundColor: '#f8fafc', 
      minHeight: '100vh',
      padding: '24px'
    }}>
      {/* Header */}
      <div style={{ 
        backgroundColor: 'white', 
        padding: '24px', 
        borderRadius: '12px',
        marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ 
          margin: 0, 
          fontSize: '28px', 
          fontWeight: '600',
          color: '#1e293b'
        }}>
          General Settings
        </h1>
        <p style={{ 
          margin: '8px 0 0 0', 
          fontSize: '16px', 
          color: '#64748b'
        }}>
          Configure platform settings for each clinic
        </p>
      </div>

      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto'
      }}>
        {/* Tenant Selection */}
        <div style={{ 
          backgroundColor: 'white', 
          padding: '24px', 
          borderRadius: '12px', 
          marginBottom: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ 
            margin: '0 0 16px 0', 
            fontSize: '20px', 
            fontWeight: '600',
            color: '#1e293b'
          }}>
            Select Clinic
          </h2>
          <select
            value={selectedTenant}
            onChange={(e) => setSelectedTenant(e.target.value)}
            disabled={isLoadingTenants}
            style={{
              padding: '12px 16px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '16px',
              minWidth: '300px',
              backgroundColor: 'white'
            }}
          >
            <option value="">-- Select Clinic --</option>
            {tenants.map(tenant => (
              <option key={tenant._id} value={tenant._id}>
                {tenant.name}
              </option>
            ))}
          </select>
        </div>

        {selectedTenant && !isLoading && (
          <>
            {/* Platform Settings */}
            <div style={{ 
              backgroundColor: 'white', 
              padding: '32px', 
              borderRadius: '12px', 
              marginBottom: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <div style={{ marginBottom: '32px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontWeight: '500',
                  fontSize: '16px',
                  color: '#374151'
                }}>
                  Platform Name
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    type="text"
                    value={settings.platformName}
                    onChange={(e) => handleInputChange('platformName', e.target.value)}
                    placeholder="Enter platform name"
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '16px',
                      backgroundColor: '#f8fafc'
                    }}
                  />
                  <button 
                    onClick={() => saveIndividualSetting('platformName', settings.platformName)}
                    style={{
                      backgroundColor: '#22c55e',
                      color: 'white',
                      border: 'none',
                      padding: '12px 20px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                  >
                    Save and Update
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '32px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontWeight: '500',
                  fontSize: '16px',
                  color: '#374151'
                }}>
                  Platform Description
                </label>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <textarea
                    value={settings.platformDescription}
                    onChange={(e) => handleInputChange('platformDescription', e.target.value)}
                    placeholder="Enter platform description"
                    rows={4}
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '16px',
                      resize: 'vertical',
                      backgroundColor: '#f8fafc',
                      fontFamily: 'inherit'
                    }}
                  />
                  <button 
                    onClick={() => saveIndividualSetting('platformDescription', settings.platformDescription)}
                    style={{
                      backgroundColor: '#22c55e',
                      color: 'white',
                      border: 'none',
                      padding: '12px 20px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                  >
                    Save and Update
                  </button>
                </div>
              </div>
            </div>

            {/* Logo and Favicon Upload Section - MATCHES FIGMA */}
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '24px',
              marginBottom: '24px'
            }}>
              {/* System Logo Section */}
              <div style={{ 
                backgroundColor: 'white', 
                padding: '32px', 
                borderRadius: '12px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <h3 style={{
                  margin: '0 0 24px 0',
                  fontSize: '20px',
                  fontWeight: '600',
                  color: '#1e293b'
                }}>
                  System Logo (Version 1 - Light)
                </h3>
                
                <div style={{
                  width: '200px',
                  height: '200px',
                  border: '2px dashed #d1d5db',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px auto',
                  backgroundColor: '#f8fafc',
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  {(previewUrls.lightLogo || settings.systemLogo?.light) ? (
                    <img 
                      src={previewUrls.lightLogo || settings.systemLogo?.light} 
                      alt="Light Logo" 
                      style={{ 
                        maxWidth: '100%', 
                        maxHeight: '100%', 
                        objectFit: 'contain'
                      }}
                    />
                  ) : (
                    <div style={{ 
                      textAlign: 'center', 
                      color: '#9ca3af',
                      fontSize: '14px'
                    }}>
                      <div style={{ fontSize: '48px', marginBottom: '8px' }}>🖼️</div>
                      <div>NEUROLEX_Logo_Light.png</div>
                    </div>
                  )}
                </div>
                
                <button 
                  style={{
                    width: '100%',
                    backgroundColor: '#22c55e',
                    color: 'white',
                    border: 'none',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                  onClick={() => document.getElementById('light-logo-input').click()}
                >
                  Change Image
                </button>
                <input
                  id="light-logo-input"
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files[0] && handleFileUpload('logo', 'light', e.target.files[0])}
                  style={{ display: 'none' }}
                />
              </div>

              {/* System Logo Dark */}
              <div style={{ 
                backgroundColor: 'white', 
                padding: '32px', 
                borderRadius: '12px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <h3 style={{
                  margin: '0 0 24px 0',
                  fontSize: '20px',
                  fontWeight: '600',
                  color: '#1e293b'
                }}>
                  System Logo (Version 1 - Dark)
                </h3>
                
                <div style={{
                  width: '200px',
                  height: '200px',
                  border: '2px dashed #d1d5db',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px auto',
                  backgroundColor: '#1f2937',
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  {(previewUrls.darkLogo || settings.systemLogo?.dark) ? (
                    <img 
                      src={previewUrls.darkLogo || settings.systemLogo?.dark} 
                      alt="Dark Logo" 
                      style={{ 
                        maxWidth: '100%', 
                        maxHeight: '100%', 
                        objectFit: 'contain'
                      }}
                    />
                  ) : (
                    <div style={{ 
                      textAlign: 'center', 
                      color: '#9ca3af',
                      fontSize: '14px'
                    }}>
                      <div style={{ fontSize: '48px', marginBottom: '8px' }}>🖼️</div>
                      <div>NEUROLEX_Logo_Dark.png</div>
                    </div>
                  )}
                </div>
                
                <button 
                  style={{
                    width: '100%',
                    backgroundColor: '#22c55e',
                    color: 'white',
                    border: 'none',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                  onClick={() => document.getElementById('dark-logo-input').click()}
                >
                  Change Image
                </button>
                <input
                  id="dark-logo-input"
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files[0] && handleFileUpload('logo', 'dark', e.target.files[0])}
                  style={{ display: 'none' }}
                />
              </div>
            </div>

            {/* Favicon Section - NEW */}
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '24px',
              marginBottom: '24px'
            }}>
              {/* Favicon Light */}
              <div style={{ 
                backgroundColor: 'white', 
                padding: '32px', 
                borderRadius: '12px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <h3 style={{
                  margin: '0 0 24px 0',
                  fontSize: '20px',
                  fontWeight: '600',
                  color: '#1e293b'
                }}>
                  Favicon (Light)
                </h3>
                
                <div style={{
                  width: '200px',
                  height: '200px',
                  border: '2px dashed #d1d5db',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px auto',
                  backgroundColor: '#f8fafc',
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  {(previewUrls.lightFavicon || settings.favicon?.light) ? (
                    <img 
                      src={previewUrls.lightFavicon || settings.favicon?.light} 
                      alt="Light Favicon" 
                      style={{ 
                        maxWidth: '100%', 
                        maxHeight: '100%', 
                        objectFit: 'contain'
                      }}
                    />
                  ) : (
                    <div style={{ 
                      textAlign: 'center', 
                      color: '#9ca3af',
                      fontSize: '14px'
                    }}>
                      <div style={{ fontSize: '48px', marginBottom: '8px' }}>🔗</div>
                      <div>NEUROLEX_Favicon_Light.ico</div>
                    </div>
                  )}
                </div>
                
                <button 
                  style={{
                    width: '100%',
                    backgroundColor: '#22c55e',
                    color: 'white',
                    border: 'none',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                  onClick={() => document.getElementById('light-favicon-input').click()}
                >
                  Change Image
                </button>
                <input
                  id="light-favicon-input"
                  type="file"
                  accept="image/*,.ico"
                  onChange={(e) => e.target.files[0] && handleFileUpload('favicon', 'light', e.target.files[0])}
                  style={{ display: 'none' }}
                />
              </div>

              {/* Favicon Dark */}
              <div style={{ 
                backgroundColor: 'white', 
                padding: '32px', 
                borderRadius: '12px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <h3 style={{
                  margin: '0 0 24px 0',
                  fontSize: '20px',
                  fontWeight: '600',
                  color: '#1e293b'
                }}>
                  Favicon (Dark)
                </h3>
                
                <div style={{
                  width: '200px',
                  height: '200px',
                  border: '2px dashed #d1d5db',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px auto',
                  backgroundColor: '#1f2937',
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  {(previewUrls.darkFavicon || settings.favicon?.dark) ? (
                    <img 
                      src={previewUrls.darkFavicon || settings.favicon?.dark} 
                      alt="Dark Favicon" 
                      style={{ 
                        maxWidth: '100%', 
                        maxHeight: '100%', 
                        objectFit: 'contain'
                      }}
                    />
                  ) : (
                    <div style={{ 
                      textAlign: 'center', 
                      color: '#9ca3af',
                      fontSize: '14px'
                    }}>
                      <div style={{ fontSize: '48px', marginBottom: '8px' }}>🔗</div>
                      <div>NEUROLEX_Favicon_Dark.ico</div>
                    </div>
                  )}
                </div>
                
                <button 
                  style={{
                    width: '100%',
                    backgroundColor: '#22c55e',
                    color: 'white',
                    border: 'none',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                  onClick={() => document.getElementById('dark-favicon-input').click()}
                >
                  Change Image
                </button>
                <input
                  id="dark-favicon-input"
                  type="file"
                  accept="image/*,.ico"
                  onChange={(e) => e.target.files[0] && handleFileUpload('favicon', 'dark', e.target.files[0])}
                  style={{ display: 'none' }}
                />
              </div>
            </div>

            {/* HIRS Management Table */}
            <div style={{ 
              backgroundColor: 'white', 
              padding: '32px', 
              borderRadius: '12px', 
              marginBottom: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '24px' 
              }}>
                <h2 style={{ 
                  margin: 0, 
                  fontSize: '24px', 
                  fontWeight: '600',
                  color: '#1e293b'
                }}>
                  HIRS Management ({settings.hirsSettings.length} modules)
                </h2>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <select style={{
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    backgroundColor: 'white'
                  }}>
                    <option>Year - 2025</option>
                    <option>Year - 2024</option>
                  </select>
                  <button style={{
                    backgroundColor: '#22c55e',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}>
                    + Add Entry
                  </button>
                </div>
              </div>

              {/* Table */}
              <div style={{ 
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                overflow: 'hidden'
              }}>
                {/* Table Header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '80px 200px 1fr 150px 120px',
                  gap: '16px',
                  padding: '16px',
                  backgroundColor: '#f9fafb',
                  fontWeight: '600',
                  fontSize: '14px',
                  color: '#374151',
                  borderBottom: '1px solid #e5e7eb'
                }}>
                  <div>Icon</div>
                  <div>Function / Menu Name</div>
                  <div>Description</div>
                  <div>Last Updated</div>
                  <div>Actions</div>
                </div>

                {/* Table Rows */}
                {settings.hirsSettings.map((hirs, index) => (
                  <div 
                    key={hirs.id} 
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '80px 200px 1fr 150px 120px',
                      gap: '16px',
                      padding: '16px',
                      borderBottom: index < settings.hirsSettings.length - 1 ? '1px solid #f3f4f6' : 'none',
                      alignItems: 'center',
                      backgroundColor: 'white'
                    }}
                  >
                    <div style={{
                      width: '40px',
                      height: '40px',
                      backgroundColor: hirs.isActive ? '#22c55e' : '#9ca3af',
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
                    <div style={{ 
                      fontWeight: '500',
                      color: '#1f2937'
                    }}>
                      {hirs.name}
                    </div>
                    <div style={{ 
                      fontSize: '14px', 
                      color: '#6b7280'
                    }}>
                      {hirs.description}
                    </div>
                    <div style={{ 
                      fontSize: '14px', 
                      color: '#6b7280'
                    }}>
                      {hirs.lastUpdated}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        style={{
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                          fontSize: '18px',
                          padding: '4px',
                          borderRadius: '4px'
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
                          padding: '4px',
                          borderRadius: '4px'
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
                          padding: '4px',
                          borderRadius: '4px'
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

            {/* Save Actions */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'flex-end', 
              gap: '12px',
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <button 
                onClick={resetSettings}
                disabled={isLoading || isSaving}
                style={{
                  backgroundColor: 'white',
                  color: '#6b7280',
                  border: '1px solid #d1d5db',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '500',
                  opacity: (isLoading || isSaving) ? 0.6 : 1
                }}
              >
                Reset Changes
              </button>
              <button 
                onClick={saveSettings}
                disabled={isLoading || isSaving}
                style={{
                  backgroundColor: '#22c55e',
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

        {/* Loading State */}
        {isLoading && (
          <div style={{
            backgroundColor: 'white', 
            padding: '60px 24px', 
            borderRadius: '12px',
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ 
              margin: '0 0 16px 0', 
              fontSize: '20px', 
              color: '#1e293b' 
            }}>
              Loading Settings...
            </h3>
            <p style={{ 
              margin: 0, 
              color: '#64748b', 
              fontSize: '16px' 
            }}>
              Fetching configuration for selected clinic...
            </p>
          </div>
        )}

        {/* No Tenant Selected */}
        {!selectedTenant && !isLoadingTenants && (
          <div style={{ 
            backgroundColor: 'white', 
            padding: '60px 24px', 
            borderRadius: '12px',
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ 
              margin: '0 0 16px 0', 
              fontSize: '20px', 
              color: '#1e293b' 
            }}>
              No Clinic Selected
            </h3>
            <p style={{ 
              margin: 0, 
              color: '#64748b', 
              fontSize: '16px' 
            }}>
              Please select a clinic from the dropdown above to configure its settings.
            </p>
          </div>
        )}

        {/* Upload Progress Overlay */}
        {isUploadingFile && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              backgroundColor: 'white',
              padding: '32px',
              borderRadius: '12px',
              textAlign: 'center',
              minWidth: '300px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                border: '4px solid #f3f4f6',
                borderTop: '4px solid #22c55e',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 16px auto'
              }} />
              <h3 style={{
                margin: '0 0 8px 0',
                fontSize: '18px',
                color: '#1e293b'
              }}>
                Uploading File...
              </h3>
              <p style={{
                margin: 0,
                color: '#64748b',
                fontSize: '14px'
              }}>
                Please wait while we upload your image to Cloudinary
              </p>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default SystemSettings;