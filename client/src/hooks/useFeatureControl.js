// client/src/hooks/useFeatureControl.js - Updated for simplified menu
import { useTenant } from '../context/TenantContext';

export const useFeatureControl = () => {
  const { isFeatureEnabled, tenantSettings } = useTenant();

  // 🔄 UPDATED: Define feature mappings to match doctor sidebar menu
  const FEATURES = {
    DASHBOARD: 'Dashboard',
    PATIENTS: 'Patients', 
    PATIENT_JOURNAL: 'Patient Journal Management',
    JOURNAL_TEMPLATES: 'Journal Template Management',
    APPOINTMENTS: 'Appointments',
    MESSAGES: 'Messages'
  };

  return {
    // 🔄 UPDATED: Individual feature checks for actual menu items
    canAccessDashboard: () => isFeatureEnabled(FEATURES.DASHBOARD),
    canAccessPatients: () => isFeatureEnabled(FEATURES.PATIENTS),
    canAccessPatientJournal: () => isFeatureEnabled(FEATURES.PATIENT_JOURNAL),
    canAccessJournalTemplates: () => isFeatureEnabled(FEATURES.JOURNAL_TEMPLATES),
    canAccessAppointments: () => isFeatureEnabled(FEATURES.APPOINTMENTS),
    canAccessMessages: () => isFeatureEnabled(FEATURES.MESSAGES),
    
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
    },

    // 🆕 NEW: Get feature count for admin dashboard
    getFeatureStats: () => {
      if (!tenantSettings?.hirsSettings) return { total: 0, active: 0, disabled: 0 };
      
      const total = tenantSettings.hirsSettings.length;
      const active = tenantSettings.hirsSettings.filter(hirs => hirs.isActive).length;
      const disabled = total - active;
      
      return { total, active, disabled };
    }
  };
};