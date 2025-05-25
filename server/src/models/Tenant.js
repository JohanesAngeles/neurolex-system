// server/src/models/master/Tenant.js
const mongoose = require('mongoose');

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
  primaryColor: {
    type: String,
    default: '#1e3a8a' // Default Neurolex blue
  },
  secondaryColor: {
    type: String,
    default: '#f3f4f6' // Light gray
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
  }
});

// This model will be created using the master connection
module.exports = TenantSchema;