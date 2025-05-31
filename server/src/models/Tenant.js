// server/src/models/master/Tenant.js - UPDATED WITH NEW FIELDS
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
  // 🆕 NEW: Auto-generated tenant ID (NLX-YYYY-###)
  tenantId: {
    type: String,
    unique: true,
    sparse: true, // Allows null values while maintaining uniqueness for non-null values
    trim: true
  },
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
  // 🆕 NEW: Clinic location
  location: {
    type: String,
    required: true,
    trim: true
  },
  // Tenant status
  active: {
    type: Boolean,
    default: true
  },
  // 🆕 NEW: Database creation status
  databaseCreated: {
    type: Boolean,
    default: false
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
    default: '#4CAF50' // Updated to match your frontend theme
  },
  secondaryColor: {
    type: String,
    default: '#2196F3' // Updated to match your frontend theme
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
    required: true,
    trim: true,
    lowercase: true, // Normalize email to lowercase
    validate: {
      validator: function(email) {
        // Email validation regex
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      },
      message: 'Please enter a valid email address'
    }
  },
  // Contact information
  contactPhone: {
    type: String,
    trim: true
  },
  contactEmail: {
    type: String,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(email) {
        // Only validate if email is provided (it's optional)
        if (!email) return true;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      },
      message: 'Please enter a valid contact email address'
    }
  },
  // 🆕 UPDATED: Changed from 'address' to better structure
  address: {
    type: String,
    trim: true
  },
  // 🆕 NEW: Additional metadata for better tracking
  createdBy: {
    type: String,
    default: 'System Admin'
  },
  lastModifiedBy: {
    type: String,
    default: 'System Admin'
  },
  // 🆕 NEW: Tenant settings for configuration
  settings: {
    allowRegistration: {
      type: Boolean,
      default: true
    },
    maxUsers: {
      type: Number,
      default: 1000
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    language: {
      type: String,
      default: 'en'
    }
  },
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  // Schema options
  timestamps: true, // Automatically manage createdAt and updatedAt
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      // Remove sensitive information when converting to JSON
      delete ret.__v;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// 🆕 NEW: Virtual field for full address display
TenantSchema.virtual('fullAddress').get(function() {
  return this.location && this.address 
    ? `${this.address}, ${this.location}`
    : this.location || this.address || 'No address provided';
});

// 🆕 NEW: Virtual field for tenant display name
TenantSchema.virtual('displayName').get(function() {
  return `${this.name} (${this.tenantId || 'Pending'})`;
});

// 🆕 NEW: Index for better query performance
TenantSchema.index({ tenantId: 1 });
TenantSchema.index({ name: 1 });
TenantSchema.index({ location: 1 });
TenantSchema.index({ active: 1 });
TenantSchema.index({ adminEmail: 1 });
TenantSchema.index({ createdAt: -1 });

// Update the updatedAt field before saving
TenantSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Normalize emails to lowercase
  if (this.adminEmail) {
    this.adminEmail = this.adminEmail.toLowerCase().trim();
  }
  if (this.contactEmail) {
    this.contactEmail = this.contactEmail.toLowerCase().trim();
  }
  
  next();
});

// 🆕 NEW: Static method to find tenants by location
TenantSchema.statics.findByLocation = function(location) {
  return this.find({ 
    location: { $regex: location, $options: 'i' },
    active: true 
  });
};

// 🆕 NEW: Static method to find tenants by status
TenantSchema.statics.findByStatus = function(isActive) {
  return this.find({ active: isActive });
};

// 🆕 NEW: Instance method to toggle status
TenantSchema.methods.toggleStatus = function() {
  this.active = !this.active;
  return this.save();
};

// 🆕 NEW: Instance method to update HIRS setting
TenantSchema.methods.updateHirsSetting = function(hirsId, updates) {
  const hirsSetting = this.hirsSettings.id(hirsId);
  if (hirsSetting) {
    Object.assign(hirsSetting, updates);
    hirsSetting.lastUpdated = new Date().toLocaleDateString();
    return this.save();
  }
  throw new Error('HIRS setting not found');
};

// 🆕 NEW: Static method to get tenant statistics summary
TenantSchema.statics.getStatsSummary = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalTenants: { $sum: 1 },
        activeTenants: {
          $sum: { $cond: [{ $eq: ['$active', true] }, 1, 0] }
        },
        inactiveTenants: {
          $sum: { $cond: [{ $eq: ['$active', false] }, 1, 0] }
        },
        uniqueLocations: { $addToSet: '$location' }
      }
    },
    {
      $project: {
        _id: 0,
        totalTenants: 1,
        activeTenants: 1,
        inactiveTenants: 1,
        locationCount: { $size: '$uniqueLocations' }
      }
    }
  ]);
  
  return stats[0] || {
    totalTenants: 0,
    activeTenants: 0,
    inactiveTenants: 0,
    locationCount: 0
  };
};

// This model will be created using the master connection
module.exports = TenantSchema;