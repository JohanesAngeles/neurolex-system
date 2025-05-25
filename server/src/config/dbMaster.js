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
  // Define Tenant schema
  const TenantSchema = new mongoose.Schema({
    name: {
      type: String,
      required: true,
      trim: true
    },
    dbName: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    active: {
      type: Boolean,
      default: true
    },
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
    adminEmail: {
      type: String,
      required: true
    },
    contactPhone: String,
    contactEmail: String,
    address: String,
    databaseCreated: { // New field to track database creation status
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  });
  
  // Register the Tenant model (if not already registered)
  try {
    connection.model('Tenant');
  } catch (error) {
    connection.model('Tenant', TenantSchema);
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