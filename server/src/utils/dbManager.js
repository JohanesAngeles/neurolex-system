/**
 * Database Manager for Neurolex
 * Handles multi-tenant database connections and model registration
 */
const mongoose = require('mongoose');
const path = require('path');
const { getMasterConnection, getBaseUri, getConnectionOptions } = require('../config/dbMaster');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

// Import the schema registry
const { getTenantSchemas, TENANT_MODELS } = require('../schemas');

// Store active connections
const connections = {};

/**
 * Register models on a mongoose connection
 * @param {Connection} connection - Mongoose connection
 */
const registerModels = (connection) => {
  try {
    // Get schemas for tenant models
    const schemas = getTenantSchemas();
    
    // Register each model with its schema
    TENANT_MODELS.forEach(modelName => {
      if (schemas[modelName]) {
        try {
          // Check if model is already registered
          try {
            connection.model(modelName);
            console.log(`Model ${modelName} already registered, skipping`);
          } catch (err) {
            // Add special handling for User model
            if (modelName === 'User') {
              console.log('Registering User model with password hashing');
              
              // Get the User schema
              const userSchema = schemas['User'];
              
              // Ensure password hashing middleware is applied
              if (!userSchema.methods.comparePassword) {
                console.log('Adding comparePassword method to User schema');
                
                // Add comparePassword method
                userSchema.methods.comparePassword = async function(candidatePassword) {
                  try {
                    const bcrypt = require('bcryptjs');
                    console.log(`Comparing password for user: ${this.email}`);
                    return await bcrypt.compare(candidatePassword, this.password);
                  } catch (error) {
                    console.error('Error comparing passwords:', error);
                    return false;
                  }
                };
              }
              
              // Register the User model with enhanced schema
              connection.model(modelName, userSchema);
              console.log('User model registered with password hashing middleware');
            } else {
              // Register other models normally
              connection.model(modelName, schemas[modelName]);
            }
          }
        } catch (modelErr) {
          console.error(`Error registering model ${modelName}:`, modelErr);
        }
      } else {
        console.warn(`Schema not found for model: ${modelName}`);
      }
    });
    
    // Verify the User model has comparePassword method
    try {
      const UserModel = connection.model('User');
      const testUser = new UserModel();
      if (typeof testUser.comparePassword === 'function') {
        console.log('✅ User model has comparePassword method');
      } else {
        console.error('❌ User model does NOT have comparePassword method');
      }
    } catch (verifyErr) {
      console.error('Error verifying User model:', verifyErr);
    }
    
    console.log(`Registered ${TENANT_MODELS.length} models on connection`);
  } catch (error) {
    console.error('Error registering models:', error);
  }
};

/**
 * Initialize collections in a new tenant database
 * @param {Connection} connection - Mongoose connection
 */
const initializeCollections = (connection) => {
  try {
    // Get schemas for tenant models
    const schemas = getTenantSchemas();
    
    // Register each model with its schema
    TENANT_MODELS.forEach(modelName => {
      if (schemas[modelName]) {
        // Register the model with its schema
        const model = connection.model(modelName, schemas[modelName]);
        
        // Create an empty document to initialize the collection
        // This ensures the collection is created in MongoDB
        model.createCollection().then(() => {
          console.log(`Collection created for model: ${modelName}`);
        }).catch(err => {
          console.warn(`Error creating collection for ${modelName}:`, err.message);
        });
      }
    });
  } catch (error) {
    console.error('Error initializing collections:', error);
  }
};

/**
 * Database manager utility for multi-tenant connections
 */
const dbManager = {
  /**
   * Connect to a tenant database
   * @param {string} tenantId - The ID of the tenant
   * @returns {Promise<Connection>} Mongoose connection to tenant database
   */
  connectTenant: async (tenantId) => {
    try {
      // Return existing connection if already established
      if (connections[tenantId]) {
        console.log(`Reusing existing connection for tenant: ${tenantId}`);
        return connections[tenantId];
      }
      
      // Get tenant info from master database
      const masterConn = getMasterConnection();
      if (!masterConn) {
        console.error('Cannot connect to master database');
        return null; // Return null instead of throwing
      }
      
      const Tenant = masterConn.model('Tenant');
      
      const tenant = await Tenant.findById(tenantId);
      
      if (!tenant) {
        console.error(`Tenant not found: ${tenantId}`);
        return null; // Return null instead of throwing
      }
      
      if (!tenant.active) {
        console.error(`Tenant is inactive: ${tenantId}`);
        return null; // Return null instead of throwing
      }
      
      // Create the tenant URI
      const baseUri = getBaseUri();
      const uri = `${baseUri}/${tenant.dbName}`;
      
      console.log(`Connecting to tenant database: ${tenant.name} (${tenant.dbName})`);
      
      // Create connection with existing certificate setup
      try {
        const connection = await mongoose.createConnection(uri, getConnectionOptions());
        
        // Expose the MongoDB client and database on the connection
        connection.getClient = () => connection.client;
        
        console.log(`Connected to tenant database: ${tenant.name}`);
        
        // Register all models for this connection
        registerModels(connection);
        
        // Store the connection for future use
        connections[tenantId] = connection;
        
        return connection;
      } catch (connError) {
        console.error(`Error connecting to tenant database:`, connError);
        return null; // Return null instead of throwing
      }
    } catch (error) {
      console.error(`Error connecting to tenant database:`, error);
      return null; // Return null instead of throwing
    }
  },
  
  /**
   * Get a tenant connection
   * @param {string} tenantId - The ID of the tenant
   * @returns {Connection} Mongoose connection to tenant database
   */
  getConnection: (tenantId) => {
    if (!connections[tenantId]) {
      console.error(`Connection not found for tenant: ${tenantId}`);
      return null; // Return null instead of throwing
    }
    return connections[tenantId];
  },
  
  /**
   * Get all tenants from the master database
   * @returns {Promise<Array>} List of all active tenants
   */
  getAllTenants: async () => {
    try {
      const masterConn = getMasterConnection();
      if (!masterConn) {
        console.error('Cannot connect to master database');
        return []; // Return empty array instead of throwing
      }
      
      const Tenant = masterConn.model('Tenant');
      
      // Get all active tenants
      return await Tenant.find({ active: true })
        .select('_id name dbName logoUrl primaryColor secondaryColor')
        .sort('name')
        .lean();
    } catch (error) {
      console.error('Error fetching tenants:', error);
      return []; // Return empty array instead of throwing
    }
  },
  
  /**
   * Create a new database for a tenant
   * @param {string} tenantId - The ID of the tenant
   * @returns {Promise<Object>} Result of the operation
   */
  createTenantDatabase: async (tenantId) => {
    try {
      // Get tenant details from master database
      const masterConn = getMasterConnection();
      if (!masterConn) {
        console.error('Cannot connect to master database');
        return { success: false, error: 'Cannot connect to master database' };
      }
      
      const Tenant = masterConn.model('Tenant');
      
      const tenant = await Tenant.findById(tenantId);
      
      if (!tenant) {
        return { success: false, error: `Tenant not found: ${tenantId}` };
      }
      
      // Create the tenant URI
      const baseUri = getBaseUri();
      const uri = `${baseUri}/${tenant.dbName}`;
      const options = getConnectionOptions();
      
      // Connect using MongoDB native driver for admin operations
      try {
        const client = new MongoClient(uri, options);
        await client.connect();
        
        // Create a simple collection to initialize the database
        const db = client.db(tenant.dbName);
        await db.createCollection('_init');
        
        console.log(`Created new database: ${tenant.dbName}`);
        
        // Close the client connection
        await client.close();
      } catch (mongoError) {
        console.error('Error creating database with MongoDB client:', mongoError);
        return { success: false, error: mongoError.message };
      }
      
      // Try to connect with Mongoose and initialize collections
      try {
        // Create Mongoose connection
        const tenantConn = await mongoose.createConnection(uri, options);
        
        // Initialize collections by defining schemas and creating models
        initializeCollections(tenantConn);
        
        // Close the connection
        await tenantConn.close();
      } catch (mongooseError) {
        console.error('Warning: Error when initializing Mongoose models:', mongooseError.message);
        // Continue execution even if this fails - the database has been created
      }
      
      // Update tenant record to mark database as created
      try {
        tenant.databaseCreated = true;
        await tenant.save();
      } catch (saveError) {
        console.error('Error updating tenant record:', saveError);
        // Continue even if the update fails
      }
      
      return { success: true, message: `Database ${tenant.dbName} created successfully` };
    } catch (error) {
      console.error('Error creating tenant database:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Delete a tenant database completely
   * @param {string} tenantId - The ID of the tenant
   * @returns {Promise<Object>} Result of the operation
   */
  deleteTenantDatabase: async (tenantId) => {
    try {
      // Get tenant details from master database
      const masterConn = getMasterConnection();
      if (!masterConn) {
        console.error('Cannot connect to master database');
        return { success: false, error: 'Cannot connect to master database' };
      }
      
      const Tenant = masterConn.model('Tenant');
      
      const tenant = await Tenant.findById(tenantId);
      
      if (!tenant) {
        return { success: false, error: `Tenant not found: ${tenantId}` };
      }
      
      // Close any existing connections first
      if (connections[tenantId]) {
        try {
          await connections[tenantId].close();
          delete connections[tenantId];
          console.log(`Closed existing connection for tenant: ${tenantId}`);
        } catch (closeError) {
          console.warn('Error closing connection:', closeError.message);
        }
      }
      
      // Create the tenant URI
      const baseUri = getBaseUri();
      const uri = `${baseUri}/${tenant.dbName}`;
      const options = getConnectionOptions();
      
      // Connect using MongoDB native driver for admin operations
      try {
        const client = new MongoClient(uri, options);
        await client.connect();
        
        // Drop the entire database
        const db = client.db(tenant.dbName);
        await db.dropDatabase();
        
        console.log(`✅ Deleted database: ${tenant.dbName}`);
        
        // Close the client connection
        await client.close();
        
        return { 
          success: true, 
          message: `Database ${tenant.dbName} deleted successfully` 
        };
      } catch (mongoError) {
        console.error('Error deleting database with MongoDB client:', mongoError);
        return { success: false, error: mongoError.message };
      }
    } catch (error) {
      console.error('Error deleting tenant database:', error);
      return { success: false, error: error.message };
    }
  },
  
  /**
   * Get tenant database status
   * @param {string} tenantId - The ID of the tenant
   * @returns {Promise<Object>} Database status
   */
  getTenantDatabaseStatus: async (tenantId) => {
    try {
      // Get tenant details from master database
      const masterConn = getMasterConnection();
      if (!masterConn) {
        console.error('Cannot connect to master database');
        return { 
          success: false, 
          exists: false,
          error: 'Cannot connect to master database'
        };
      }
      
      const Tenant = masterConn.model('Tenant');
      
      const tenant = await Tenant.findById(tenantId);
      
      if (!tenant) {
        return { 
          success: false, 
          exists: false,
          error: `Tenant not found: ${tenantId}`
        };
      }
      
      // Create the tenant URI
      const baseUri = getBaseUri();
      const uri = `${baseUri}/${tenant.dbName}`;
      
      // Connect using MongoDB native driver to check status
      try {
        const client = new MongoClient(uri, getConnectionOptions());
        await client.connect();
        
        // Try to list collections to verify database exists
        const db = client.db(tenant.dbName);
        const collections = await db.listCollections().toArray();
        
        await client.close();
        
        return { 
          success: true, 
          exists: true,
          collections: collections.length,
          databaseName: tenant.dbName
        };
      } catch (mongoError) {
        console.error(`Error checking database with MongoDB client:`, mongoError);
        return { 
          success: false, 
          exists: false,
          error: mongoError.message
        };
      }
    } catch (error) {
      console.error(`Error checking tenant database:`, error);
      return { 
        success: false, 
        exists: false,
        error: error.message
      };
    }
  },
  
  /**
   * Close a specific tenant connection
   * @param {string} tenantId - The ID of the tenant
   * @returns {Promise<void>}
   */
  closeConnection: async (tenantId) => {
    if (connections[tenantId]) {
      try {
        await connections[tenantId].close();
        delete connections[tenantId];
        console.log(`Closed connection for tenant: ${tenantId}`);
      } catch (error) {
        console.error(`Error closing connection for tenant ${tenantId}:`, error.message);
      }
    }
  },
  
  /**
   * Close all tenant connections
   * @returns {Promise<void>}
   */
  closeAllConnections: async () => {
    for (const tenantId in connections) {
      try {
        await connections[tenantId].close();
        delete connections[tenantId];
      } catch (error) {
        console.error(`Error closing connection for tenant ${tenantId}:`, error.message);
      }
    }
    console.log('All tenant connections closed');
  },
  
  /**
   * Get direct access to MongoDB database for a tenant
   * @param {string} tenantId - The ID of the tenant
   * @returns {Promise<Db>} MongoDB database object
   */
  getMongoDb: async (tenantId) => {
    try {
      const connection = await dbManager.connectTenant(tenantId);
      if (!connection) {
        console.error(`Failed to get MongoDB database for tenant: ${tenantId}`);
        return null;
      }
      return connection.getClient().db(connection.db.databaseName);
    } catch (error) {
      console.error(`Error getting MongoDB database for tenant: ${tenantId}`, error);
      return null;
    }
  },
  
  /**
   * Get a collection from a tenant's database
   * @param {string} tenantId - The ID of the tenant
   * @param {string} collectionName - The name of the collection
   * @returns {Promise<Collection>} MongoDB collection object
   */
  getCollection: async (tenantId, collectionName) => {
    try {
      const db = await dbManager.getMongoDb(tenantId);
      if (!db) {
        console.error(`Failed to get collection ${collectionName} for tenant: ${tenantId}`);
        return null;
      }
      return db.collection(collectionName);
    } catch (error) {
      console.error(`Error getting collection ${collectionName} for tenant: ${tenantId}`, error);
      return null;
    }
  },
  
  /**
   * Reset a user's password directly
   * @param {string} userEmail - The user's email
   * @param {string} newPassword - The new password
   * @param {string} tenantId - The tenant ID (optional)
   * @returns {Promise<Object>} Result of the operation
   */
  resetUserPassword: async (userEmail, newPassword, tenantId = null) => {
    try {
      console.log(`Attempting to reset password for user: ${userEmail}`);
      
      let UserModel, connection;
      
      // Set up database connection based on tenantId
      if (tenantId) {
        console.log(`Using tenant database: ${tenantId}`);
        connection = await dbManager.connectTenant(tenantId);
        if (!connection) {
          return { 
            success: false, 
            message: 'Failed to connect to tenant database' 
          };
        }
        
        UserModel = connection.model('User');
      } else {
        console.log('Using default database');
        UserModel = require('../models/User');
      }
      
      // Find the user
      const user = await UserModel.findOne({ email: userEmail });
      
      if (!user) {
        return { 
          success: false, 
          message: `User not found with email: ${userEmail}` 
        };
      }
      
      console.log(`Found user: ${user.firstName} ${user.lastName}`);
      
      // Hash the new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      
      console.log('New password hash generated');
      
      // Update the user's password directly
      user.password = hashedPassword;
      await user.save();
      
      return {
        success: true,
        message: 'Password successfully reset'
      };
    } catch (error) {
      console.error('Error resetting password:', error);
      return {
        success: false,
        message: 'Error resetting password',
        error: error.message
      };
    }
  }
};

// Export the dbManager object
module.exports = dbManager;