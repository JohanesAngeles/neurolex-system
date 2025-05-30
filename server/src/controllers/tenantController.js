// server/src/controllers/tenantController.js
const { getMasterConnection } = require('../config/dbMaster');
const dbManager = require('../utils/dbManager');

/**
 * Get all tenants - only accessible to super admin
 */
exports.getAllTenants = async (req, res) => {
  try {
    const masterConn = getMasterConnection();
    const Tenant = masterConn.model('Tenant');
    
    const tenants = await Tenant.find().sort({ name: 1 });
    
    res.status(200).json({
      success: true,
      data: tenants
    });
  } catch (error) {
    console.error('Error fetching tenants:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching clinics',
      error: error.message
    });
  }
};

/**
 * Create a new tenant - only accessible to super admin
 */
exports.createTenant = async (req, res) => {
  try {
    const {
      name,
      dbName,
      adminEmail,
      logoUrl,
      primaryColor,
      secondaryColor
    } = req.body;
    
    // Validate required fields
    if (!name || !dbName || !adminEmail) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }
    
    // Validate database name format
    if (!/^[a-z0-9_]+$/.test(dbName)) {
      return res.status(400).json({
        success: false,
        message: 'Database name must only contain lowercase letters, numbers, and underscores'
      });
    }
    
    const masterConn = getMasterConnection();
    const Tenant = masterConn.model('Tenant');
    
    // Check if tenant with same name or dbName already exists
    const existingTenant = await Tenant.findOne({
      $or: [
        { name: name },
        { dbName: `neurolex_${dbName}` }
      ]
    });
    
    if (existingTenant) {
      return res.status(400).json({
        success: false,
        message: 'A clinic with this name or database name already exists'
      });
    }
    
    // Create new tenant
    const newTenant = new Tenant({
      name,
      dbName: `neurolex_${dbName}`, // Prefix with neurolex_ for consistency
      adminEmail,
      logoUrl: logoUrl || '/logo.svg',
      primaryColor: primaryColor || '#1e3a8a',
      secondaryColor: secondaryColor || '#f3f4f6',
      active: true,
      databaseCreated: false // Initialize as false
    });
    
    const savedTenant = await newTenant.save();
    
    // Create a new database for the tenant
    const dbResult = await dbManager.createTenantDatabase(savedTenant._id);
    
    if (!dbResult.success) {
      // If database creation fails, we'll still return success but with a warning
      // The admin can retry database creation later
      return res.status(201).json({
        success: true,
        warning: true,
        message: 'Clinic created successfully, but database creation failed. You can retry later.',
        dbError: dbResult.error,
        data: savedTenant
      });
    }
    
    res.status(201).json({
      success: true,
      message: 'Clinic created successfully with dedicated database',
      data: savedTenant
    });
  } catch (error) {
    console.error('Error creating tenant:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating clinic',
      error: error.message
    });
  }
};

/**
 * Get tenant database status - only accessible to super admin
 */
exports.getTenantDatabaseStatus = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate tenant ID
    if (!id || id.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required'
      });
    }
    
    const status = await dbManager.getTenantDatabaseStatus(id);
    
    res.status(200).json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error getting tenant database status:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking database status',
      error: error.message
    });
  }
};

/**
 * Create or recreate tenant database - only accessible to super admin
 */
exports.createTenantDatabase = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate tenant ID
    if (!id || id.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required'
      });
    }
    
    // Verify that tenant exists in master database
    const masterConn = getMasterConnection();
    const Tenant = masterConn.model('Tenant');
    
    const tenant = await Tenant.findById(id);
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }
    
    const result = await dbManager.createTenantDatabase(id);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error creating database',
        error: result.error
      });
    }
    
    // Update tenant record to mark database as created
    tenant.databaseCreated = true;
    await tenant.save();
    
    res.status(200).json({
      success: true,
      message: 'Database created successfully',
      data: result
    });
  } catch (error) {
    console.error('Error creating tenant database:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating database',
      error: error.message
    });
  }
};

/**
 * Update tenant status (activate/deactivate) - only accessible to super admin
 */
exports.updateTenantStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    
    if (typeof active !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Status must be boolean'
      });
    }
    
    const masterConn = getMasterConnection();
    const Tenant = masterConn.model('Tenant');
    
    const tenant = await Tenant.findById(id);
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found'
      });
    }
    
    tenant.active = active;
    await tenant.save();
    
    // If tenant is deactivated, close any active connections
    if (!active) {
      await dbManager.closeConnection(id);
    }
    
    res.status(200).json({
      success: true,
      message: `Clinic ${active ? 'activated' : 'deactivated'} successfully`,
      data: tenant
    });
  } catch (error) {
    console.error('Error updating tenant status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating clinic status',
      error: error.message
    });
  }
};

/**
 * Get tenant by ID - only accessible to super admin
 */
exports.getTenantById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const masterConn = getMasterConnection();
    const Tenant = masterConn.model('Tenant');
    
    const tenant = await Tenant.findById(id);
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: tenant
    });
  } catch (error) {
    console.error('Error fetching tenant:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching clinic',
      error: error.message
    });
  }
};

/**
 * Update tenant details - only accessible to super admin
 */
exports.updateTenant = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      adminEmail,
      logoUrl,
      primaryColor,
      secondaryColor
    } = req.body;
    
    // Note: We don't allow changing the dbName after creation for safety
    
    const masterConn = getMasterConnection();
    const Tenant = masterConn.model('Tenant');
    
    const tenant = await Tenant.findById(id);
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found'
      });
    }
    
    // Update fields if provided
    if (name !== undefined) tenant.name = name;
    if (adminEmail !== undefined) tenant.adminEmail = adminEmail;
    if (logoUrl !== undefined) tenant.logoUrl = logoUrl;
    if (primaryColor !== undefined) tenant.primaryColor = primaryColor;
    if (secondaryColor !== undefined) tenant.secondaryColor = secondaryColor;
    
    await tenant.save();
    
    res.status(200).json({
      success: true,
      message: 'Clinic updated successfully',
      data: tenant
    });
  } catch (error) {
    console.error('Error updating tenant:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating clinic',
      error: error.message
    });
  }
};

/**
 * Get public tenant info by ID - accessible without authentication
 * Only returns non-sensitive information INCLUDING hirsSettings for feature control
 */
exports.getPublicTenantById = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🔍 [getPublicTenantById] Fetching public tenant info for ID: ${id}`);
    
    const masterConn = getMasterConnection();
    const Tenant = masterConn.model('Tenant');
    
    // Get tenant info including hirsSettings (stored directly in Tenant model)
    const tenant = await Tenant.findById(id).select('name logoUrl primaryColor secondaryColor active systemLogo favicon hirsSettings');
    
    if (!tenant) {
      console.warn(`⚠️ [getPublicTenantById] Tenant not found for ID: ${id}`);
      return res.status(404).json({
        success: false,
        message: 'Clinic not found'
      });
    }
    
    // Check if tenant is active
    if (!tenant.active) {
      console.warn(`⚠️ [getPublicTenantById] Tenant is inactive for ID: ${id}`);
      return res.status(403).json({
        success: false,
        message: 'This clinic is currently inactive'
      });
    }

    // 🔧 Get hirsSettings directly from tenant model or use defaults
    let hirsSettings = tenant.hirsSettings;
    
    if (!hirsSettings || hirsSettings.length === 0) {
      console.log(`ℹ️ [getPublicTenantById] No HIRS settings found for tenant ${id}, using defaults`);
      
      // 🔧 Provide default HIRS settings if none exist
      hirsSettings = [
        { id: 1, name: 'Dashboard', isActive: true },
        { id: 2, name: 'Patients', isActive: true },
        { id: 3, name: 'Patient Journal Management', isActive: true },
        { id: 4, name: 'Journal Template Management', isActive: true },
        { id: 5, name: 'Appointments', isActive: true },
        { id: 6, name: 'Messages', isActive: true }
      ];
    } else {
      console.log(`✅ [getPublicTenantById] Found ${hirsSettings.length} HIRS settings for tenant ${id}`);
    }

    // 🚨 UPDATED: Include hirsSettings in the response
    const responseData = {
      _id: tenant._id,
      name: tenant.name,
      logoUrl: tenant.logoUrl,
      primaryColor: tenant.primaryColor,
      secondaryColor: tenant.secondaryColor,
      systemLogo: tenant.systemLogo,
      favicon: tenant.favicon,
      hirsSettings: hirsSettings, // 🔧 Include feature settings
      active: tenant.active
    };

    console.log(`✅ [getPublicTenantById] Successfully returning tenant data with ${hirsSettings.length} HIRS settings`);
    
    res.status(200).json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('❌ [getPublicTenantById] Error fetching public tenant info:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching clinic information',
      error: error.message
    });
  }
};


/**
 * Get all public tenant information for login/registration
 * @route GET /api/tenants/public
 * @access Public
 */
exports.getPublicTenants = async (req, res) => {
  try {
    console.log('GET /tenants/public endpoint called');
    
    // Get master connection
    const masterConn = getMasterConnection();
    if (!masterConn) {
      console.error('Cannot connect to master database in getPublicTenants');
      return res.status(500).json({
        success: false,
        message: 'Database connection error'
      });
    }
    
    const Tenant = masterConn.model('Tenant');
    
    // Get all active tenants with public fields only
    const tenants = await Tenant.find({ active: true })
      .select('_id name logoUrl primaryColor secondaryColor')
      .sort('name')
      .lean();
    
    console.log(`Found ${tenants.length} active tenants for public listing`);
    
    res.status(200).json({
      success: true,
      count: tenants.length,
      data: tenants
    });
  } catch (error) {
    console.error('Error in getPublicTenants:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching public tenants',
      error: error.message
    });
  }
};

/**
 * Get list of active tenants (for dropdowns)
 * @route GET /api/tenants/active/list
 * @access Public
 */
exports.listActiveTenants = async (req, res) => {
  try {
    // Get master connection
    const masterConn = getMasterConnection();
    if (!masterConn) {
      console.error('Cannot connect to master database');
      return res.status(500).json({
        success: false,
        message: 'Database connection error'
      });
    }
    
    const Tenant = masterConn.model('Tenant');
    
    // Get minimal info for all active tenants
    const tenants = await Tenant.find({ active: true })
      .select('_id name')
      .sort('name')
      .lean();
    
    res.status(200).json({
      success: true,
      count: tenants.length,
      data: tenants
    });
  } catch (error) {
    console.error('Error fetching active tenants list:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching active tenants',
      error: error.message
    });
  }
};

/**
 * Get current tenant info from request
 */
exports.getCurrentTenant = async (req, res) => {
  try {
    // If no tenant in request, return empty
    if (!req.tenant) {
      return res.status(200).json({
        success: true,
        data: null
      });
    }
    
    res.status(200).json({
      success: true,
      data: req.tenant
    });
  } catch (error) {
    console.error('Error fetching current tenant:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching current tenant',
      error: error.message
    });
  }
};

/**
 * Get tenant by subdomain
 */
exports.getTenantBySubdomain = async (req, res) => {
  try {
    const { subdomain } = req.params;
    
    // Sanitize subdomain
    const sanitizedSubdomain = subdomain.toLowerCase().trim();
    
    if (!sanitizedSubdomain) {
      return res.status(400).json({
        success: false,
        message: 'Subdomain is required'
      });
    }
    
    const masterConn = getMasterConnection();
    const Tenant = masterConn.model('Tenant');
    
    // Find tenant by name (converted to subdomain format)
    // This assumes your subdomain would be derived from the tenant name
    // You might need to adjust this logic based on how you generate subdomains
    const tenants = await Tenant.find({ active: true });
    
    // Find tenant where name matches the subdomain (ignoring spaces and special chars)
    const tenant = tenants.find(t => {
      const tenantSubdomain = t.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return tenantSubdomain === sanitizedSubdomain;
    });
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        _id: tenant._id,
        name: tenant.name,
        logoUrl: tenant.logoUrl,
        primaryColor: tenant.primaryColor,
        secondaryColor: tenant.secondaryColor
      }
    });
  } catch (error) {
    console.error('Error fetching tenant by subdomain:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching clinic',
      error: error.message
    });
  }
};