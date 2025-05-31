// server/src/controllers/tenantController.js - ENHANCED FOR FRONTEND SUPPORT
const { getMasterConnection } = require('../config/dbMaster');
const dbManager = require('../utils/dbManager');
const PDFDocument = require('pdfkit');

/**
 * Generate unique tenant ID with format NLX-YYYY-###
 */
const generateTenantId = async (Tenant) => {
  const currentYear = new Date().getFullYear();
  const prefix = `NLX-${currentYear}`;
  
  // Find the highest existing number for this year
  const existingTenants = await Tenant.find({
    tenantId: { $regex: `^${prefix}-` }
  }).sort({ tenantId: -1 }).limit(1);
  
  let nextNumber = 1;
  if (existingTenants.length > 0) {
    const lastId = existingTenants[0].tenantId;
    const lastNumber = parseInt(lastId.split('-')[2]);
    nextNumber = lastNumber + 1;
  }
  
  // Format with leading zeros (e.g., 001, 002, etc.)
  const formattedNumber = nextNumber.toString().padStart(3, '0');
  return `${prefix}-${formattedNumber}`;
};

/**
 * Get tenant statistics (doctor count, patient count)
 */
/**
 * Get tenant statistics (doctor count, patient count) - FIXED VERSION
 * Now actually queries the tenant database instead of returning mock data
 */
/**
 * Get tenant statistics (doctor count, patient count) - FIXED VERSION
 * Now counts all users regardless of isActive status
 */
const getTenantStatistics = async (tenantId) => {
  try {
    console.log(`📊 Fetching statistics for tenant: ${tenantId}`);
    
    // Connect to the specific tenant database
    const tenantConnection = await dbManager.connectTenant(tenantId);
    
    if (!tenantConnection) {
      console.error(`❌ Failed to connect to tenant database: ${tenantId}`);
      return { doctorCount: 0, patientCount: 0 };
    }
    
    // Get the User model from the tenant connection
    const UserModel = tenantConnection.model('User');
    
    // Count doctors (removed isActive filter)
    const doctorCount = await UserModel.countDocuments({ 
      role: 'doctor'
    });
    
    // Count patients (removed isActive filter)
    const patientCount = await UserModel.countDocuments({ 
      role: 'patient'
    });
    
    console.log(`✅ Statistics for tenant ${tenantId}: ${doctorCount} doctors, ${patientCount} patients`);
    
    return { doctorCount, patientCount };
  } catch (error) {
    console.error(`❌ Error getting tenant statistics for ${tenantId}:`, error);
    return { doctorCount: 0, patientCount: 0 };
  }
};

/**
 * Get all tenants with pagination, filtering, and search - Enhanced for frontend
 */
exports.getAllTenants = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = 'all',
      location = 'all',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const masterConn = getMasterConnection();
    const Tenant = masterConn.model('Tenant');
    
    // Build filter query
    const filter = {};
    
    // Status filter
    if (status !== 'all') {
      filter.active = status === 'active';
    }
    
    // Location filter
    if (location !== 'all') {
      filter.location = location;
    }
    
    // Search filter (name or tenantId)
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { tenantId: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Build sort object
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const tenants = await Tenant.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    // Get total count for pagination
    const total = await Tenant.countDocuments(filter);
    
    // Add statistics to each tenant
    const tenantsWithStats = await Promise.all(
      tenants.map(async (tenant) => {
        const stats = await getTenantStatistics(tenant._id);
        return {
          ...tenant,
          doctorCount: stats.doctorCount,
          patientCount: stats.patientCount
        };
      })
    );
    
    res.status(200).json({
      success: true,
      data: tenantsWithStats,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
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
 * Create a new tenant - Enhanced with auto-generated tenant ID and location
 */
exports.createTenant = async (req, res) => {
  try {
    const {
      name,
      adminEmail,
      location,
      logoUrl,
      primaryColor,
      secondaryColor
    } = req.body;
    
    // Validate required fields
    if (!name || !adminEmail || !location) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, adminEmail, and location are required'
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(adminEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }
    
    const masterConn = getMasterConnection();
    const Tenant = masterConn.model('Tenant');
    
    // Check if tenant with same name or email already exists
    const existingTenant = await Tenant.findOne({
      $or: [
        { name: name },
        { adminEmail: adminEmail }
      ]
    });
    
    if (existingTenant) {
      return res.status(400).json({
        success: false,
        message: 'A clinic with this name or email already exists'
      });
    }
    
    // Auto-generate tenant ID
    const tenantId = await generateTenantId(Tenant);
    
    // Auto-generate database name from clinic name
    const dbName = `neurolex_${name.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .substring(0, 20)}`; // Limit length
    
    // Create new tenant
    const newTenant = new Tenant({
      tenantId,
      name,
      dbName,
      adminEmail,
      location,
      logoUrl: logoUrl || '/logo.svg',
      primaryColor: primaryColor || '#4CAF50',
      secondaryColor: secondaryColor || '#2196F3',
      active: true,
      databaseCreated: false
    });
    
    const savedTenant = await newTenant.save();
    
    // Create a new database for the tenant
    const dbResult = await dbManager.createTenantDatabase(savedTenant._id);
    
    if (!dbResult.success) {
      return res.status(201).json({
        success: true,
        warning: true,
        message: 'Clinic created successfully, but database creation failed. You can retry later.',
        dbError: dbResult.error,
        data: savedTenant
      });
    }
    
    // Update tenant to mark database as created
    savedTenant.databaseCreated = true;
    await savedTenant.save();
    
    // Add statistics to response
    const stats = await getTenantStatistics(savedTenant._id);
    const tenantWithStats = {
      ...savedTenant.toObject(),
      doctorCount: stats.doctorCount,
      patientCount: stats.patientCount
    };
    
    res.status(201).json({
      success: true,
      message: 'Clinic created successfully with dedicated database',
      data: tenantWithStats
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
 * Update tenant details - Enhanced with location support
 */
exports.updateTenant = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      adminEmail,
      location,
      logoUrl,
      primaryColor,
      secondaryColor
    } = req.body;
    
    const masterConn = getMasterConnection();
    const Tenant = masterConn.model('Tenant');
    
    const tenant = await Tenant.findById(id);
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found'
      });
    }
    
    // Validate email if provided
    if (adminEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(adminEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }
      
      // Check if email is already used by another tenant
      const existingTenant = await Tenant.findOne({
        adminEmail: adminEmail,
        _id: { $ne: id }
      });
      
      if (existingTenant) {
        return res.status(400).json({
          success: false,
          message: 'Email already used by another clinic'
        });
      }
    }
    
    // Update fields if provided
    if (name !== undefined) tenant.name = name;
    if (adminEmail !== undefined) tenant.adminEmail = adminEmail;
    if (location !== undefined) tenant.location = location;
    if (logoUrl !== undefined) tenant.logoUrl = logoUrl;
    if (primaryColor !== undefined) tenant.primaryColor = primaryColor;
    if (secondaryColor !== undefined) tenant.secondaryColor = secondaryColor;
    
    await tenant.save();
    
    // Add statistics to response
    const stats = await getTenantStatistics(tenant._id);
    const tenantWithStats = {
      ...tenant.toObject(),
      doctorCount: stats.doctorCount,
      patientCount: stats.patientCount
    };
    
    res.status(200).json({
      success: true,
      message: 'Clinic updated successfully',
      data: tenantWithStats
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
 * Get tenant by ID - Enhanced with statistics
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
    
    // Add statistics to response
    const stats = await getTenantStatistics(tenant._id);
    const tenantWithStats = {
      ...tenant.toObject(),
      doctorCount: stats.doctorCount,
      patientCount: stats.patientCount
    };
    
    res.status(200).json({
      success: true,
      data: tenantWithStats
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
 * Delete tenant - Enhanced with proper database cleanup
 */
exports.deleteTenant = async (req, res) => {
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
    
    // Store tenant info for logging
    const tenantName = tenant.name;
    const dbName = tenant.dbName;
    
    // 🚨 NEW: Delete the actual tenant database
    console.log(`🗑️ Deleting database for tenant: ${tenantName} (${dbName})`);
    const dbDeleteResult = await dbManager.deleteTenantDatabase(id);
    
    if (!dbDeleteResult.success) {
      console.warn(`⚠️ Database deletion failed: ${dbDeleteResult.error}`);
      // Continue with tenant record deletion even if database deletion fails
    } else {
      console.log(`✅ Database deleted successfully: ${dbName}`);
    }
    
    // Close any active database connections
    try {
      await dbManager.closeConnection(id);
    } catch (error) {
      console.warn('Warning: Could not close tenant database connection:', error.message);
    }
    
    // Delete the tenant record from master database
    await Tenant.findByIdAndDelete(id);
    
    console.log(`✅ Tenant record deleted: ${tenantName}`);
    
    res.status(200).json({
      success: true,
      message: `Clinic "${tenantName}" and its database deleted successfully`,
      dbDeleted: dbDeleteResult.success,
      dbError: dbDeleteResult.success ? null : dbDeleteResult.error
    });
  } catch (error) {
    console.error('Error deleting tenant:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting clinic',
      error: error.message
    });
  }
};

/**
 * Export tenants to PDF
 */
exports.exportTenantsToPdf = async (req, res) => {
  try {
    const {
      search = '',
      status = 'all',
      location = 'all'
    } = req.query;

    const masterConn = getMasterConnection();
    const Tenant = masterConn.model('Tenant');
    
    // Build filter query (same as getAllTenants)
    const filter = {};
    
    if (status !== 'all') {
      filter.active = status === 'active';
    }
    
    if (location !== 'all') {
      filter.location = location;
    }
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { tenantId: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Get all matching tenants
    const tenants = await Tenant.find(filter)
      .sort({ name: 1 })
      .lean();
    
    // Add statistics to tenants
    const tenantsWithStats = await Promise.all(
      tenants.map(async (tenant) => {
        const stats = await getTenantStatistics(tenant._id);
        return {
          ...tenant,
          doctorCount: stats.doctorCount,
          patientCount: stats.patientCount
        };
      })
    );
    
    // Create PDF
    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="tenants-report-${new Date().toISOString().slice(0, 10)}.pdf"`);
    
    // Pipe PDF to response
    doc.pipe(res);
    
    // Add title
    doc.fontSize(20).font('Helvetica-Bold').text('Neurolex Tenants Report', { align: 'center' });
    doc.moveDown();
    
    // Add generation info
    doc.fontSize(10).font('Helvetica').text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'right' });
    doc.text(`Total Tenants: ${tenantsWithStats.length}`, { align: 'right' });
    doc.moveDown(2);
    
    // Add table headers
    const startY = doc.y;
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text('Clinic Name', 50, startY, { width: 120 });
    doc.text('Tenant ID', 170, startY, { width: 80 });
    doc.text('Status', 250, startY, { width: 60 });
    doc.text('Location', 310, startY, { width: 120 });
    doc.text('Doctors', 430, startY, { width: 50 });
    doc.text('Patients', 480, startY, { width: 50 });
    
    // Add line under headers
    doc.moveTo(50, startY + 15).lineTo(530, startY + 15).stroke();
    doc.moveDown();
    
    // Add tenant data
    doc.font('Helvetica').fontSize(10);
    tenantsWithStats.forEach((tenant, index) => {
      const y = doc.y;
      
      // Check if we need a new page
      if (y > 700) {
        doc.addPage();
        doc.y = 50;
      }
      
      doc.text(tenant.name || 'N/A', 50, doc.y, { width: 120 });
      doc.text(tenant.tenantId || 'N/A', 170, doc.y, { width: 80 });
      doc.text(tenant.active ? 'Active' : 'Inactive', 250, doc.y, { width: 60 });
      doc.text(tenant.location || 'N/A', 310, doc.y, { width: 120 });
      doc.text(tenant.doctorCount.toString(), 430, doc.y, { width: 50 });
      doc.text(tenant.patientCount.toString(), 480, doc.y, { width: 50 });
      
      doc.moveDown(0.5);
    });
    
    // Add footer
    doc.fontSize(8).text(
      'This report contains confidential information. Handle with care.',
      50,
      doc.page.height - 50,
      { align: 'center' }
    );
    
    // Finalize PDF
    doc.end();
    
  } catch (error) {
    console.error('Error exporting tenants to PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting PDF',
      error: error.message
    });
  }
};

/**
 * Get tenant statistics endpoint
 */
exports.getTenantStats = async (req, res) => {
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
    
    const stats = await getTenantStatistics(id);
    
    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching tenant stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics',
      error: error.message
    });
  }
};

// ===== EXISTING METHODS (UNCHANGED) =====

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
 * Get public tenant info by ID - accessible without authentication
 * Only returns non-sensitive information INCLUDING hirsSettings for feature control
 * 🚨 FIXED: Now saves default HIRS settings to database instead of just returning them
 */
exports.getPublicTenantById = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🔍 [getPublicTenantById] Fetching public tenant info for ID: ${id}`);
    
    const masterConn = getMasterConnection();
    const Tenant = masterConn.model('Tenant');
    
    // 🚨 FIXED: Find tenant without select to allow saving
    const tenant = await Tenant.findById(id);
    
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

    // 🚨 CRITICAL FIX: Save default HIRS settings to database if they don't exist
    if (!tenant.hirsSettings || !Array.isArray(tenant.hirsSettings) || tenant.hirsSettings.length === 0) {
      console.log(`⚠️ [getPublicTenantById] No HIRS settings found for tenant ${id}, creating and SAVING defaults to database`);
      
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
      
      // 🚨 SAVE TO DATABASE instead of just using defaults
      tenant.hirsSettings = defaultHirsSettings;
      await tenant.save();
      
      console.log(`✅ [getPublicTenantById] Default HIRS settings SAVED to database for tenant ${id}`);
    } else {
      console.log(`✅ [getPublicTenantById] Found existing ${tenant.hirsSettings.length} HIRS settings for tenant ${id}`);
    }

    // Structure response to match TenantContext expectations
    const responseData = {
      platformName: tenant.name || 'NEUROLEX',
      platformDescription: tenant.description || 'AI-powered mental wellness platform',
      systemLogo: {
        light: tenant.logoUrl || null,
        dark: tenant.darkLogoUrl || null
      },
      favicon: {
        light: tenant.faviconUrl || null,
        dark: tenant.darkFaviconUrl || null
      },
      primaryColor: tenant.primaryColor || '#4CAF50',
      secondaryColor: tenant.secondaryColor || '#2196F3',
      hirsSettings: tenant.hirsSettings, // Now guaranteed to exist in database
      active: tenant.active
    };

    console.log(`✅ [getPublicTenantById] Successfully returning tenant data with ${tenant.hirsSettings.length} HIRS settings`);
    console.log(`🔍 [getPublicTenantById] HIRS settings preview:`, tenant.hirsSettings.map(h => ({ 
      id: h.id, 
      name: h.name, 
      isActive: h.isActive 
    })));
    
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