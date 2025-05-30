// client/src/context/TenantContext.js - CORRECTED to match your API structure
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const TenantContext = createContext();

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};

export const TenantProvider = ({ children }) => {
  const [currentTenant, setCurrentTenant] = useState(null);
  const [tenantSettings, setTenantSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  // 🔧 SAFE: Get HIRS settings array with defensive programming
  const getHirsSettings = useCallback(() => {
    const settings = tenantSettings || window.tenantSettings;
    if (settings && settings.hirsSettings && Array.isArray(settings.hirsSettings)) {
      return settings.hirsSettings;
    }
    return [];
  }, [tenantSettings]);

  // 🔄 ENHANCED: Force refresh function for real-time updates
  const refreshTenantSettings = useCallback(async (force = false) => {
    if (!currentTenant?._id) return;
    
    try {
      console.log('🔄 [TenantContext] Refreshing tenant settings...', { 
        tenantId: currentTenant._id, 
        force,
        lastRefresh: new Date(lastRefresh).toISOString()
      });
      
      // Add cache busting parameter to ensure fresh data
      const cacheBuster = force ? `?t=${Date.now()}` : '';
      
      // 🚨 KEEP YOUR EXISTING API ENDPOINT
      const response = await fetch(`/api/tenants/${currentTenant._id}/public${cacheBuster}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ [TenantContext] Tenant settings refreshed successfully');
        console.log('🔍 [TenantContext] New HIRS Settings:', data.data.hirsSettings);
        
        // 🔧 SAFE: Ensure hirsSettings is always an array
        const safeTenantSettings = {
          ...data.data,
          hirsSettings: Array.isArray(data.data.hirsSettings) ? data.data.hirsSettings : []
        };
        
        // 🚨 CRITICAL: Update state and force re-render
        setTenantSettings(safeTenantSettings);
        setLastRefresh(Date.now());
        
        // 🔧 FORCE UPDATE: Make data available globally for debugging
        window.tenantSettings = safeTenantSettings;
        window.currentTenant = currentTenant;
        
        // 🔧 Update CSS variables immediately when settings change
        updateCSSVariables(safeTenantSettings);
        
        // 🔔 Dispatch custom event to notify other components
        window.dispatchEvent(new CustomEvent('tenantSettingsRefreshed', {
          detail: { tenantSettings: safeTenantSettings, timestamp: Date.now() }
        }));
        
      } else {
        console.warn('⚠️ [TenantContext] Failed to refresh tenant settings:', data.message);
      }
    } catch (error) {
      console.error('❌ [TenantContext] Error refreshing tenant settings:', error);
    }
  }, [currentTenant?._id, lastRefresh]);

  // 🎨 Update CSS variables for real-time theme changes
  const updateCSSVariables = useCallback((settings) => {
    if (!settings || typeof document === 'undefined') return;
    
    const root = document.documentElement;
    
    // Update color variables
    if (settings.primaryColor) {
      root.style.setProperty('--tenant-primary-color', settings.primaryColor);
      root.style.setProperty('--tenant-primary-rgb', hexToRgb(settings.primaryColor));
    }
    
    if (settings.secondaryColor) {
      root.style.setProperty('--tenant-secondary-color', settings.secondaryColor);
      root.style.setProperty('--tenant-secondary-rgb', hexToRgb(settings.secondaryColor));
    }
    
    // Update favicon in the document head
    if (settings.favicon?.light) {
      updateFavicon(settings.favicon.light);
    }
    
    console.log('🎨 [TenantContext] CSS variables updated with new tenant settings');
  }, []);

  // 🔧 Helper function to convert hex to RGB
  const hexToRgb = (hex) => {
    if (!hex) return '76, 175, 80';
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result 
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
      : '76, 175, 80';
  };

  // 🔧 Helper function to update favicon
  const updateFavicon = (faviconUrl) => {
    if (!faviconUrl || typeof document === 'undefined') return;
    
    try {
      // Remove existing favicon links
      const existingFavicons = document.querySelectorAll('link[rel*="icon"]');
      existingFavicons.forEach(link => link.remove());
      
      // Add new favicon
      const link = document.createElement('link');
      link.type = 'image/x-icon';
      link.rel = 'shortcut icon';
      link.href = faviconUrl + '?v=' + Date.now(); // Cache busting
      document.getElementsByTagName('head')[0].appendChild(link);
      
      console.log('🔗 [TenantContext] Favicon updated:', faviconUrl);
    } catch (error) {
      console.error('❌ [TenantContext] Error updating favicon:', error);
    }
  };

  // Load tenant from storage on mount
  useEffect(() => {
    const loadTenant = () => {
      try {
        const storedTenant = localStorage.getItem('tenant') || sessionStorage.getItem('tenant');
        if (storedTenant) {
          const tenant = JSON.parse(storedTenant);
          setCurrentTenant(tenant);
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error loading tenant:', error);
        setIsLoading(false);
      }
    };

    loadTenant();
  }, []);

  // Fetch tenant settings when currentTenant changes
  useEffect(() => {
    if (currentTenant?._id) {
      fetchTenantSettings(currentTenant._id);
    } else {
      setIsLoading(false);
    }
  }, [currentTenant?._id]);

  const fetchTenantSettings = async (tenantId) => {
    try {
      setIsLoading(true);
      console.log('🔍 [TenantContext] Fetching tenant settings for:', tenantId);
      
      // 🚨 KEEP YOUR EXISTING API ENDPOINT with cache busting
      const response = await fetch(`/api/tenants/${tenantId}/public?t=${Date.now()}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ [TenantContext] Tenant settings loaded successfully');
        console.log('🔍 [TenantContext] HIRS Settings:', data.data.hirsSettings);
        
        // 🔧 SAFE: Ensure hirsSettings is always an array
        const safeTenantSettings = {
          ...data.data,
          hirsSettings: Array.isArray(data.data.hirsSettings) ? data.data.hirsSettings : []
        };
        
        setTenantSettings(safeTenantSettings);
        setLastRefresh(Date.now());
        
        // 🔧 FORCE UPDATE: Make data available globally for debugging
        window.tenantSettings = safeTenantSettings;
        window.currentTenant = currentTenant;
        
        // Apply CSS variables on initial load
        updateCSSVariables(safeTenantSettings);
      } else {
        console.warn('⚠️ [TenantContext] Failed to load tenant settings:', data.message);
      }
    } catch (error) {
      console.error('❌ [TenantContext] Error fetching tenant settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateTenant = (tenant) => {
    setCurrentTenant(tenant);
    if (tenant) {
      fetchTenantSettings(tenant._id);
    } else {
      setTenantSettings(null);
    }
  };

  // 🚨 COMPLETELY FIXED: Check if a feature is enabled with full defensive programming
  const isFeatureEnabled = useCallback((featureName) => {
    try {
      console.log('🔍 [DEBUG] isFeatureEnabled called with:', featureName);
      
      // Try both state and window fallback
      const settings = tenantSettings || window.tenantSettings;
      console.log('🔍 [DEBUG] tenantSettings state:', !!tenantSettings);
      console.log('🔍 [DEBUG] window.tenantSettings (backup):', !!window.tenantSettings);
      
      if (!settings) {
        console.log('🔍 [DEBUG] No settings available, returning true (default enabled)');
        return true; // Default to enabled if no settings
      }
      
      // 🔧 SAFE: Get hirsSettings array defensively
      const hirsArray = getHirsSettings();
      console.log('🔍 [DEBUG] HIRS array length:', hirsArray.length);
      
      if (hirsArray.length === 0) {
        console.log('🔍 [DEBUG] No hirsSettings array, returning true (default enabled)');
        return true;
      }

      // Log all available features for debugging
      console.log('🔍 [DEBUG] Available features:', hirsArray.map(h => ({ 
        id: h.id, 
        name: h.name, 
        isActive: h.isActive 
      })));

      // 🔧 SAFE: Find feature with multiple matching strategies
      let feature = null;
      
      // Strategy 1: Match by name (string)
      if (typeof featureName === 'string') {
        feature = hirsArray.find(hirs => 
          hirs && hirs.name && hirs.name.toLowerCase() === featureName.toLowerCase()
        );
      }
      
      // Strategy 2: Match by ID (number)
      if (!feature && (typeof featureName === 'number' || !isNaN(parseInt(featureName)))) {
        const numericId = typeof featureName === 'number' ? featureName : parseInt(featureName);
        feature = hirsArray.find(hirs => hirs && hirs.id === numericId);
      }
      
      // Strategy 3: Exact match (fallback)
      if (!feature) {
        feature = hirsArray.find(hirs => 
          hirs && (hirs.name === featureName || hirs.id === featureName)
        );
      }
      
      console.log('🔍 [DEBUG] Found feature for "' + featureName + '":', feature);
      
      const isEnabled = feature ? Boolean(feature.isActive) : true;
      console.log('🔍 [DEBUG] Returning isEnabled:', isEnabled);
      
      return isEnabled;
      
    } catch (error) {
      console.error('❌ [DEBUG] Error in isFeatureEnabled:', error);
      return true; // Default to enabled on error
    }
  }, [tenantSettings, getHirsSettings]);

  // 🎨 ENHANCED: Get tenant-specific styling with cache busting
  const getThemeStyles = useCallback(() => {
    const settings = tenantSettings || window.tenantSettings;
    
    if (!settings) {
      return {
        primaryColor: '#4CAF50',
        secondaryColor: '#2196F3',
        logo: null,
        systemLogo: {
          light: null,
          dark: null
        },
        favicon: {
          light: null,
          dark: null
        }
      };
    }

    // Add cache busting to image URLs to ensure fresh images
    const cacheBuster = `?v=${lastRefresh}`;
    
    return {
      primaryColor: settings.primaryColor || '#4CAF50',
      secondaryColor: settings.secondaryColor || '#2196F3',
      logo: settings.systemLogo?.light ? `${settings.systemLogo.light}${cacheBuster}` : null,
      darkLogo: settings.systemLogo?.dark ? `${settings.systemLogo.dark}${cacheBuster}` : null,
      systemLogo: {
        light: settings.systemLogo?.light ? `${settings.systemLogo.light}${cacheBuster}` : null,
        dark: settings.systemLogo?.dark ? `${settings.systemLogo.dark}${cacheBuster}` : null
      },
      favicon: {
        light: settings.favicon?.light ? `${settings.favicon.light}${cacheBuster}` : null,
        dark: settings.favicon?.dark ? `${settings.favicon.dark}${cacheBuster}` : null
      }
    };
  }, [tenantSettings, lastRefresh]);

  // 🔄 ENHANCED: Global event listener for settings updates
  useEffect(() => {
    const handleSettingsUpdate = (event) => {
      console.log('🔔 [TenantContext] Received tenant settings update event:', event.detail);
      // Force immediate refresh when settings are updated
      setTimeout(() => {
        refreshTenantSettings(true);
      }, 500); // Increased delay to ensure database is updated
    };

    // Listen for custom events from admin panel
    window.addEventListener('tenantSettingsUpdated', handleSettingsUpdate);
    
    // Also listen for storage events (in case settings are updated in another tab)
    const handleStorageChange = (event) => {
      if (event.key === 'tenantSettingsUpdated') {
        console.log('🔔 [TenantContext] Detected settings update from storage event');
        setTimeout(() => {
          refreshTenantSettings(true);
        }, 500);
      }
      
      // 🆕 Listen for force refresh signals
      if (event.key === 'forceRefreshTenantSettings') {
        console.log('🔔 [TenantContext] Force refresh signal received');
        try {
          const data = JSON.parse(event.newValue || '{}');
          if (data.tenantId === currentTenant?._id) {
            console.log('🔄 [TenantContext] Force refreshing tenant settings...');
            setTimeout(() => {
              refreshTenantSettings(true);
            }, 1000); // Give more time for database update
          }
        } catch (parseError) {
          console.error('Error parsing force refresh data:', parseError);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);

    // 🆕 Listen for broadcast channel messages
    let broadcastChannel;
    if (window.BroadcastChannel) {
      broadcastChannel = new BroadcastChannel('tenant-settings');
      broadcastChannel.onmessage = (event) => {
        console.log('🔔 [TenantContext] Received broadcast message:', event.data);
        if (event.data.type === 'HIRS_TOGGLE' && event.data.tenantId === currentTenant?._id) {
          console.log('🔄 [TenantContext] HIRS toggle detected, refreshing...');
          setTimeout(() => {
            refreshTenantSettings(true);
          }, 1000);
        }
      };
    }

    return () => {
      window.removeEventListener('tenantSettingsUpdated', handleSettingsUpdate);
      window.removeEventListener('storage', handleStorageChange);
      if (broadcastChannel) {
        broadcastChannel.close();
      }
    };
  }, [refreshTenantSettings, currentTenant?._id]);

  // 🔄 ENHANCED: More frequent refresh for HIRS settings (every 10 seconds)
  useEffect(() => {
    if (!currentTenant?._id) return;

    const interval = setInterval(() => {
      console.log('🔄 [TenantContext] Periodic refresh...');
      refreshTenantSettings(false); // Gentle refresh without forcing
    }, 10000); // 10 seconds for better performance

    return () => clearInterval(interval);
  }, [refreshTenantSettings, currentTenant?._id]);

  // 🚨 Listen for focus events to refresh when user returns to tab
  useEffect(() => {
    const handleFocus = () => {
      console.log('🔍 [TenantContext] Tab focused, refreshing settings...');
      refreshTenantSettings(true);
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refreshTenantSettings]);

  const value = {
    currentTenant,
    tenantSettings,
    isLoading,
    lastRefresh,
    updateTenant,
    isFeatureEnabled,
    getThemeStyles,
    getHirsSettings, // 🆕 Expose the safe getter
    refreshTenantSettings, // 🔄 Expose refresh function
    platformName: (tenantSettings || window.tenantSettings)?.platformName || 'NEUROLEX',
    platformDescription: (tenantSettings || window.tenantSettings)?.platformDescription || 'Mental wellness platform'
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
};