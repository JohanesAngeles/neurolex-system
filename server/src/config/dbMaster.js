// server/src/config/dbMaster.js
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

let masterConnection = null;

/**
 * Connect to the master database for tenant management
 * @returns {Promise<Connection>} Mongoose connection to master database
 */
const connectMaster = async () => {
  try {
    // If already connected, return existing connection
    if (masterConnection) {
      return masterConnection;
    }

    // Get the master URI from environment variables
    const masterUri = process.env.MASTER_MONGO_URI;
    
    if (!masterUri) {
      throw new Error('MASTER_MONGO_URI not provided in environment variables');
    }

    console.log('🔗 Connecting to Master Database...');
    console.log(`📍 Master URI: ${masterUri.replace(/\/\/.*@/, '//***:***@')}`);

    // Determine connection options based on URI type
    const connectionOptions = getConnectionOptions(masterUri);
    
    // Connect to master database
    masterConnection = await mongoose.createConnection(masterUri, connectionOptions);
    
    // Initialize Tenant model in master connection
    initializeTenantModel(masterConnection);
    
    console.log('Connected to Master Database');
    return masterConnection;
  } catch (error) {
    console.error('Master DB connection error:', error);
    throw error;
  }
};

/**
 * Initialize Tenant model in the master database
 * @param {Connection} connection - Mongoose connection
 */
const initializeTenantModel = (connection) => {
  // 🚨 CRITICAL FIX: Import the correct Tenant schema from models folder
  let TenantSchema;
  
  try {
    // Try the most common path first
    TenantSchema = require('../models/Tenant');
    console.log('✅ Found Tenant schema at ../models/master/Tenant');
  } catch (error1) {
    try {
      // Try alternative path
      TenantSchema = require('../models/Tenant');
      console.log('✅ Found Tenant schema at ../models/Tenant');
    } catch (error2) {
      try {
        // Try another alternative
        TenantSchema = require('../models/Tenant');
        console.log('✅ Found Tenant schema at ../../models/master/Tenant');
      } catch (error3) {
        console.error('❌ Could not find Tenant schema at any expected location');
        console.error('Error 1 (../models/master/Tenant):', error1.message);
        console.error('Error 2 (../models/Tenant):', error2.message);
        console.error('Error 3 (../../models/master/Tenant):', error3.message);
        
        // 🚨 FALLBACK: Define schema inline with hirsSettings
        console.log('⚠️ Using fallback inline schema definition');
        TenantSchema = new mongoose.Schema({
          name: { type: String, required: true, trim: true },
          dbName: { type: String, required: true, unique: true, trim: true },
          active: { type: Boolean, default: true },
          logoUrl: { type: String, default: '/logo.svg' },
          darkLogoUrl: { type: String, default: null },
          faviconUrl: { type: String, default: null },
          darkFaviconUrl: { type: String, default: null },
          primaryColor: { type: String, default: '#1e3a8a' },
          secondaryColor: { type: String, default: '#f3f4f6' },
          description: { type: String, default: 'AI-powered mental wellness platform' },
          // 🚨 CRITICAL: Include hirsSettings field
          hirsSettings: [{
            id: { type: Number, required: true },
            icon: { type: String, required: true },
            name: { type: String, required: true },
            description: { type: String, required: true },
            lastUpdated: { type: String, default: () => new Date().toLocaleDateString() },
            isActive: { type: Boolean, default: true }
          }],
          adminEmail: { type: String, required: true },
          contactPhone: String,
          contactEmail: String,
          address: String,
          createdAt: { type: Date, default: Date.now },
          updatedAt: { type: Date, default: Date.now }
        });
        
        // Add pre-save middleware
        TenantSchema.pre('save', function(next) {
          this.updatedAt = new Date();
          next();
        });
      }
    }
  }
  
  console.log('🔍 Loading Tenant schema from models/master/Tenant.js');
  console.log('🔍 Tenant schema paths:', Object.keys(TenantSchema.paths));
  console.log('🔍 hirsSettings field exists?', 'hirsSettings' in TenantSchema.paths);
  
  // Register the Tenant model (if not already registered)
  try {
    const existingModel = connection.model('Tenant');
    console.log('⚠️ Tenant model already exists, checking schema...');
    
    // Check if existing model has hirsSettings
    const hasHirsSettings = 'hirsSettings' in existingModel.schema.paths;
    console.log('🔍 Existing model has hirsSettings?', hasHirsSettings);
    
    if (!hasHirsSettings) {
      console.log('🔄 Existing model missing hirsSettings, forcing recreation...');
      
      // Remove the model from the connection registry
      delete connection.models.Tenant;
      delete connection.modelSchemas.Tenant;
      
      // Create new model with correct schema
      const newModel = connection.model('Tenant', TenantSchema);
      console.log('✅ Recreated Tenant model with hirsSettings field');
      return newModel;
    }
    
    return existingModel;
  } catch (error) {
    // Model doesn't exist, create it
    console.log('✅ Creating new Tenant model with hirsSettings field');
    const TenantModel = connection.model('Tenant', TenantSchema);
    
    // Verify the model has hirsSettings
    console.log('🔍 Created model paths:', Object.keys(TenantModel.schema.paths));
    console.log('🔍 hirsSettings exists in created model?', 'hirsSettings' in TenantModel.schema.paths);
    
    return TenantModel;
  }
};

/**
 * Get the current master connection
 * @returns {Connection} Mongoose connection to master database
 */
const getMasterConnection = () => {
  if (!masterConnection) {
    throw new Error('Master connection not initialized. Call connectMaster() first.');
  }
  return masterConnection;
};

/**
 * Get MongoDB connection options based on URI type
 * @param {string} mongoUri - MongoDB connection URI
 * @returns {Object} MongoDB connection options
 */
const getConnectionOptions = (mongoUri) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Check if using Atlas (mongodb+srv://) or certificate-based connection
  if (mongoUri && mongoUri.includes('mongodb+srv://')) {
    console.log('🔄 Using Atlas connection for master database');
    return {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      // No authentication options needed - Atlas handles it
    };
  }
  
  // Legacy certificate-based connection (for local development)
  if (!isProduction) {
    const certPath = path.join(__dirname, '../../certificates/angeles_admin1.pem');
    
    if (fs.existsSync(certPath)) {
      console.log('🔐 Using certificate authentication for master database');
      return {
        tls: true,
        tlsCertificateKeyFile: certPath,
        authMechanism: 'MONGODB-X509',
        authSource: '$external',
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
      };
    }
  }
  
  // Default connection options
  console.log('🔑 Using standard authentication for master database');
  return {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  };
};

/**
 * Get MongoDB base URI without database name
 * @returns {string} MongoDB base URI
 */
const getBaseUri = () => {
  const mainUri = process.env.MONGO_URI;
  
  if (mainUri.includes('mongodb+srv://')) {
    // For Atlas URIs, extract base URI properly
    const url = new URL(mainUri.replace('mongodb+srv://', 'https://'));
    const credentials = mainUri.match(/mongodb\+srv:\/\/([^@]+)@/)[1];
    return `mongodb+srv://${credentials}@${url.host}`;
  }
  
  // For standard MongoDB URIs
  return mainUri.substring(0, mainUri.lastIndexOf('/'));
};

/**
 * Create database URI for a specific database name
 * @param {string} dbName - Database name
 * @returns {string} Complete MongoDB URI for the database
 */
const createDatabaseUri = (dbName) => {
  const baseUri = getBaseUri();
  const mainUri = process.env.MONGO_URI;
  
  if (mainUri.includes('mongodb+srv://')) {
    // For Atlas URIs, handle query parameters properly
    const url = new URL(mainUri.replace('mongodb+srv://', 'https://'));
    const credentials = mainUri.match(/mongodb\+srv:\/\/([^@]+)@/)[1];
    const queryParams = url.search || '?retryWrites=true&w=majority';
    return `mongodb+srv://${credentials}@${url.host}/${dbName}${queryParams}`;
  }
  
  // For standard MongoDB URIs
  return `${baseUri}/${dbName}`;
};

/**
 * Close the master database connection
 * @returns {Promise<void>}
 */
const closeMasterConnection = async () => {
  if (masterConnection) {
    await masterConnection.close();
    masterConnection = null;
    console.log('Master database connection closed');
  }
};

module.exports = {
  connectMaster,
  getMasterConnection,
  getConnectionOptions,
  getBaseUri,
  createDatabaseUri,
  closeMasterConnection
};