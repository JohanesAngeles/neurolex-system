// server/src/models/master/Tenant.js
const mongoose = require('mongoose');

// 🆕 HIRS Settings Schema
const hirsSettingSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true
  },
  icon: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  lastUpdated: {
    type: String,
    default: () => new Date().toLocaleDateString()
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

const TenantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  // Database name for this tenant
  dbName: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  // Tenant status
  active: {
    type: Boolean,
    default: true
  },
  // Branding configuration
  logoUrl: {
    type: String,
    default: '/logo.svg'
  },
  darkLogoUrl: {
    type: String,
    default: null
  },
  faviconUrl: {
    type: String,
    default: null
  },
  darkFaviconUrl: {
    type: String,
    default: null
  },
  primaryColor: {
    type: String,
    default: '#1e3a8a' // Default Neurolex blue
  },
  secondaryColor: {
    type: String,
    default: '#f3f4f6' // Light gray
  },
  description: {
    type: String,
    default: 'AI-powered mental wellness platform'
  },
  // 🆕 HIRS feature management
  hirsSettings: {
    type: [hirsSettingSchema],
    default: [
      {
        id: 1,
        icon: '📊',
        name: 'Dashboard',
        description: 'Main dashboard overview for doctors.',
        lastUpdated: new Date().toLocaleDateString(),
        isActive: true
      },
      {
        id: 2,
        icon: '👥',
        name: 'Patients',
        description: 'Patient management and list view.',
        lastUpdated: new Date().toLocaleDateString(),
        isActive: true
      },
      {
        id: 3,
        icon: '📖',
        name: 'Patient Journal Management',
        description: 'View and manage patient journal entries.',
        lastUpdated: new Date().toLocaleDateString(),
        isActive: true
      },
      {
        id: 4,
        icon: '📝',
        name: 'Journal Template Management',
        description: 'Create and manage journal templates for patients.',
        lastUpdated: new Date().toLocaleDateString(),
        isActive: true
      },
      {
        id: 5,
        icon: '📅',
        name: 'Appointments',
        description: 'Schedule and manage appointments with patients.',
        lastUpdated: new Date().toLocaleDateString(),
        isActive: true
      },
      {
        id: 6,
        icon: '💬',
        name: 'Messages',
        description: 'Secure messaging with patients.',
        lastUpdated: new Date().toLocaleDateString(),
        isActive: true
      }
    ]
  },
  // Admin user for this tenant
  adminEmail: {
    type: String,
    required: true
  },
  // Contact information
  contactPhone: String,
  contactEmail: String,
  address: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
TenantSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// This model will be created using the master connection
module.exports = TenantSchema;