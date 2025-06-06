// client/src/context/TenantContext.js
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

  // 🔄 ENHANCED: Force refresh function for real-time updates
  const refreshTenantSettings = useCallback(async (force = false) => {
    if (!currentTenant?._id) return;
    
    try {
      console.log('🔄 Refreshing tenant settings...', { 
        tenantId: currentTenant._id, 
        force,
        lastRefresh: new Date(lastRefresh).toISOString()
      });
      
      // Add cache busting parameter to ensure fresh data
      const cacheBuster = force ? `?t=${Date.now()}` : '';
      const response = await fetch(`/api/tenant-settings/public/${currentTenant._id}${cacheBuster}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Tenant settings refreshed successfully');
        setTenantSettings(data.data);
        setLastRefresh(Date.now());
        
        // 🔧 Update CSS variables immediately when settings change
        updateCSSVariables(data.data);
      } else {
        console.warn('⚠️ Failed to refresh tenant settings:', data.message);
      }
    } catch (error) {
      console.error('❌ Error refreshing tenant settings:', error);
    }
  }, [currentTenant?._id, lastRefresh]);

  // 🎨 NEW: Update CSS variables for real-time theme changes
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
    
    console.log('🎨 CSS variables updated with new tenant settings');
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
      
      console.log('🔗 Favicon updated:', faviconUrl);
    } catch (error) {
      console.error('❌ Error updating favicon:', error);
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
          // Don't call fetchTenantSettings here, it will be called by the effect below
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
      console.log('🔍 Fetching tenant settings for:', tenantId);
      
      const response = await fetch(`/api/tenant-settings/public/${tenantId}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Tenant settings loaded successfully');
        setTenantSettings(data.data);
        setLastRefresh(Date.now());
        
        // Apply CSS variables on initial load
        updateCSSVariables(data.data);
      } else {
        console.warn('⚠️ Failed to load tenant settings:', data.message);
      }
    } catch (error) {
      console.error('❌ Error fetching tenant settings:', error);
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

  // Check if a feature is enabled for current tenant
  const isFeatureEnabled = (featureName) => {
    if (!tenantSettings || !tenantSettings.hirsSettings) {
      return true; // Default to enabled if no settings
    }

    const feature = tenantSettings.hirsSettings.find(
      hirs => hirs.name === featureName || hirs.id === featureName
    );
    
    return feature ? feature.isActive : true;
  };

  // 🎨 ENHANCED: Get tenant-specific styling with cache busting
  const getThemeStyles = () => {
    if (!tenantSettings) {
      return {
        primaryColor: '#4CAF50',
        secondaryColor: '#2196F3',
        logo: '/default-logo.png',
        systemLogo: {
          light: '/default-logo.png',
          dark: '/default-logo-dark.png'
        },
        favicon: {
          light: '/default-favicon.ico',
          dark: '/default-favicon-dark.ico'
        }
      };
    }

    // Add cache busting to image URLs to ensure fresh images
    const cacheBuster = `?v=${lastRefresh}`;
    
    return {
      primaryColor: tenantSettings.primaryColor || '#4CAF50',
      secondaryColor: tenantSettings.secondaryColor || '#2196F3',
      logo: tenantSettings.systemLogo?.light ? `${tenantSettings.systemLogo.light}${cacheBuster}` : '/default-logo.png',
      darkLogo: tenantSettings.systemLogo?.dark ? `${tenantSettings.systemLogo.dark}${cacheBuster}` : '/default-logo-dark.png',
      systemLogo: {
        light: tenantSettings.systemLogo?.light ? `${tenantSettings.systemLogo.light}${cacheBuster}` : '/default-logo.png',
        dark: tenantSettings.systemLogo?.dark ? `${tenantSettings.systemLogo.dark}${cacheBuster}` : '/default-logo-dark.png'
      },
      favicon: {
        light: tenantSettings.favicon?.light ? `${tenantSettings.favicon.light}${cacheBuster}` : '/default-favicon.ico',
        dark: tenantSettings.favicon?.dark ? `${tenantSettings.favicon.dark}${cacheBuster}` : '/default-favicon-dark.ico'
      }
    };
  };

  // 🔄 NEW: Global event listener for settings updates
  useEffect(() => {
    const handleSettingsUpdate = (event) => {
      console.log('🔔 Received tenant settings update event:', event.detail);
      refreshTenantSettings(true); // Force refresh
    };

    // Listen for custom events from admin panel
    window.addEventListener('tenantSettingsUpdated', handleSettingsUpdate);
    
    // Also listen for storage events (in case settings are updated in another tab)
    const handleStorageChange = (event) => {
      if (event.key === 'tenantSettingsUpdated') {
        console.log('🔔 Detected settings update from storage event');
        refreshTenantSettings(true);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('tenantSettingsUpdated', handleSettingsUpdate);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [refreshTenantSettings]);

  // 🔄 NEW: Periodic refresh for settings (every 30 seconds)
  useEffect(() => {
    if (!currentTenant?._id) return;

    const interval = setInterval(() => {
      refreshTenantSettings(false); // Gentle refresh without forcing
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [refreshTenantSettings, currentTenant?._id]);

  const value = {
    currentTenant,
    tenantSettings,
    isLoading,
    lastRefresh,
    updateTenant,
    isFeatureEnabled,
    getThemeStyles,
    refreshTenantSettings, // 🔄 NEW: Expose refresh function
    platformName: tenantSettings?.platformName || 'NEUROLEX',
    platformDescription: tenantSettings?.platformDescription || 'Mental wellness platform'
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
};