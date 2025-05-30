// client/src/context/TenantContext.js - FIXED WITH REAL-TIME UPDATES
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
      console.log('🔄 [TenantContext] Refreshing tenant settings...', { 
        tenantId: currentTenant._id, 
        force,
        lastRefresh: new Date(lastRefresh).toISOString()
      });
      
      // Add cache busting parameter to ensure fresh data
      const cacheBuster = force ? `?t=${Date.now()}` : '';
      
      // 🚨 FIXED: Correct API endpoint path
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
        
        // 🚨 CRITICAL: Update state and force re-render
        setTenantSettings(data.data);
        setLastRefresh(Date.now());
        
        // 🔧 FORCE UPDATE: Make data available globally for debugging
        window.tenantSettings = data.data;
        window.currentTenant = currentTenant;
        
        // 🔧 Update CSS variables immediately when settings change
        updateCSSVariables(data.data);
        
        // 🔔 Dispatch custom event to notify other components
        window.dispatchEvent(new CustomEvent('tenantSettingsRefreshed', {
          detail: { tenantSettings: data.data, timestamp: Date.now() }
        }));
        
      } else {
        console.warn('⚠️ [TenantContext] Failed to refresh tenant settings:', data.message);
      }
    } catch (error) {
      console.error('❌ [TenantContext] Error refreshing tenant settings:', error);
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
      console.log('🔍 [TenantContext] Fetching tenant settings for:', tenantId);
      
      // 🚨 FIXED: Correct API endpoint path with cache busting
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
        
        setTenantSettings(data.data);
        setLastRefresh(Date.now());
        
        // 🔧 FORCE UPDATE: Make data available globally for debugging
        window.tenantSettings = data.data;
        window.currentTenant = currentTenant;
        
        // Apply CSS variables on initial load
        updateCSSVariables(data.data);
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

  // 🚨 ENHANCED: Check if a feature is enabled with better error handling
  const isFeatureEnabled = useCallback((featureName) => {
    console.log('🔍 [DEBUG] isFeatureEnabled called with:', featureName);
    console.log('🔍 [DEBUG] tenantSettings state:', tenantSettings);
    console.log('🔍 [DEBUG] window.tenantSettings (backup):', window.tenantSettings);
    
    // Try both state and window fallback
    const settings = tenantSettings || window.tenantSettings;
    
    if (!settings) {
      console.log('🔍 [DEBUG] No settings available, returning true (default enabled)');
      return true; // Default to enabled if no settings
    }
    
    if (!settings.hirsSettings || !Array.isArray(settings.hirsSettings)) {
      console.log('🔍 [DEBUG] No hirsSettings array, returning true (default enabled)');
      return true;
    }

    // Log all available features
    console.log('🔍 [DEBUG] Available features:', settings.hirsSettings.map(h => ({ 
      id: h.id, 
      name: h.name, 
      isActive: h.isActive 
    })));

    try {
      const feature = settings.hirsSettings.find(
        hirs => hirs.name === featureName || hirs.id === featureName
      );
      
      console.log('🔍 [DEBUG] Found feature for "' + featureName + '":', feature);
      console.log('🔍 [DEBUG] Returning:', feature ? feature.isActive : true);
      
      return feature ? feature.isActive : true;
    } catch (findError) {
      console.error('❌ [DEBUG] Error in find operation:', findError);
      return true; // Default to enabled on error
    }
  }, [tenantSettings]);

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
      }, 100); // Small delay to ensure database is updated
    };

    // Listen for custom events from admin panel
    window.addEventListener('tenantSettingsUpdated', handleSettingsUpdate);
    
    // Also listen for storage events (in case settings are updated in another tab)
    const handleStorageChange = (event) => {
      if (event.key === 'tenantSettingsUpdated') {
        console.log('🔔 [TenantContext] Detected settings update from storage event');
        refreshTenantSettings(true);
      }
      
      // 🆕 NEW: Listen for force refresh signals
      if (event.key === 'forceRefreshTenantSettings') {
        console.log('🔔 [TenantContext] Force refresh signal received');
        const data = JSON.parse(event.newValue || '{}');
        if (data.tenantId === currentTenant?._id) {
          console.log('🔄 [TenantContext] Force refreshing tenant settings...');
          refreshTenantSettings(true);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('tenantSettingsUpdated', handleSettingsUpdate);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [refreshTenantSettings, currentTenant?._id]);

  // 🔄 ENHANCED: More frequent refresh for HIRS settings (every 5 seconds)
  useEffect(() => {
    if (!currentTenant?._id) return;

    const interval = setInterval(() => {
      refreshTenantSettings(false); // Gentle refresh without forcing
    }, 5000); // 5 seconds for faster updates

    return () => clearInterval(interval);
  }, [refreshTenantSettings, currentTenant?._id]);

  // 🚨 NEW: Listen for focus events to refresh when user returns to tab
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
    refreshTenantSettings, // 🔄 NEW: Expose refresh function
    platformName: (tenantSettings || window.tenantSettings)?.platformName || 'NEUROLEX',
    platformDescription: (tenantSettings || window.tenantSettings)?.platformDescription || 'Mental wellness platform'
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
};