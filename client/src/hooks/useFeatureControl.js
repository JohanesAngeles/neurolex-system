// client/src/hooks/useFeatureControl.js
import { useTenant } from '../context/TenantContext';

export const useFeatureControl = () => {
  const { isFeatureEnabled, tenantSettings } = useTenant();

  // Define feature mappings
  const FEATURES = {
    USER_DASHBOARD: 'User Dashboard',
    JOURNAL_ENTRIES: 'Journal Entries', 
    MOOD_TRACKING: 'Mood Tracking-Dr',
    MENTAL_ASSESSMENTS: 'Dr Mental Assessments',
    STRESS_MANAGING: 'Stress Managing',
    USER_PROFILES: 'User Profiles',
    NOTIFICATIONS: 'Notifications',
    DATA_ANALYTICS: 'Data Analytics',
    CARE_REPORTS: 'Care / Report',
    CONFIG: 'Config'
  };

  return {
    // Individual feature checks
    canAccessDashboard: () => isFeatureEnabled(FEATURES.USER_DASHBOARD),
    canAccessJournal: () => isFeatureEnabled(FEATURES.JOURNAL_ENTRIES),
    canAccessMoodTracking: () => isFeatureEnabled(FEATURES.MOOD_TRACKING),
    canAccessAssessments: () => isFeatureEnabled(FEATURES.MENTAL_ASSESSMENTS),
    canAccessStressManaging: () => isFeatureEnabled(FEATURES.STRESS_MANAGING),
    canAccessProfiles: () => isFeatureEnabled(FEATURES.USER_PROFILES),
    canAccessNotifications: () => isFeatureEnabled(FEATURES.NOTIFICATIONS),
    canAccessAnalytics: () => isFeatureEnabled(FEATURES.DATA_ANALYTICS),
    canAccessReports: () => isFeatureEnabled(FEATURES.CARE_REPORTS),
    canAccessConfig: () => isFeatureEnabled(FEATURES.CONFIG),
    
    // General feature check
    isFeatureEnabled,
    
    // Get all active features
    getActiveFeatures: () => {
      if (!tenantSettings?.hirsSettings) return [];
      return tenantSettings.hirsSettings.filter(hirs => hirs.isActive);
    },
    
    // Get disabled features
    getDisabledFeatures: () => {
      if (!tenantSettings?.hirsSettings) return [];
      return tenantSettings.hirsSettings.filter(hirs => !hirs.isActive);
    }
  };
};