// server/src/routes/tenantSettingsRoutes.js
const express = require('express');
const router = express.Router();
const { getMasterConnection } = require('../config/dbMaster');

// ✅ PUBLIC ENDPOINT: Get tenant settings for frontend consumption
// This endpoint is accessible without authentication for loading theme data
router.get('/public/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    console.log(`🔍 [PUBLIC] Getting tenant settings for: ${tenantId}`);
    
    // Validate tenantId format  
    if (!tenantId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tenant ID format'
      });
    }
    
    // Get master connection
    const masterConn = getMasterConnection();
    if (!masterConn) {
      throw new Error('Failed to connect to master database');
    }
    
    const Tenant = masterConn.model('Tenant');
    
    // Find tenant
    const tenant = await Tenant.findById(tenantId).select(
      'name description logoUrl darkLogoUrl faviconUrl darkFaviconUrl primaryColor secondaryColor hirsSettings'
    );
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }
    
    // Return public tenant settings
    const publicSettings = {
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
      hirsSettings: tenant.hirsSettings || []
    };
    
    // Add cache headers for better performance
    res.set({
      'Cache-Control': 'public, max-age=300', // 5 minutes cache
      'ETag': `"${tenant.updatedAt ? tenant.updatedAt.getTime() : Date.now()}"`
    });
    
    console.log('✅ Public tenant settings retrieved successfully');
    res.json({
      success: true,
      data: publicSettings
    });
  } catch (error) {
    console.error('❌ Error getting public tenant settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get tenant settings',
      error: error.message
    });
  }
});

module.exports = router;
