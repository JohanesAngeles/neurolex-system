// server/scripts/migrateTenantHirsSettings.js
require('dotenv').config(); // 🔧 FIXED: Load environment variables first
const { connectMaster, getMasterConnection } = require('../src/config/dbMaster');

const defaultHirsSettings = [
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
];

async function migrateTenantHirsSettings() {
  try {
    console.log('🔄 Starting HIRS settings migration...');
    
    // 🔧 FIXED: Initialize master connection first
    console.log('🔗 Connecting to master database...');
    await connectMaster();
    console.log('✅ Master database connected successfully');
    
    // Get master connection
    const masterConn = getMasterConnection();
    if (!masterConn) {
      throw new Error('Failed to connect to master database');
    }
    
    const Tenant = masterConn.model('Tenant');
    
    // Find all tenants that don't have hirsSettings or have empty hirsSettings
    const tenantsToUpdate = await Tenant.find({
      $or: [
        { hirsSettings: { $exists: false } },
        { hirsSettings: { $size: 0 } },
        { hirsSettings: null }
      ]
    });
    
    console.log(`📊 Found ${tenantsToUpdate.length} tenants that need HIRS settings migration`);
    
    if (tenantsToUpdate.length === 0) {
      console.log('✅ All tenants already have HIRS settings configured');
      return;
    }
    
    // Update each tenant with default HIRS settings
    let successCount = 0;
    let errorCount = 0;
    
    for (const tenant of tenantsToUpdate) {
      try {
        console.log(`🔧 Updating tenant: ${tenant.name} (${tenant._id})`);
        
        const result = await Tenant.findByIdAndUpdate(
          tenant._id,
          {
            $set: {
              hirsSettings: defaultHirsSettings,
              updatedAt: new Date()
            }
          },
          { new: true }
        );
        
        if (result) {
          console.log(`✅ Successfully updated tenant: ${tenant.name}`);
          successCount++;
        } else {
          console.log(`❌ Failed to update tenant: ${tenant.name}`);
          errorCount++;
        }
      } catch (error) {
        console.error(`❌ Error updating tenant ${tenant.name}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n📊 Migration Summary:');
    console.log(`✅ Successfully updated: ${successCount} tenants`);
    console.log(`❌ Failed to update: ${errorCount} tenants`);
    console.log(`📈 Total processed: ${successCount + errorCount} tenants`);
    
    if (successCount > 0) {
      console.log('\n🎉 HIRS settings migration completed successfully!');
      console.log('All tenants now have the 6 default HIRS features configured.');
    }
    
    // Close database connection
    await masterConn.close();
    console.log('🔒 Database connection closed');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    
    // Try to close connection even if migration failed
    try {
      const masterConn = getMasterConnection();
      if (masterConn) {
        await masterConn.close();
        console.log('🔒 Database connection closed after error');
      }
    } catch (closeError) {
      console.warn('⚠️ Could not close database connection:', closeError.message);
    }
    
    throw error;
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrateTenantHirsSettings()
    .then(() => {
      console.log('✅ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateTenantHirsSettings };