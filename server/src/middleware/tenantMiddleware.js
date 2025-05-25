// server/src/middleware/tenantMiddleware.js
const mongoose = require('mongoose');
const dbManager = require('../utils/dbManager');
const { getMasterConnection } = require('../config/dbMaster');

/**
 * Main tenant middleware
 */
const tenantMiddleware = async (req, res, next) => {
  try {
    // Skip tenant handling for specific public routes
    if (
      req.path.startsWith('/auth') || 
      req.path.startsWith('/tenants/public') ||
      req.path === '/health' ||
      req.path === '/favicon.ico'
    ) {
      return next();
    }
    
    // Extract user ID and tenant ID from req.user (set by auth middleware)
    if (req.user) {
      req.userId = req.user.id;
      req.tenantId = req.user.tenantId;
    }
    
    // Log middleware call for debugging
    console.log('Tenant middleware called', {
      path: req.path,
      tenantId: req.tenantId,
      userId: req.userId || 'anonymous'
    });
    
    // If no tenant ID, use default database
    if (!req.tenantId) {
      // Special case handling for the /users/me endpoint
      if (req.path === '/me' && req.userId) {
        try {
          // Import User model inside this block to avoid reference errors
          const User = require('../models/User');
          
          // Find user in default database to determine their tenant
          const user = await User.findById(req.userId);
          if (user && user.tenantId) {
            req.tenantId = user.tenantId;
            console.log(`Found user in default database, associating with tenant: ${user.tenantId}`);
          }
        } catch (userError) {
          console.error('Error finding user in default database:', userError.message);
        }
      }
      
      if (!req.tenantId) {
        console.log('No tenant ID found, using default database');
        
        // Set up default connection
        try {
          // Get the default connection
          const defaultConnection = mongoose.connection;
          
          // Make sure we have a connection to the default database
          if (!defaultConnection || defaultConnection.readyState !== 1) {
            console.error('Default database connection not ready');
            return res.status(500).json({
              success: false,
              message: 'Database connection error'
            });
          }
          
          // Set the default connection on the request
          req.tenantConnection = defaultConnection;
          req.tenantDbName = defaultConnection.db?.databaseName || 'default';
          console.log(`Using default database: ${req.tenantDbName}`);
          
          // Set up getModel helper
          req.getModel = (modelName) => {
            try {
              return defaultConnection.model(modelName);
            } catch (err) {
              console.error(`Error getting model ${modelName} from default connection:`, err);
              return null;
            }
          };
        } catch (error) {
          console.error('Error setting up default connection:', error);
          return res.status(500).json({
            success: false,
            message: 'Database connection error'
          });
        }
        
        return next();
      }
    }
    
    // Connect to tenant db and continue
    await connectToTenantDb(req, res, next);
  } catch (error) {
    console.error('Error in tenant middleware:', error);
    next(error);
  }
};

/**
 * Simplified tenant context setter for public endpoints like registration
 */
const setTenantContext = async (req, res, next) => {
  try {
    // Look for tenantId in request body or query params
    const tenantId = req.body?.tenantId || req.query?.tenantId;
    
    console.log('SetTenantContext middleware called with:', {
      bodyTenantId: req.body?.tenantId,
      queryTenantId: req.query?.tenantId,
      effectiveTenantId: tenantId
    });
    
    if (!tenantId) {
      console.log('No tenant ID found in request, setting up default connection');
      
      // Set up default connection when no tenant ID is found
      try {
        // Get the default connection
        const defaultConnection = mongoose.connection;
        
        // Make sure we have a connection to the default database
        if (!defaultConnection || defaultConnection.readyState !== 1) {
          console.error('Default database connection not ready');
          return res.status(500).json({
            success: false,
            message: 'Database connection error'
          });
        }
        
        // Set the default connection on the request
        req.tenantConnection = defaultConnection;
        req.tenantDbName = defaultConnection.db?.databaseName || 'default';
        console.log(`Using default database: ${req.tenantDbName}`);
        
        // Set up getModel helper
        req.getModel = (modelName) => {
          try {
            return defaultConnection.model(modelName);
          } catch (err) {
            console.error(`Error getting model ${modelName} from default connection:`, err);
            return null;
          }
        };
      } catch (error) {
        console.error('Error setting up default connection:', error);
        return res.status(500).json({
          success: false,
          message: 'Database connection error'
        });
      }
      
      return next();
    }
    
    // Set the tenantId on the request
    req.tenantId = tenantId;
    
    // Get tenant info and connect to db
    await connectToTenantDb(req, res, next);
  } catch (error) {
    console.error('Error in setTenantContext middleware:', error);
    // Continue without tenant context in case of error
    next();
  }
};

/**
 * Helper function to connect to tenant database used by both middleware
 */
async function connectToTenantDb(req, res, next) {
  try {
    const tenantId = req.tenantId;
    
    if (!tenantId) {
      console.log('No tenant ID provided to connectToTenantDb');
      
      // Set up default connection
      try {
        // Get the default connection
        const defaultConnection = mongoose.connection;
        
        // Make sure we have a connection to the default database
        if (!defaultConnection || defaultConnection.readyState !== 1) {
          console.error('Default database connection not ready');
          return res.status(500).json({
            success: false,
            message: 'Database connection error'
          });
        }
        
        // Set the default connection on the request
        req.tenantConnection = defaultConnection;
        req.tenantDbName = defaultConnection.db?.databaseName || 'default';
        console.log(`Using default database: ${req.tenantDbName}`);
        
        // Set up getModel helper
        req.getModel = (modelName) => {
          try {
            return defaultConnection.model(modelName);
          } catch (err) {
            console.error(`Error getting model ${modelName} from default connection:`, err);
            return null;
          }
        };
      } catch (error) {
        console.error('Error setting up default connection:', error);
        return res.status(500).json({
          success: false,
          message: 'Database connection error'
        });
      }
      
      return next();
    }
    
    // Get the tenant name for logging
    let tenantName = tenantId;
    let tenant = null;
    
    try {
      const masterConn = getMasterConnection();
      if (!masterConn) {
        throw new Error('Master connection not available');
      }
      
      console.log(`Looking up tenant with ID: ${tenantId}`);
      const Tenant = masterConn.model('Tenant');
      tenant = await Tenant.findById(tenantId);
      
      if (!tenant) {
        console.log(`Tenant not found with ID: ${tenantId}`);
        
        // Fall back to default connection if tenant not found
        try {
          // Get the default connection
          const defaultConnection = mongoose.connection;
          
          // Make sure we have a connection to the default database
          if (!defaultConnection || defaultConnection.readyState !== 1) {
            console.error('Default database connection not ready');
            return res.status(500).json({
              success: false,
              message: 'Database connection error'
            });
          }
          
          // Set the default connection on the request
          req.tenantConnection = defaultConnection;
          req.tenantDbName = defaultConnection.db?.databaseName || 'default';
          console.log(`Using default database: ${req.tenantDbName}`);
          
          // Set up getModel helper
          req.getModel = (modelName) => {
            try {
              return defaultConnection.model(modelName);
            } catch (err) {
              console.error(`Error getting model ${modelName} from default connection:`, err);
              return null;
            }
          };
        } catch (error) {
          console.error('Error setting up default connection:', error);
          return res.status(500).json({
            success: false,
            message: 'Database connection error'
          });
        }
        
        return next();
      }
      
      if (!tenant.active) {
        return res.status(400).json({
          success: false,
          message: 'Selected tenant is inactive'
        });
      }
      
      tenantName = tenant.name;
      req.tenant = tenant;
    } catch (error) {
      console.error('Error getting tenant info:', error.message);
      
      // Fall back to default connection if there's an error
      try {
        // Get the default connection
        const defaultConnection = mongoose.connection;
        
        // Make sure we have a connection to the default database
        if (!defaultConnection || defaultConnection.readyState !== 1) {
          console.error('Default database connection not ready');
          return res.status(500).json({
            success: false,
            message: 'Database connection error'
          });
        }
        
        // Set the default connection on the request
        req.tenantConnection = defaultConnection;
        req.tenantDbName = defaultConnection.db?.databaseName || 'default';
        console.log(`Using default database: ${req.tenantDbName}`);
        
        // Set up getModel helper
        req.getModel = (modelName) => {
          try {
            return defaultConnection.model(modelName);
          } catch (err) {
            console.error(`Error getting model ${modelName} from default connection:`, err);
            return null;
          }
        };
      } catch (defaultConnError) {
        console.error('Error setting up default connection:', defaultConnError);
        return res.status(500).json({
          success: false,
          message: 'Database connection error'
        });
      }
      
      return next();
    }
    
    console.log(`Connecting to tenant database: ${tenantName}`);
    
    // Try to connect to the tenant database
    try {
      // Ensure dbManager is properly imported
      if (!dbManager || typeof dbManager.connectTenant !== 'function') {
        console.error('dbManager or connectTenant function is missing');
        
        // Fall back to default connection
        try {
          // Get the default connection
          const defaultConnection = mongoose.connection;
          
          // Make sure we have a connection to the default database
          if (!defaultConnection || defaultConnection.readyState !== 1) {
            console.error('Default database connection not ready');
            return res.status(500).json({
              success: false,
              message: 'Database connection error'
            });
          }
          
          // Set the default connection on the request
          req.tenantConnection = defaultConnection;
          req.tenantDbName = defaultConnection.db?.databaseName || 'default';
          console.log(`Using default database: ${req.tenantDbName}`);
          
          // Set up getModel helper
          req.getModel = (modelName) => {
            try {
              return defaultConnection.model(modelName);
            } catch (err) {
              console.error(`Error getting model ${modelName} from default connection:`, err);
              return null;
            }
          };
        } catch (error) {
          console.error('Error setting up default connection:', error);
          return res.status(500).json({
            success: false,
            message: 'Database connection error'
          });
        }
        
        return next();
      }
      
      // Connect to tenant database
      const connection = await dbManager.connectTenant(tenantId);
      
      if (!connection) {
        console.error(`Failed to connect to tenant database: ${tenantId}`);
        
        // Fall back to default connection
        try {
          // Get the default connection
          const defaultConnection = mongoose.connection;
          
          // Make sure we have a connection to the default database
          if (!defaultConnection || defaultConnection.readyState !== 1) {
            console.error('Default database connection not ready');
            return res.status(500).json({
              success: false,
              message: 'Database connection error'
            });
          }
          
          // Set the default connection on the request
          req.tenantConnection = defaultConnection;
          req.tenantDbName = defaultConnection.db?.databaseName || 'default';
          console.log(`Using default database: ${req.tenantDbName}`);
          
          // Set up getModel helper
          req.getModel = (modelName) => {
            try {
              return defaultConnection.model(modelName);
            } catch (err) {
              console.error(`Error getting model ${modelName} from default connection:`, err);
              return null;
            }
          };
        } catch (error) {
          console.error('Error setting up default connection:', error);
          return res.status(500).json({
            success: false,
            message: 'Database connection error'
          });
        }
        
        return next();
      }
      
      // Set tenant connection on request for later use
      req.tenantConnection = connection;
      
      // Set tenant database name on request for logging
      req.tenantDbName = connection.db?.databaseName || 'unknown';
      console.log(`Connected to tenant database: ${req.tenantDbName}`);
      
      // Make sure all Mongoose models use this connection for this request
      req.getModel = (modelName) => {
        try {
          return connection.model(modelName);
        } catch (err) {
          console.error(`Error getting model ${modelName} from tenant connection:`, err);
          return null;
        }
      };
      
      // Store tenant info if available
      if (tenant) {
        req.tenantInfo = {
          id: tenant._id,
          name: tenant.name,
          dbName: req.tenantDbName,
          logoUrl: tenant.logoUrl,
          primaryColor: tenant.primaryColor,
          secondaryColor: tenant.secondaryColor
        };
      }
      
      console.log('Successfully connected to tenant database');
      next();
    } catch (error) {
      console.error('Error connecting to tenant database:', error);
      
      // Fall back to default connection if there's an error
      try {
        // Get the default connection
        const defaultConnection = mongoose.connection;
        
        // Make sure we have a connection to the default database
        if (!defaultConnection || defaultConnection.readyState !== 1) {
          console.error('Default database connection not ready');
          return res.status(500).json({
            success: false,
            message: 'Database connection error'
          });
        }
        
        // Set the default connection on the request
        req.tenantConnection = defaultConnection;
        req.tenantDbName = defaultConnection.db?.databaseName || 'default';
        console.log(`Using default database: ${req.tenantDbName}`);
        
        // Set up getModel helper
        req.getModel = (modelName) => {
          try {
            return defaultConnection.model(modelName);
          } catch (err) {
            console.error(`Error getting model ${modelName} from default connection:`, err);
            return null;
          }
        };
      } catch (defaultConnError) {
        console.error('Error setting up default connection:', defaultConnError);
        return res.status(500).json({
          success: false,
          message: 'Database connection error'
        });
      }
      
      next();
    }
  } catch (error) {
    console.error('Unexpected error in connectToTenantDb:', error);
    
    // Fall back to default connection in case of any unexpected error
    try {
      // Get the default connection
      const defaultConnection = mongoose.connection;
      
      // Make sure we have a connection to the default database
      if (!defaultConnection || defaultConnection.readyState !== 1) {
        console.error('Default database connection not ready');
        return res.status(500).json({
          success: false,
          message: 'Database connection error'
        });
      }
      
      // Set the default connection on the request
      req.tenantConnection = defaultConnection;
      req.tenantDbName = defaultConnection.db?.databaseName || 'default';
      console.log(`Using default database: ${req.tenantDbName}`);
      
      // Set up getModel helper
      req.getModel = (modelName) => {
        try {
          return defaultConnection.model(modelName);
        } catch (err) {
          console.error(`Error getting model ${modelName} from default connection:`, err);
          return null;
        }
      };
    } catch (defaultConnError) {
      console.error('Error setting up default connection:', defaultConnError);
      return res.status(500).json({
        success: false,
        message: 'Database connection error'
      });
    }
    
    next();
  }
}

// Export both middleware functions
module.exports = tenantMiddleware;
module.exports.setTenantContext = setTenantContext;