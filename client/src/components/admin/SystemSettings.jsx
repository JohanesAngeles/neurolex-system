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

  // Individual setting save function
  const saveIndividualSetting = async (settingType, value) => {
    if (!selectedTenant) {
      alert('Please select a clinic first');
      return;
    }
    try {
      const updateData = { [settingType]: value };
      const data = await adminService.updateIndividualSetting(selectedTenant, updateData);
      if (data.success) {
        alert(`✅ ${settingType.replace(/([A-Z])/g, ' $1').toLowerCase()} saved successfully!`);
      } else {
        throw new Error(data.message || 'Save failed');
      }
    } catch (error) {
      alert(`❌ Failed to save ${settingType}: ${error.response?.data?.message || error.message}`);
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
          { id: 1, icon: 'HR', name: 'User Dashboard', description: 'Controls the displays, names, and icons used by End Users on the Dashboard.', lastUpdated: new Date().toLocaleDateString(), isActive: true },
          { id: 2, icon: 'JE', name: 'Journal Entries', description: 'Control what journal prompts are available for users.', lastUpdated: new Date().toLocaleDateString(), isActive: true },
          { id: 3, icon: 'DR', name: 'Mood Tracking-Dr', description: 'Set up mood tracking functionality for doctors and patients.', lastUpdated: new Date().toLocaleDateString(), isActive: true },
          { id: 4, icon: 'MA', name: 'Dr Mental Assessments', description: 'Mental health assessment tools for healthcare professionals.', lastUpdated: new Date().toLocaleDateString(), isActive: true },
          { id: 5, icon: 'SM', name: 'Stress Managing', description: 'Stress management tools and resources.', lastUpdated: new Date().toLocaleDateString(), isActive: true },
          { id: 6, icon: 'PS', name: 'User Profiles', description: 'User profile management and customization.', lastUpdated: new Date().toLocaleDateString(), isActive: true },
          { id: 7, icon: 'NT', name: 'Notifications', description: 'Push notifications and alert system.', lastUpdated: new Date().toLocaleDateString(), isActive: true },
          { id: 8, icon: 'DA', name: 'Data Analytics', description: 'Analytics dashboard and reporting tools.', lastUpdated: new Date().toLocaleDateString(), isActive: true },
          { id: 9, icon: 'CA', name: 'Care / Report', description: 'Care management and reporting functionality.', lastUpdated: new Date().toLocaleDateString(), isActive: true },
          { id: 10, icon: 'CF', name: 'Config', description: 'System configuration and settings.', lastUpdated: new Date().toLocaleDateString(), isActive: true }
        ]
      };
      const data = await adminService.updateTenantSettings(selectedTenant, defaultSettings);
      if (data.success) {
        setSettings(defaultSettings);
      }
    } catch (error) {
      console.error('Error creating default settings:', error);
    }
  }, [selectedTenant]);

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

  // File upload function for BOTH logos and favicons
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

        setSettings(prev => ({
          ...prev,
          [imageType === 'logo' ? 'systemLogo' : 'favicon']: {
            ...prev[imageType === 'logo' ? 'systemLogo' : 'favicon'],
            [variant]: data.url
          }
        }));

        alert(`✅ ${imageType} uploaded successfully!`);

        // Auto-save
        try {
          const updateData = {
            [imageType === 'logo' ? 'systemLogo' : 'favicon']: {
              ...settings[imageType === 'logo' ? 'systemLogo' : 'favicon'],
              [variant]: data.url
            }
          };
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

  const handleHirsToggle = (hirsId) => {
    setSettings(prev => ({
      ...prev,
      hirsSettings: prev.hirsSettings.map(hirs => 
        hirs.id === hirsId 
          ? { ...hirs, isActive: !hirs.isActive, lastUpdated: new Date().toLocaleDateString() }
          : hirs
      )
    }));
  };

  const saveSettings = async () => {
    if (!selectedTenant) {
      alert('Please select a clinic first');
      return;
    }
    try {
      setIsSaving(true);
      const data = await adminService.updateTenantSettings(selectedTenant, settings);
      if (data.success) {
        alert('✅ Settings saved successfully!');
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

  return (
    <>
      {/* Header */}
      <div className="settings-header">
        <h1>General Settings</h1>
        <p>Configure platform settings for each clinic</p>
      </div>

      <div className="settings-container">
        {/* Tenant Selection */}
        <div className="tenant-selection">
          <h2>Select Clinic</h2>
          <select 
            value={selectedTenant} 
            onChange={(e) => setSelectedTenant(e.target.value)} 
            disabled={isLoadingTenants}
            className="tenant-select"
          >
            <option value="">-- Select Clinic --</option>
            {tenants.map(tenant => (
              <option key={tenant._id} value={tenant._id}>{tenant.name}</option>
            ))}
          </select>
        </div>

        {selectedTenant && !isLoading && (
          <>
            {/* Platform Settings */}
            <div className="platform-settings">
              <div className="setting-field">
                <label>Platform Name</label>
                <div className="input-with-button">
                  <input 
                    type="text" 
                    value={settings.platformName} 
                    onChange={(e) => handleInputChange('platformName', e.target.value)} 
                    placeholder="Enter platform name"
                    className="platform-input"
                  />
                  <button 
                    onClick={() => saveIndividualSetting('platformName', settings.platformName)}
                    className="save-button"
                  >
                    Save and Update
                  </button>
                </div>
              </div>
              
              <div className="setting-field">
                <label>Platform Description</label>
                <div className="textarea-with-button">
                  <textarea 
                    value={settings.platformDescription} 
                    onChange={(e) => handleInputChange('platformDescription', e.target.value)} 
                    placeholder="Enter platform description" 
                    rows={4}
                    className="platform-textarea"
                  />
                  <button 
                    onClick={() => saveIndividualSetting('platformDescription', settings.platformDescription)}
                    className="save-button"
                  >
                    Save and Update
                  </button>
                </div>
              </div>
            </div>

            {/* Logo Section */}
            <div className="logo-section">
              {/* System Logo Light */}
              <div className="logo-card">
                <h3>System Logo (Version 1 - Light)</h3>
                <div className="logo-preview light-preview">
                  {(previewUrls.lightLogo || settings.systemLogo?.light) ? (
                    <img 
                      src={previewUrls.lightLogo || settings.systemLogo?.light} 
                      alt="Light Logo"
                      className="logo-image"
                    />
                  ) : (
                    <div className="logo-placeholder">
                      <div className="placeholder-icon">🖼️</div>
                      <div>NEUROLEX_Logo_Light.png</div>
                    </div>
                  )}
                </div>
                <button 
                  className="change-image-button"
                  onClick={() => document.getElementById('light-logo-input').click()}
                >
                  Change Image
                </button>
                <input 
                  id="light-logo-input" 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => e.target.files[0] && handleFileUpload('logo', 'light', e.target.files[0])}
                  className="file-input-hidden"
                />
              </div>

              {/* System Logo Dark */}
              <div className="logo-card">
                <h3>System Logo (Version 1 - Dark)</h3>
                <div className="logo-preview dark-preview">
                  {(previewUrls.darkLogo || settings.systemLogo?.dark) ? (
                    <img 
                      src={previewUrls.darkLogo || settings.systemLogo?.dark} 
                      alt="Dark Logo"
                      className="logo-image"
                    />
                  ) : (
                    <div className="logo-placeholder">
                      <div className="placeholder-icon">🖼️</div>
                      <div>NEUROLEX_Logo_Dark.png</div>
                    </div>
                  )}
                </div>
                <button 
                  className="change-image-button"
                  onClick={() => document.getElementById('dark-logo-input').click()}
                >
                  Change Image
                </button>
                <input 
                  id="dark-logo-input" 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => e.target.files[0] && handleFileUpload('logo', 'dark', e.target.files[0])}
                  className="file-input-hidden"
                />
              </div>
            </div>

            {/* Favicon Section */}
            <div className="favicon-section">
              {/* Favicon Light */}
              <div className="favicon-card">
                <h3>Favicon (Light)</h3>
                <div className="favicon-preview light-preview">
                  {(previewUrls.lightFavicon || settings.favicon?.light) ? (
                    <img 
                      src={previewUrls.lightFavicon || settings.favicon?.light} 
                      alt="Light Favicon"
                      className="favicon-image"
                    />
                  ) : (
                    <div className="favicon-placeholder">
                      <div className="placeholder-icon">🔗</div>
                      <div>NEUROLEX_Favicon_Light.ico</div>
                    </div>
                  )}
                </div>
                <button 
                  className="change-image-button"
                  onClick={() => document.getElementById('light-favicon-input').click()}
                >
                  Change Image
                </button>
                <input 
                  id="light-favicon-input" 
                  type="file" 
                  accept="image/*,.ico" 
                  onChange={(e) => e.target.files[0] && handleFileUpload('favicon', 'light', e.target.files[0])}
                  className="file-input-hidden"
                />
              </div>

              {/* Favicon Dark */}
              <div className="favicon-card">
                <h3>Favicon (Dark)</h3>
                <div className="favicon-preview dark-preview">
                  {(previewUrls.darkFavicon || settings.favicon?.dark) ? (
                    <img 
                      src={previewUrls.darkFavicon || settings.favicon?.dark} 
                      alt="Dark Favicon"
                      className="favicon-image"
                    />
                  ) : (
                    <div className="favicon-placeholder">
                      <div className="placeholder-icon">🔗</div>
                      <div>NEUROLEX_Favicon_Dark.ico</div>
                    </div>
                  )}
                </div>
                <button 
                  className="change-image-button"
                  onClick={() => document.getElementById('dark-favicon-input').click()}
                >
                  Change Image
                </button>
                <input 
                  id="dark-favicon-input" 
                  type="file" 
                  accept="image/*,.ico" 
                  onChange={(e) => e.target.files[0] && handleFileUpload('favicon', 'dark', e.target.files[0])}
                  className="file-input-hidden"
                />
              </div>
            </div>

            {/* HIRS Management Table */}
            <div className="hirs-management">
              <div className="hirs-header">
                <h2>HIRS Management ({settings.hirsSettings.length} modules)</h2>
                <div className="hirs-controls">
                  <select className="year-select">
                    <option>Year - 2025</option>
                    <option>Year - 2024</option>
                  </select>
                  <button className="add-entry-button">+ Add Entry</button>
                </div>
              </div>

              <div className="hirs-table">
                <div className="table-header">
                  <div>Icon</div>
                  <div>Function / Menu Name</div>
                  <div>Description</div>
                  <div>Last Updated</div>
                  <div>Actions</div>
                </div>
                {settings.hirsSettings.map((hirs, index) => (
                  <div key={hirs.id} className="table-row">
                    <div className={`hirs-icon ${hirs.isActive ? 'active' : 'inactive'}`}>
                      {hirs.icon}
                    </div>
                    <div className="hirs-name">{hirs.name}</div>
                    <div className="hirs-description">{hirs.description}</div>
                    <div className="hirs-updated">{hirs.lastUpdated}</div>
                    <div className="hirs-actions">
                      <button className="action-button" title="View">👁️</button>
                      <button className="action-button" title="Edit">✏️</button>
                      <button 
                        className="action-button" 
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
            <div className="save-actions">
              <button 
                onClick={resetSettings} 
                disabled={isLoading || isSaving}
                className="reset-button"
              >
                Reset Changes
              </button>
              <button 
                onClick={saveSettings} 
                disabled={isLoading || isSaving}
                className="save-all-button"
              >
                {isSaving ? 'Saving...' : 'Save All Settings'}
              </button>
            </div>
          </>
        )}

        {/* Loading and Empty States */}
        {isLoading && (
          <div className="loading-state">
            <h3>Loading Settings...</h3>
            <p>Fetching configuration for selected clinic...</p>
          </div>
        )}

        {!selectedTenant && !isLoadingTenants && (
          <div className="empty-state">
            <h3>No Clinic Selected</h3>
            <p>Please select a clinic from the dropdown above to configure its settings.</p>
          </div>
        )}

        {/* Upload Progress Overlay */}
        {isUploadingFile && (
          <div className="upload-overlay">
            <div className="upload-modal">
              <div className="spinner" />
              <h3>Uploading File...</h3>
              <p>Please wait while we upload your image to Cloudinary</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default SystemSettings;