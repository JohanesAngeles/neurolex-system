// server/src/models/TenantSettings.js - ADMIN MULTI-TENANT MANAGEMENT
const mongoose = require('mongoose');

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

// ✅ ADMIN DATABASE: One collection storing settings for ALL tenants
const tenantSettingsSchema = new mongoose.Schema({
  // ✅ This identifies WHICH tenant these settings belong to
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Tenant', // References the Tenant model
    unique: true,  // Each tenant can only have one settings record
    index: true    // For fast lookups
  },
  
  // ✅ Tenant basic info (for easier admin management)
  tenantInfo: {
    name: {
      type: String,
      required: true
    },
    domain: {
      type: String,
      default: null
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active'
    }
  },
  
  // ✅ Platform branding settings
  platformName: {
    type: String,
    default: 'NEUROLEX'
  },
  platformDescription: {
    type: String,
    default: 'AI-powered mental wellness platform'
  },
  
  // ✅ Logo settings
  systemLogo: {
    light: {
      type: String,
      default: null
    },
    dark: {
      type: String,
      default: null
    }
  },
  
  // ✅ Favicon settings  
  favicon: {
    light: {
      type: String,
      default: null
    },
    dark: {
      type: String,
      default: null
    }
  },
  
  // ✅ Theme colors
  primaryColor: {
    type: String,
    default: '#4CAF50',
    validate: {
      validator: function(v) {
        return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
      },
      message: 'Invalid color format. Use hex format like #4CAF50'
    }
  },
  secondaryColor: {
    type: String,
    default: '#2196F3',
    validate: {
      validator: function(v) {
        return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
      },
      message: 'Invalid color format. Use hex format like #2196F3'
    }
  },
  
  // ✅ HIRS feature management
  hirsSettings: [hirsSettingSchema],
  
  // ✅ Additional admin metadata
  adminSettings: {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null
    },
    notes: {
      type: String,
      default: ''
    }
  }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// ✅ Indexes for admin queries
tenantSettingsSchema.index({ tenantId: 1 }); // Primary lookup
tenantSettingsSchema.index({ 'tenantInfo.name': 1 }); // Name search
tenantSettingsSchema.index({ 'tenantInfo.status': 1 }); // Status filtering
tenantSettingsSchema.index({ createdAt: -1 }); // Recent first

// ✅ Virtual for full tenant data population
tenantSettingsSchema.virtual('tenant', {
  ref: 'Tenant',
  localField: 'tenantId',
  foreignField: '_id',
  justOne: true
});

// ✅ Pre-save middleware to update lastModifiedBy
tenantSettingsSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.adminSettings.lastModifiedBy = this._adminId; // Set by controller
  }
  next();
});

// ✅ Static methods for admin operations
tenantSettingsSchema.statics.findByTenantId = function(tenantId) {
  return this.findOne({ tenantId }).populate('tenant', 'name domain status');
};

tenantSettingsSchema.statics.getAllTenantSettings = function(filters = {}) {
  const query = {};
  
  if (filters.status) {
    query['tenantInfo.status'] = filters.status;
  }
  
  if (filters.search) {
    query['tenantInfo.name'] = { $regex: filters.search, $options: 'i' };
  }
  
  return this.find(query)
    .populate('tenant', 'name domain status')
    .sort({ updatedAt: -1 });
};

const TenantSettings = mongoose.model('TenantSettings', tenantSettingsSchema);

module.exports = TenantSettings;