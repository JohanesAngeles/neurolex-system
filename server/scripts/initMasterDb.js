// server/scripts/initMasterDb.js
require('dotenv').config();
const { connectMaster } = require('../src/config/dbMaster');
const dbManager = require('../src/utils/dbManager');

/**
 * Script to initialize the master database with the first tenant
 */
async function initMasterDb() {
  try {
    console.log('Initializing master database...');
    
    // Connect to master database
    const masterConn = await connectMaster();
    
    // Initialize models
    dbManager.initializeMasterModels();
    
    // Get Tenant model
    const Tenant = masterConn.model('Tenant');
    
    // Check if default tenant already exists
    const defaultTenant = await Tenant.findOne({ dbName: 'neurolex_default' });
    
    if (!defaultTenant) {
      console.log('Creating default tenant...');
      
      // Create default tenant
      const newTenant = new Tenant({
        name: 'Neurolex Default Clinic',
        dbName: 'neurolex_default',
        adminEmail: process.env.ADMIN_EMAIL || 'admin@neurolex.com',
        logoUrl: '/logo.svg',
        primaryColor: '#1e3a8a',
        secondaryColor: '#f3f4f6',
        active: true
      });
      
      await newTenant.save();
      console.log('Default tenant created:', newTenant);
    } else {
      console.log('Default tenant already exists:', defaultTenant);
    }
    
    console.log('Master database initialization complete');
  } catch (error) {
    console.error('Master database initialization error:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run the initialization
initMasterDb();