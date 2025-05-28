// client/src/contexts/TenantContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';

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

  // Load tenant from storage on mount
  useEffect(() => {
    const loadTenant = () => {
      try {
        const storedTenant = localStorage.getItem('tenant') || sessionStorage.getItem('tenant');
        if (storedTenant) {
          const tenant = JSON.parse(storedTenant);
          setCurrentTenant(tenant);
          fetchTenantSettings(tenant._id);
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

  const fetchTenantSettings = async (tenantId) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/tenant-settings/public/${tenantId}`);
      const data = await response.json();
      
      if (data.success) {
        setTenantSettings(data.data);
      }
    } catch (error) {
      console.error('Error fetching tenant settings:', error);
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

  // Get tenant-specific styling
  const getThemeStyles = () => {
    if (!tenantSettings) {
      return {
        primaryColor: '#4CAF50',
        secondaryColor: '#2196F3',
        logo: '/default-logo.png'
      };
    }

    return {
      primaryColor: tenantSettings.primaryColor || '#4CAF50',
      secondaryColor: tenantSettings.secondaryColor || '#2196F3',
      logo: tenantSettings.systemLogo?.light || '/default-logo.png',
      darkLogo: tenantSettings.systemLogo?.dark || '/default-logo.png',
      favicon: tenantSettings.favicon?.light || '/default-favicon.ico'
    };
  };

  const value = {
    currentTenant,
    tenantSettings,
    isLoading,
    updateTenant,
    isFeatureEnabled,
    getThemeStyles,
    platformName: tenantSettings?.platformName || 'NEUROLEX',
    platformDescription: tenantSettings?.platformDescription || 'Mental wellness platform'
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
};