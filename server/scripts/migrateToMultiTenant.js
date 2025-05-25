// server/scripts/migrateToMultiTenant.js
/**
 * Migration script to create individual databases for existing tenants
 * This version focuses only on database creation, without model registration issues
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');
const { connectMaster, getMasterConnection, getBaseUri, getConnectionOptions } = require('../src/config/dbMaster');

console.log('Starting multi-tenant database creation...');

// Create database and mark tenant as migrated
async function createTenantDatabase(tenant) {
  try {
    console.log(`Creating database for tenant: ${tenant.name}`);
    
    // Get connection URI and options
    const baseUri = getBaseUri();
    const uri = `${baseUri}/${tenant.dbName}`;
    const options = getConnectionOptions();
    
    // Use MongoDB native driver to create database
    const client = new MongoClient(uri, options);
    await client.connect();
    
    // Create a simple collection to initialize the database
    const db = client.db(tenant.dbName);
    await db.createCollection('_init');
    
    console.log(`Created database: ${tenant.dbName}`);
    
    // Close the client connection
    await client.close();
    
    // Mark tenant as migrated
    tenant.databaseCreated = true;
    await tenant.save();
    
    return { success: true };
  } catch (error) {
    console.error(`Error creating database for tenant ${tenant.name}:`, error.message);
    return { success: false, error: error.message };
  }
}

// Main migration function
async function migrateToMultiTenant() {
  try {
    // Connect to master database
    await connectMaster();
    const masterConn = getMasterConnection();
    const Tenant = masterConn.model('Tenant');
    
    // Get all active tenants
    const tenants = await Tenant.find({ active: true });
    
    console.log(`Found ${tenants.length} active tenants`);
    
    let successful = 0;
    let failed = 0;
    let skipped = 0;
    
    for (const tenant of tenants) {
      console.log(`\n----------------------------------------------------`);
      console.log(`Processing tenant: ${tenant.name} (${tenant._id})`);
      
      // Skip if already migrated
      if (tenant.databaseCreated) {
        console.log(`Tenant ${tenant.name} already has a database. Skipping...`);
        skipped++;
        continue;
      }
      
      // Create tenant database
      const result = await createTenantDatabase(tenant);
      
      if (result.success) {
        console.log(`Successfully created database for tenant: ${tenant.name}`);
        successful++;
      } else {
        console.error(`Failed to create database for tenant ${tenant.name}: ${result.error}`);
        failed++;
      }
    }
    
    console.log(`\n==================================================`);
    console.log(`Database Creation Summary:`);
    console.log(`Total tenants: ${tenants.length}`);
    console.log(`Successfully created: ${successful}`);
    console.log(`Failed: ${failed}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`==================================================`);
    
    // Check if any tenants are still not migrated
    const nonMigratedCount = await Tenant.countDocuments({ active: true, databaseCreated: { $ne: true } });
    
    if (nonMigratedCount > 0) {
      console.log(`WARNING: ${nonMigratedCount} active tenants still need database creation!`);
      console.log(`Run this script again to retry.`);
    } else {
      console.log(`All active tenants now have databases created.`);
    }
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    // Close connections
    try {
      console.log('Closing all connections...');
      await mongoose.disconnect();
    } catch (error) {
      console.error('Error closing connections:', error);
    }
    
    process.exit(0);
  }
}

// Run the migration
migrateToMultiTenant();