// server/src/controllers/adminController.js
const User = require('../models/User');
const JournalEntry = require('../models/JournalEntry');
const FormTemplate = require('../models/FormTemplate');
const Mood = require('../models/Mood');
const Notification = require('../models/Notification');
const PatientDoctorAssociation = require('../models/PatientDoctorAssociation');
const { sendEmail } = require('../utils/emailService');
const { getMasterConnection } = require('../config/dbMaster');
const dbManager = require('../utils/dbManager');
const PDFDocument = require('pdfkit'); // Add this import for PDF generation

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const multer = require('multer');
const { logoStorage, faviconStorage, deleteCloudinaryImage, extractPublicId } = require('../services/cloudinary');


// ===== PATIENT MANAGEMENT FUNCTIONS (NEW) =====

// Admin login function
exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('🔐 Admin login attempt:', { email });
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }
    
    // Check for admin credentials from environment variables first
    const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@neurolex.com';
    const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'AdminPassword123!';
    
    console.log('🔑 Expected admin credentials:', { 
      adminEmail, 
      adminPassword: adminPassword ? 'set' : 'not set' 
    });
    
    // Check if this is the default admin login
    if (email === adminEmail && password === adminPassword) {
      console.log('✅ Default admin login successful');
      
      // Generate JWT token
      const token = jwt.sign(
        { 
          id: 'admin_default',
          email: adminEmail,
          role: 'admin',
          name: 'System Administrator'
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );
      
      return res.status(200).json({
        success: true,
        message: 'Admin login successful',
        token,
        user: {
          id: 'admin_default',
          email: adminEmail,
          role: 'admin',
          firstName: 'System',
          lastName: 'Administrator',
          name: 'System Administrator'
        }
      });
    }
    
    // If not default admin, check database for admin users
    try {
      // Find user by email
      const user = await User.findOne({ email: email.toLowerCase() });
      
      if (!user) {
        console.log('❌ Admin user not found:', email);
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }
      
      // Check if user is admin
      if (user.role !== 'admin') {
        console.log('❌ User is not admin:', { email, role: user.role });
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }
      
      // Check password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      if (!isPasswordValid) {
        console.log('❌ Invalid password for admin:', email);
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }
      
      console.log('✅ Database admin login successful:', email);
      
      // Generate JWT token
      const token = jwt.sign(
        { 
          id: user._id,
          email: user.email,
          role: user.role,
          name: `${user.firstName} ${user.lastName}`
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );
      
      // Update last login
      user.lastLogin = new Date();
      await user.save();
      
      return res.status(200).json({
        success: true,
        message: 'Admin login successful',
        token,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          name: `${user.firstName} ${user.lastName}`
        }
      });
    } catch (dbError) {
      console.error('❌ Database error during admin login:', dbError);
      return res.status(500).json({
        success: false,
        message: 'Database error during authentication'
      });
    }
  } catch (error) {
    console.error('❌ Admin login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Admin logout function
exports.adminLogout = async (req, res) => {
  try {
    console.log('🔓 Admin logout');
    
    // In a more sophisticated system, you might want to blacklist the token
    // For now, we'll just return success and let the client handle token removal
    
    return res.status(200).json({
      success: true,
      message: 'Admin logout successful'
    });
  } catch (error) {
    console.error('❌ Admin logout error:', error);
    return res.status(500).json({
      success: false,
      message: 'Logout failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get admin profile
exports.getAdminProfile = async (req, res) => {
  try {
    console.log('👤 Getting admin profile for:', req.user.email);
    
    return res.status(200).json({
      success: true,
      user: {
        id: req.user.id || req.user._id,
        email: req.user.email,
        role: req.user.role,
        firstName: req.user.firstName || 'System',
        lastName: req.user.lastName || 'Administrator',
        name: req.user.name || `${req.user.firstName} ${req.user.lastName}` || 'System Administrator'
      }
    });
  } catch (error) {
    console.error('❌ Get admin profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get admin profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


// Get all patients across all tenants
exports.getAllPatients = async (req, res) => {
  try {
    // Get master connection to access tenants
    const masterConn = getMasterConnection();
    const Tenant = masterConn.model('Tenant');
    
    // Build query for tenants
    const tenantQuery = { active: true };
    if (req.query.tenantId && req.query.tenantId !== 'All') {
      tenantQuery._id = req.query.tenantId;
    }
    
    // Get active tenants
    const tenants = await Tenant.find(tenantQuery);
    
    if (tenants.length === 0) {
      return res.json({
        success: true,
        data: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          pages: 0
        }
      });
    }
    
    // Build patient query
    const patientQuery = { role: 'patient' }; // Only fetch patients
    
    if (req.query.status) {
      patientQuery.accountStatus = req.query.status;
    }
    
    if (req.query.gender) {
      patientQuery.gender = req.query.gender;
    }
    
    if (req.query.search) {
      patientQuery.$or = [
        { firstName: { $regex: req.query.search, $options: 'i' } },
        { lastName: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Array to store all patients
    let allPatients = [];
    let totalPatients = 0;
    
    // Connect to each tenant database and fetch patients
    for (const tenant of tenants) {
      try {
        // Connect to tenant database
        const connection = await dbManager.connectTenant(tenant._id);
        
        if (!connection) {
          console.warn(`Could not connect to tenant database: ${tenant.name}`);
          continue;
        }
        
        // Get User model
        const User = connection.model('User');
        
        // Count matching patients
        const patientCount = await User.countDocuments(patientQuery);
        totalPatients += patientCount;
        
        // Skip this tenant if it doesn't contribute to the current page
        if (skip >= totalPatients) {
          continue;
        }
        
        // Calculate how many patients to fetch from this tenant
        const tenantSkip = Math.max(0, skip - (totalPatients - patientCount));
        const tenantLimit = Math.min(limit - allPatients.length, patientCount - tenantSkip);
        
        if (tenantLimit <= 0) {
          continue;
        }
        
        // Fetch patients from this tenant
        const patients = await User.find(patientQuery)
          .skip(tenantSkip)
          .limit(tenantLimit)
          .sort({ createdAt: -1 });
        
        // Add tenant info to each patient
        const patientsWithTenant = patients.map(patient => {
          const patientObj = patient.toObject();
          patientObj.tenantId = tenant._id;
          patientObj.tenantName = tenant.name;
          return patientObj;
        });
        
        // Add to all patients array
        allPatients = [...allPatients, ...patientsWithTenant];
        
        // Stop if we have enough patients for this page
        if (allPatients.length >= limit) {
          break;
        }
      } catch (error) {
        console.error(`Error fetching patients from tenant ${tenant.name}:`, error);
      }
    }
    
    return res.json({
      success: true,
      data: allPatients,
      pagination: {
        page,
        limit,
        total: totalPatients,
        pages: Math.ceil(totalPatients / limit)
      }
    });
  } catch (error) {
    console.error('Error getting patients across tenants:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve patients',
      error: error.message
    });
  }
};

// Delete a patient
exports.deletePatient = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { tenantId } = req.query;
    
    if (!patientId || !tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID and Tenant ID are required'
      });
    }
    
    // Connect to tenant database
    const connection = await dbManager.connectTenant(tenantId);
    
    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Tenant database not found'
      });
    }
    
    // Get User model
    const User = connection.model('User');
    
    // Delete patient
    const result = await User.deleteOne({
      _id: patientId,
      role: 'patient' // Ensure we only delete patients
    });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }
    
    return res.json({
      success: true,
      message: 'Patient deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting patient:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete patient',
      error: error.message
    });
  }
};

// Get all tenants for filtering
exports.getTenants = async (req, res) => {
  try {
    // Get master connection
    const masterConn = getMasterConnection();
    const Tenant = masterConn.model('Tenant');
    
    // Get all active tenants
    const tenants = await Tenant.find({ active: true })
      .select('name logoUrl primaryColor secondaryColor');
    
    return res.json({
      success: true,
      data: tenants
    });
  } catch (error) {
    console.error('Error getting tenants:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve tenants',
      error: error.message
    });
  }
};

// Export patients to PDF
exports.exportPatientsToPdf = async (req, res) => {
  try {
    // Get master connection to access tenants
    const masterConn = getMasterConnection();
    const Tenant = masterConn.model('Tenant');
    
    // Build query for tenants
    const tenantQuery = { active: true };
    if (req.query.tenantId && req.query.tenantId !== 'All') {
      tenantQuery._id = req.query.tenantId;
    }
    
    // Get active tenants
    const tenants = await Tenant.find(tenantQuery);
    
    if (tenants.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active tenants found'
      });
    }
    
    // Build patient query
    const patientQuery = { role: 'patient' }; // Only fetch patients
    
    if (req.query.status) {
      patientQuery.accountStatus = req.query.status;
    }
    
    if (req.query.gender) {
      patientQuery.gender = req.query.gender;
    }
    
    if (req.query.search) {
      patientQuery.$or = [
        { firstName: { $regex: req.query.search, $options: 'i' } },
        { lastName: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    
    // Array to store all patients
    let allPatients = [];
    
    // Connect to each tenant database and fetch patients
    for (const tenant of tenants) {
      try {
        // Connect to tenant database
        const connection = await dbManager.connectTenant(tenant._id);
        
        if (!connection) {
          console.warn(`Could not connect to tenant database: ${tenant.name}`);
          continue;
        }
        
        // Get User model
        const User = connection.model('User');
        
        // Fetch patients from this tenant (no pagination for PDF export)
        const patients = await User.find(patientQuery).sort({ createdAt: -1 });
        
        // Add tenant info to each patient
        const patientsWithTenant = patients.map(patient => {
          const patientObj = patient.toObject();
          patientObj.tenantId = tenant._id;
          patientObj.tenantName = tenant.name;
          return patientObj;
        });
        
        // Add to all patients array
        allPatients = [...allPatients, ...patientsWithTenant];
      } catch (error) {
        console.error(`Error fetching patients from tenant ${tenant.name}:`, error);
      }
    }
    
    // Generate PDF using PDFKit
    const doc = new PDFDocument();
    
    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=patients-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    
    // Pipe the PDF to the response
    doc.pipe(res);
    
    // Add PDF content
    doc.fontSize(18).text('Patients Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Generated on: ${new Date().toLocaleDateString()}`);
    doc.moveDown();
    
    // Add filter information
    doc.fontSize(14).text('Filters Applied:');
    doc.fontSize(10);
    
    if (req.query.tenantId && req.query.tenantId !== 'All') {
      const tenantName = tenants.find(t => t._id.toString() === req.query.tenantId)?.name || 'Unknown';
      doc.text(`Clinic: ${tenantName}`);
    } else {
      doc.text('Clinic: All Clinics');
    }
    
    if (req.query.status) {
      doc.text(`Status: ${req.query.status}`);
    } else {
      doc.text('Status: All');
    }
    
    if (req.query.gender) {
      doc.text(`Gender: ${req.query.gender}`);
    } else {
      doc.text('Gender: All');
    }
    
    if (req.query.search) {
      doc.text(`Search: "${req.query.search}"`);
    }
    
    doc.moveDown();
    
    // Add patient table
    doc.fontSize(14).text(`Total Patients: ${allPatients.length}`);
    doc.moveDown();
    
    if (allPatients.length > 0) {
      // Table header
      const tableTop = doc.y;
      const tableWidth = 500;
      
      // Column widths
      const colWidths = {
        name: 150,
        email: 150,
        clinic: 100,
        status: 100
      };
      
      // Draw header
      doc.fontSize(10);
      doc.font('Helvetica-Bold');
      doc.text('Name', 50, tableTop);
      doc.text('Email', 50 + colWidths.name, tableTop);
      doc.text('Clinic', 50 + colWidths.name + colWidths.email, tableTop);
      doc.text('Status', 50 + colWidths.name + colWidths.email + colWidths.clinic, tableTop);
      
      // Draw horizontal line
      doc.moveTo(50, tableTop + 15)
         .lineTo(50 + tableWidth, tableTop + 15)
         .stroke();
      
      // Draw patient rows
      doc.font('Helvetica');
      let rowTop = tableTop + 20;
      
      for (const patient of allPatients) {
        // Add new page if we're near the bottom
        if (rowTop > doc.page.height - 100) {
          doc.addPage();
          rowTop = 50;
        }
        
        const name = `${patient.firstName} ${patient.lastName}`;
        
        doc.text(name, 50, rowTop, { width: colWidths.name });
        doc.text(patient.email, 50 + colWidths.name, rowTop, { width: colWidths.email });
        doc.text(patient.tenantName, 50 + colWidths.name + colWidths.email, rowTop, { width: colWidths.clinic });
        doc.text(patient.accountStatus || 'Unknown', 50 + colWidths.name + colWidths.email + colWidths.clinic, rowTop, { width: colWidths.status });
        
        rowTop += 20;
      }
    } else {
      doc.text('No patients match the selected filters.');
    }
    
    // Finalize the PDF
    doc.end();
  } catch (error) {
    console.error('Error exporting patients to PDF:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to export patients to PDF',
      error: error.message
    });
  }
};

// ===== MULTI-TENANT DOCTOR VERIFICATION FUNCTIONS =====

// Get all pending doctor verifications from all tenants
exports.getPendingDoctors = async (req, res) => {
  try {
    console.log('Getting pending doctors from all tenants');
    
    // First check if multi-tenant is enabled
    if (process.env.ENABLE_MULTI_TENANT !== 'true') {
      // Fallback to single tenant mode
      return getSingleTenantPendingDoctors(req, res);
    }
    
    // Get master connection to access tenant information
    const masterConn = getMasterConnection();
    if (!masterConn) {
      console.error('Failed to connect to master database');
      return res.status(500).json({
        success: false,
        message: 'Database connection error'
      });
    }
    
    // Get Tenant model from master connection
    const Tenant = masterConn.model('Tenant');
    
    // Get all active tenants
    const tenants = await Tenant.find({ active: true });
    console.log(`Found ${tenants.length} active tenants`);
    
    let allPendingDoctors = [];
    
    // Loop through each tenant and collect pending doctors
    for (const tenant of tenants) {
      try {
        // Connect to tenant database
        const tenantConn = await dbManager.connectTenant(tenant._id.toString());
        if (!tenantConn) {
          console.warn(`Could not connect to tenant database: ${tenant.name}`);
          continue; // Skip this tenant and proceed to the next
        }
        
        // Get User model from tenant connection
        const User = tenantConn.model('User');
        
        // Find pending doctors in this tenant
        const pendingDoctors = await User.find({ 
          role: 'doctor', 
          isVerified: false,
          verificationStatus: 'pending' 
        })
          .select('firstName lastName email specialization createdAt')
          .sort({ createdAt: 1 }); // Oldest first
        
        console.log(`Found ${pendingDoctors.length} pending doctors in tenant: ${tenant.name}`);
        
        // Add tenant information to each doctor object
        const doctorsWithTenantInfo = pendingDoctors.map(doctor => {
          const doctorObj = doctor.toObject();
          doctorObj.tenantId = tenant._id;
          doctorObj.tenantName = tenant.name;
          return doctorObj;
        });
        
        // Add to all pending doctors
        allPendingDoctors = [...allPendingDoctors, ...doctorsWithTenantInfo];
      } catch (error) {
        console.error(`Error fetching doctors from tenant ${tenant.name}:`, error);
        // Continue with other tenants even if one fails
      }
    }
    
    res.status(200).json({
      success: true,
      count: allPendingDoctors.length,
      data: allPendingDoctors
    });
  } catch (error) {
    console.error('Get pending doctors error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending doctor verifications',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all verified doctors from all tenants
exports.getVerifiedDoctors = async (req, res) => {
  try {
    console.log('Getting verified doctors from all tenants');
    
    // First check if multi-tenant is enabled
    if (process.env.ENABLE_MULTI_TENANT !== 'true') {
      // Fallback to single tenant mode
      return getSingleTenantVerifiedDoctors(req, res);
    }
    
    // Get master connection to access tenant information
    const masterConn = getMasterConnection();
    if (!masterConn) {
      console.error('Failed to connect to master database');
      return res.status(500).json({
        success: false,
        message: 'Database connection error'
      });
    }
    
    // Get Tenant model from master connection
    const Tenant = masterConn.model('Tenant');
    
    // Get all active tenants
    const tenants = await Tenant.find({ active: true });
    
    let allVerifiedDoctors = [];
    
    // Loop through each tenant and collect verified doctors
    for (const tenant of tenants) {
      try {
        // Connect to tenant database
        const tenantConn = await dbManager.connectTenant(tenant._id.toString());
        if (!tenantConn) {
          console.warn(`Could not connect to tenant database: ${tenant.name}`);
          continue; // Skip this tenant and proceed to the next
        }
        
        // Get User model from tenant connection
        const User = tenantConn.model('User');
        
        // Find verified doctors in this tenant
        const verifiedDoctors = await User.find({ 
          role: 'doctor', 
          isVerified: true,
          verificationStatus: 'approved' 
        })
          .select('firstName lastName email specialization verificationDate')
          .sort({ verificationDate: -1 }); // Most recently verified first
        
        console.log(`Found ${verifiedDoctors.length} verified doctors in tenant: ${tenant.name}`);
        
        // Add tenant information to each doctor object
        const doctorsWithTenantInfo = verifiedDoctors.map(doctor => {
          const doctorObj = doctor.toObject();
          doctorObj.tenantId = tenant._id;
          doctorObj.tenantName = tenant.name;
          return doctorObj;
        });
        
        // Add to all verified doctors
        allVerifiedDoctors = [...allVerifiedDoctors, ...doctorsWithTenantInfo];
      } catch (error) {
        console.error(`Error fetching doctors from tenant ${tenant.name}:`, error);
        // Continue with other tenants even if one fails
      }
    }
    
    res.status(200).json({
      success: true,
      count: allVerifiedDoctors.length,
      data: allVerifiedDoctors
    });
  } catch (error) {
    console.error('Get verified doctors error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch verified doctors',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all rejected doctors from all tenants
exports.getRejectedDoctors = async (req, res) => {
  try {
    console.log('Getting rejected doctors from all tenants');
    
    // First check if multi-tenant is enabled
    if (process.env.ENABLE_MULTI_TENANT !== 'true') {
      // Fallback to single tenant mode
      return getSingleTenantRejectedDoctors(req, res);
    }
    
    // Get master connection to access tenant information
    const masterConn = getMasterConnection();
    if (!masterConn) {
      console.error('Failed to connect to master database');
      return res.status(500).json({
        success: false,
        message: 'Database connection error'
      });
    }
    
    // Get Tenant model from master connection
    const Tenant = masterConn.model('Tenant');
    
    // Get all active tenants
    const tenants = await Tenant.find({ active: true });
    
    let allRejectedDoctors = [];
    
    // Loop through each tenant and collect rejected doctors
    for (const tenant of tenants) {
      try {
        // Connect to tenant database
        const tenantConn = await dbManager.connectTenant(tenant._id.toString());
        if (!tenantConn) {
          console.warn(`Could not connect to tenant database: ${tenant.name}`);
          continue; // Skip this tenant and proceed to the next
        }
        
        // Get User model from tenant connection
        const User = tenantConn.model('User');
        
        // Find rejected doctors in this tenant
        const rejectedDoctors = await User.find({ 
          role: 'doctor', 
          isVerified: false,
          verificationStatus: 'rejected' 
        })
          .select('firstName lastName email specialization verificationDate rejectionReason')
          .sort({ verificationDate: -1 }); // Most recently rejected first
        
        console.log(`Found ${rejectedDoctors.length} rejected doctors in tenant: ${tenant.name}`);
        
        // Add tenant information to each doctor object
        const doctorsWithTenantInfo = rejectedDoctors.map(doctor => {
          const doctorObj = doctor.toObject();
          doctorObj.tenantId = tenant._id;
          doctorObj.tenantName = tenant.name;
          return doctorObj;
        });
        
        // Add to all rejected doctors
        allRejectedDoctors = [...allRejectedDoctors, ...doctorsWithTenantInfo];
      } catch (error) {
        console.error(`Error fetching doctors from tenant ${tenant.name}:`, error);
        // Continue with other tenants even if one fails
      }
    }
    
    res.status(200).json({
      success: true,
      count: allRejectedDoctors.length,
      data: allRejectedDoctors
    });
  } catch (error) {
    console.error('Get rejected doctors error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rejected doctors',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get doctor details for verification (with tenant awareness)
exports.getDoctorDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId } = req.query; // Get tenant ID from query parameter
    
    console.log(`Getting doctor details for ID: ${id}, Tenant ID: ${tenantId || 'not specified'}`);
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Doctor ID is required'
      });
    }
    
    // If multi-tenant is enabled
    if (process.env.ENABLE_MULTI_TENANT === 'true') {
      // If a specific tenant ID is provided, search that tenant only
      if (tenantId) {
        console.log(`Searching for doctor in specified tenant: ${tenantId}`);
        
        // Connect to tenant database
        const tenantConn = await dbManager.connectTenant(tenantId);
        if (!tenantConn) {
          console.error(`Failed to connect to tenant database: ${tenantId}`);
          return res.status(500).json({
            success: false,
            message: 'Database connection error'
          });
        }
        
        // Get User model from tenant connection
        const User = tenantConn.model('User');
        
        // Find doctor by ID
        const doctor = await User.findOne({
          _id: id,
          role: 'doctor'
        });
        
        if (!doctor) {
          return res.status(404).json({
            success: false,
            message: 'Doctor not found'
          });
        }
        
        // Get tenant info to include with doctor details
        const masterConn = getMasterConnection();
        const Tenant = masterConn.model('Tenant');
        const tenant = await Tenant.findById(tenantId).select('name logoUrl');
        
        // Combine doctor and tenant info
        const doctorObj = doctor.toObject();
        doctorObj.tenantId = tenantId;
        doctorObj.tenantName = tenant ? tenant.name : 'Unknown Tenant';
        doctorObj.tenantLogo = tenant ? tenant.logoUrl : null;
        
        return res.status(200).json({
          success: true,
          data: doctorObj
        });
      } 
      // If no tenant ID provided, search across all tenants
      else {
        console.log('No tenant ID provided, searching across all tenants');
        
        // Get master connection to access tenant information
        const masterConn = getMasterConnection();
        if (!masterConn) {
          console.error('Failed to connect to master database');
          return res.status(500).json({
            success: false,
            message: 'Database connection error'
          });
        }
        
        // Get Tenant model from master connection
        const Tenant = masterConn.model('Tenant');
        
        // Get all active tenants
        const tenants = await Tenant.find({ active: true });
        console.log(`Searching through ${tenants.length} active tenants for doctor ${id}`);
        
        // Search for doctor in each tenant
        for (const tenant of tenants) {
          try {
            // Connect to tenant database
            const tenantConn = await dbManager.connectTenant(tenant._id.toString());
            if (!tenantConn) {
              console.warn(`Could not connect to tenant database: ${tenant.name}`);
              continue; // Skip this tenant and proceed to the next
            }
            
            // Get User model from tenant connection
            const User = tenantConn.model('User');
            
            // Find doctor by ID
            const doctor = await User.findOne({
              _id: id,
              role: 'doctor'
            });
            
            if (doctor) {
              console.log(`Doctor found in tenant: ${tenant.name}`);
              
              // Add tenant information to doctor object
              const doctorObj = doctor.toObject();
              doctorObj.tenantId = tenant._id;
              doctorObj.tenantName = tenant.name;
              doctorObj.tenantLogo = tenant.logoUrl;
              
              return res.status(200).json({
                success: true,
                data: doctorObj
              });
            }
          } catch (error) {
            console.error(`Error searching in tenant ${tenant.name}:`, error);
            // Continue with other tenants even if one fails
          }
        }
        
        // If we reach here, the doctor wasn't found in any tenant
        console.log(`Doctor with ID ${id} not found in any tenant`);
        return res.status(404).json({
          success: false,
          message: 'Doctor not found in any tenant'
        });
      }
    } 
    // Fall back to single tenant mode
    else {
      console.log('Using single tenant mode for doctor details');
      return getSingleTenantDoctorDetails(req, res);
    }
  } catch (error) {
    console.error('Get doctor details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch doctor details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Verify doctor (with tenant awareness)
exports.verifyDoctor = async (req, res) => {
  try {
    console.log('verifyDoctor called with doctor ID:', req.params.id);
    console.log('Request body:', req.body);
    
    const { id } = req.params;
    const { tenantId } = req.query; // Get tenant ID from query parameter
    const { verificationStatus, verificationNotes, rejectionReason } = req.body;
    
    // Validate input
    if (!['approved', 'rejected'].includes(verificationStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification status'
      });
    }
    
    if (verificationStatus === 'rejected' && !rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }
    
    // If multi-tenant is enabled
    if (process.env.ENABLE_MULTI_TENANT === 'true') {
      // If a specific tenant ID is provided, use that tenant
      if (tenantId) {
        console.log(`Using specified tenant: ${tenantId}`);
        
        // Connect to tenant database
        const tenantConn = await dbManager.connectTenant(tenantId);
        if (!tenantConn) {
          console.error(`Failed to connect to tenant database: ${tenantId}`);
          return res.status(500).json({
            success: false,
            message: 'Database connection error'
          });
        }
        
        // Get User model from tenant connection
        const User = tenantConn.model('User');
        
        // Find doctor by ID
        const doctor = await User.findOne({
          _id: id,
          role: 'doctor'
        });
        
        if (!doctor) {
          return res.status(404).json({
            success: false,
            message: 'Doctor not found in the specified tenant'
          });
        }
        
        // Log the current doctor data
        console.log('Original doctor data:', {
          id: doctor._id,
          name: `${doctor.firstName} ${doctor.lastName}`,
          currentStatus: doctor.verificationStatus,
          specialization: doctor.specialization || doctor.specialty, // Check both fields
        });
        
        try {
          // Set only the necessary fields and respect the schema
          const updateFields = {
            verificationStatus: verificationStatus,
            verificationDate: new Date(),
            isVerified: verificationStatus === 'approved',
            accountStatus: verificationStatus === 'approved' ? 'active' : 'pending'
          };
          
          // Only set these fields if they are provided and not empty
          if (verificationNotes && verificationNotes.trim() !== '') {
            updateFields.verificationNotes = verificationNotes;
          }
          
          if (rejectionReason && rejectionReason.trim() !== '') {
            updateFields.rejectionReason = rejectionReason;
          }
          // Set verifiedBy if user is available
          // Set verifiedBy if user is available - Handle default admin case  
if (req.user && req.user._id) {
  if (req.user._id === 'admin_default' || req.user.id === 'admin_default') {
    // For default admin, use a special identifier or skip this field
    updateFields.verifiedByAdmin = 'System Administrator';
  } else {
    // For database admins, use the actual ObjectId
    updateFields.verifiedBy = req.user._id;
  }
}
          
          // Use findByIdAndUpdate with runValidators: false to avoid validation errors
          const updatedDoctor = await User.findByIdAndUpdate(
            id,
            { $set: updateFields },
            { new: true, runValidators: false }
          );
          
          if (!updatedDoctor) {
            return res.status(404).json({
              success: false,
              message: 'Doctor not found or could not be updated'
            });
          }
          
          console.log('Doctor verification updated successfully');
          
          // Get tenant info for email context
          const masterConn = getMasterConnection();
          const Tenant = masterConn.model('Tenant');
          const tenant = await Tenant.findById(tenantId).select('name logoUrl');
          
          // Send notification email
          try {
            const emailTemplate = verificationStatus === 'approved' 
              ? 'doctorVerificationApproved' 
              : 'doctorVerificationRejected';
            
            await sendEmail({
              to: doctor.email,
              subject: verificationStatus === 'approved' 
                ? `Your Professional Account has been Approved - ${tenant?.name || 'Neurolex'}` 
                : `Important Information About Your Professional Account - ${tenant?.name || 'Neurolex'}`,
              template: emailTemplate,
              context: {
                doctorName: doctor.firstName,
                rejectionReason: verificationStatus === 'rejected' ? rejectionReason : null,
                loginLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`,
                tenantName: tenant?.name || 'Neurolex',
                tenantLogo: tenant?.logoUrl
              }
            });
          } catch (emailError) {
            console.error('Error sending verification email:', emailError);
          }
          
          return res.status(200).json({
            success: true,
            message: `Doctor successfully ${verificationStatus}`,
            data: {
              doctorId: updatedDoctor._id,
              verificationStatus: updatedDoctor.verificationStatus,
              verificationDate: updatedDoctor.verificationDate,
              tenantId,
              tenantName: tenant?.name || 'Unknown Tenant'
            }
          });
        } catch (updateError) {
          console.error('Error updating doctor:', updateError);
          return res.status(500).json({
            success: false,
            message: 'Failed to update doctor verification status',
            error: process.env.NODE_ENV === 'development' ? updateError.message : undefined
          });
        }
      } 
      // If no tenant ID provided, search across all tenants
      else {
        console.log('No tenant ID provided, searching across all tenants');
        
        // Get master connection to access tenant information
        const masterConn = getMasterConnection();
        if (!masterConn) {
          console.error('Failed to connect to master database');
          return res.status(500).json({
            success: false,
            message: 'Database connection error'
          });
        }
        
        // Get Tenant model from master connection
        const Tenant = masterConn.model('Tenant');
        
        // Get all active tenants
        const tenants = await Tenant.find({ active: true });
        console.log(`Searching through ${tenants.length} active tenants for doctor ${id}`);
        
        // Search for doctor in each tenant
        for (const tenant of tenants) {
          try {
            // Connect to tenant database
            const tenantConn = await dbManager.connectTenant(tenant._id.toString());
            if (!tenantConn) {
              console.warn(`Could not connect to tenant database: ${tenant.name}`);
              continue; // Skip this tenant and proceed to the next
            }
            
            // Get User model from tenant connection
            const User = tenantConn.model('User');
            
            // Find doctor by ID
            const doctor = await User.findOne({
              _id: id,
              role: 'doctor'
            });
            
            if (doctor) {
              console.log(`Found doctor in tenant: ${tenant.name}`);
              
              try {
                // Set only the necessary fields and respect the schema
                const updateFields = {
                  verificationStatus: verificationStatus,
                  verificationDate: new Date(),
                  isVerified: verificationStatus === 'approved'
                };
                
                // Only set these fields if they are provided and not empty
                if (verificationNotes && verificationNotes.trim() !== '') {
                  updateFields.verificationNotes = verificationNotes;
                }
                
                if (rejectionReason && rejectionReason.trim() !== '') {
                  updateFields.rejectionReason = rejectionReason;
                }
                
                // Set verifiedBy if user is available
                if (req.user && req.user._id) {
                  updateFields.verifiedBy = req.user._id;
                }
                
                // Use findByIdAndUpdate with runValidators: false to avoid validation errors
                const updatedDoctor = await User.findByIdAndUpdate(
                  id,
                  { $set: updateFields },
                  { new: true, runValidators: false }
                );
                
                if (!updatedDoctor) {
                  console.warn(`Doctor found but could not be updated in tenant: ${tenant.name}`);
                  continue; // Try the next tenant
                }
                
                console.log('Doctor verification updated successfully');
                
                // Send notification email
                try {
                  const emailTemplate = verificationStatus === 'approved' 
                    ? 'doctorVerificationApproved' 
                    : 'doctorVerificationRejected';
                  
                  await sendEmail({
                    to: doctor.email,
                    subject: verificationStatus === 'approved' 
                      ? `Your Professional Account has been Approved - ${tenant.name || 'Neurolex'}` 
                      : `Important Information About Your Professional Account - ${tenant.name || 'Neurolex'}`,
                    template: emailTemplate,
                    context: {
                      doctorName: doctor.firstName,
                      rejectionReason: verificationStatus === 'rejected' ? rejectionReason : null,
                      loginLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`,
                      tenantName: tenant.name || 'Neurolex',
                      tenantLogo: tenant.logoUrl
                    }
                  });
                } catch (emailError) {
                  console.error('Error sending verification email:', emailError);
                }
                
                return res.status(200).json({
                  success: true,
                  message: `Doctor successfully ${verificationStatus}`,
                  data: {
                    doctorId: updatedDoctor._id,
                    verificationStatus: updatedDoctor.verificationStatus,
                    verificationDate: updatedDoctor.verificationDate,
                    tenantId: tenant._id,
                    tenantName: tenant.name
                  }
                });
              } catch (updateError) {
                console.error(`Error updating doctor in tenant ${tenant.name}:`, updateError);
                // Continue with other tenants even if one fails
              }
            }
          } catch (error) {
            console.error(`Error searching in tenant ${tenant.name}:`, error);
            // Continue with other tenants even if one fails
          }
        }
        
        // If we reach here, the doctor wasn't found in any tenant
        console.log(`Doctor with ID ${id} not found in any tenant`);
        return res.status(404).json({
          success: false,
          message: 'Doctor not found in any tenant'
        });
      }
    } 
    // Fall back to single tenant mode
    else {
      console.log('Using single tenant mode for doctor verification');
      
      try {
        // Find doctor by ID
        const doctor = await User.findOne({
          _id: id,
          role: 'doctor'
        });
        
        if (!doctor) {
          return res.status(404).json({
            success: false,
            message: 'Doctor not found'
          });
        }
        
        // Set only the necessary fields and respect the schema
        const updateFields = {
          verificationStatus: verificationStatus,
          verificationDate: new Date(),
          isVerified: verificationStatus === 'approved'
        };
        
        // Only set these fields if they are provided and not empty
        if (verificationNotes && verificationNotes.trim() !== '') {
          updateFields.verificationNotes = verificationNotes;
        }
        
        if (rejectionReason && rejectionReason.trim() !== '') {
          updateFields.rejectionReason = rejectionReason;
        }
        
        // Set verifiedBy if user is available
        if (req.user && req.user._id) {
          updateFields.verifiedBy = req.user._id;
        }
        
        // Use findByIdAndUpdate with runValidators: false to avoid validation errors
        const updatedDoctor = await User.findByIdAndUpdate(
          id,
          { $set: updateFields },
          { new: true, runValidators: false }
        );
        
        if (!updatedDoctor) {
          return res.status(404).json({
            success: false,
            message: 'Doctor not found or could not be updated'
          });
        }
        
        // Send notification email
        try {
          const emailTemplate = verificationStatus === 'approved' 
            ? 'doctorVerificationApproved' 
            : 'doctorVerificationRejected';
          
          await sendEmail({
            to: doctor.email,
            subject: verificationStatus === 'approved' 
              ? 'Your Professional Account has been Approved - Neurolex' 
              : 'Important Information About Your Professional Account - Neurolex',
            template: emailTemplate,
            context: {
              doctorName: doctor.firstName,
              rejectionReason: verificationStatus === 'rejected' ? rejectionReason : null,
              loginLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`
            }
          });
        } catch (emailError) {
          console.error('Error sending verification email:', emailError);
        }
        
        return res.status(200).json({
          success: true,
          message: `Doctor successfully ${verificationStatus}`,
          data: {
            doctorId: updatedDoctor._id,
            verificationStatus: updatedDoctor.verificationStatus,
            verificationDate: updatedDoctor.verificationDate
          }
        });
      } catch (error) {
        console.error('Error in single tenant doctor verification:', error);
        return res.status(500).json({
          success: false,
          message: 'Doctor verification failed',
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
    }
  } catch (error) {
    console.error('Verify doctor error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Doctor verification failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get doctor verification statistics across all tenants
exports.getDoctorVerificationStats = async (req, res) => {
  try {
    console.log('Getting doctor verification stats across all tenants');
    
    // First check if multi-tenant is enabled
    if (process.env.ENABLE_MULTI_TENANT !== 'true') {
      // Fallback to single tenant mode
      return getSingleTenantVerificationStats(req, res);
    }
    
    // Get master connection to access tenant information
    const masterConn = getMasterConnection();
    if (!masterConn) {
      console.error('Failed to connect to master database');
      return res.status(500).json({
        success: false,
        message: 'Database connection error'
      });
    }
    
    // Get Tenant model from master connection
    const Tenant = masterConn.model('Tenant');
    
    // Get all active tenants
    const tenants = await Tenant.find({ active: true });
    
    // Initialize counters
    let totalDoctors = 0;
    let pendingDoctors = 0;
    let approvedDoctors = 0;
    let rejectedDoctors = 0;
    let recentVerifications = [];
    
    // Loop through each tenant and collect statistics
    for (const tenant of tenants) {
      try {
        // Connect to tenant database
        const tenantConn = await dbManager.connectTenant(tenant._id.toString());
        if (!tenantConn) {
          console.warn(`Could not connect to tenant database: ${tenant.name}`);
          continue; // Skip this tenant and proceed to the next
        }
        
        // Get User model from tenant connection
        const User = tenantConn.model('User');
        
        // Get counts for this tenant
        const tenantTotalDoctors = await User.countDocuments({ role: 'doctor' });
        const tenantPendingDoctors = await User.countDocuments({ 
          role: 'doctor', 
          verificationStatus: 'pending' 
        });
        const tenantApprovedDoctors = await User.countDocuments({ 
          role: 'doctor', 
          verificationStatus: 'approved', 
          isVerified: true 
        });
        const tenantRejectedDoctors = await User.countDocuments({ 
          role: 'doctor', 
          verificationStatus: 'rejected' 
        });
        
        // Add to global counters
        totalDoctors += tenantTotalDoctors;
        pendingDoctors += tenantPendingDoctors;
        approvedDoctors += tenantApprovedDoctors;
        rejectedDoctors += tenantRejectedDoctors;
        
        // Get recent verifications for this tenant
        const tenantRecentVerifications = await User.find({ 
          role: 'doctor',
          verificationStatus: { $in: ['approved', 'rejected'] },
          verificationDate: { $exists: true }
        })
          .select('firstName lastName verificationStatus verificationDate verifiedBy')
          .sort({ verificationDate: -1 })
          .limit(5);
        
        // Add tenant information to each verification
        const verificationsWithTenantInfo = tenantRecentVerifications.map(doc => {
          const docObj = doc.toObject();
          docObj.tenantId = tenant._id;
          docObj.tenantName = tenant.name;
          return docObj;
        });
        
        // Add to all recent verifications
        recentVerifications = [...recentVerifications, ...verificationsWithTenantInfo];
      } catch (error) {
        console.error(`Error fetching stats from tenant ${tenant.name}:`, error);
        // Continue with other tenants even if one fails
      }
    }
    
    // Sort recent verifications by date (most recent first)
    recentVerifications.sort((a, b) => 
      new Date(b.verificationDate) - new Date(a.verificationDate)
    );
    
    // Limit to 5 most recent
    recentVerifications = recentVerifications.slice(0, 5);
    
    res.status(200).json({
      success: true,
      data: {
        counts: {
          totalDoctors,
          pendingDoctors,
          approvedDoctors,
          rejectedDoctors
        },
        recentVerifications
      }
    });
  } catch (error) {
    console.error('Get doctor verification stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch doctor verification stats',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ===== SINGLE TENANT FALLBACK FUNCTIONS =====

// Get all pending doctor verifications (single tenant)
const getSingleTenantPendingDoctors = async (req, res) => {
  try {
    console.log('Using single tenant mode for pending doctors');
    
    const pendingDoctors = await User.find({ 
      role: 'doctor', 
      isVerified: false,
      verificationStatus: 'pending' 
    })
      .select('firstName lastName email specialization createdAt')
      .sort({ createdAt: 1 }); // Oldest first
    
    res.status(200).json({
      success: true,
      count: pendingDoctors.length,
      data: pendingDoctors
    });
  } catch (error) {
    console.error('Get pending doctors error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending doctor verifications',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all verified doctors (single tenant)
const getSingleTenantVerifiedDoctors = async (req, res) => {
  try {
    console.log('Using single tenant mode for verified doctors');
    
    const verifiedDoctors = await User.find({ 
      role: 'doctor', 
      isVerified: true,
      verificationStatus: 'approved' 
    })
      .select('firstName lastName email specialization verificationDate')
      .sort({ verificationDate: -1 }); // Most recently verified first
    
    res.status(200).json({
      success: true,
      count: verifiedDoctors.length,
      data: verifiedDoctors
    });
  } catch (error) {
    console.error('Get verified doctors error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch verified doctors',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all rejected doctors (single tenant)
const getSingleTenantRejectedDoctors = async (req, res) => {
  try {
    console.log('Using single tenant mode for rejected doctors');
    
    const rejectedDoctors = await User.find({ 
      role: 'doctor', 
      isVerified: false,
      verificationStatus: 'rejected' 
    })
      .select('firstName lastName email specialization verificationDate rejectionReason')
      .sort({ verificationDate: -1 }); // Most recently rejected first
    
    res.status(200).json({
      success: true,
      count: rejectedDoctors.length,
      data: rejectedDoctors
    });
  } catch (error) {
    console.error('Get rejected doctors error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rejected doctors',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get doctor details (single tenant)
const getSingleTenantDoctorDetails = async (req, res) => {
  try {
    console.log('Using single tenant mode for doctor details');
    
    const doctor = await User.findOne({
      _id: req.params.id,
      role: 'doctor'
    });
    
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: doctor
    });
  } catch (error) {
    console.error('Get doctor details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch doctor details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get doctor verification statistics (single tenant)
const getSingleTenantVerificationStats = async (req, res) => {
  try {
    console.log('Using single tenant mode for verification stats');
    
    // Get counts
    const totalDoctors = await User.countDocuments({ role: 'doctor' });
    const pendingDoctors = await User.countDocuments({ 
      role: 'doctor', 
      verificationStatus: 'pending' 
    });
    const approvedDoctors = await User.countDocuments({ 
      role: 'doctor', 
      verificationStatus: 'approved', 
      isVerified: true 
    });
    const rejectedDoctors = await User.countDocuments({ 
      role: 'doctor', 
      verificationStatus: 'rejected' 
    });
    
    // Get recent verifications
    const recentVerifications = await User.find({ 
      role: 'doctor',
      verificationStatus: { $in: ['approved', 'rejected'] },
      verificationDate: { $exists: true }
    })
      .select('firstName lastName verificationStatus verificationDate verifiedBy')
      .sort({ verificationDate: -1 })
      .limit(5)
      .populate('verifiedBy', 'firstName lastName');
    
    res.status(200).json({
      success: true,
      data: {
        counts: {
          totalDoctors,
          pendingDoctors,
          approvedDoctors,
          rejectedDoctors
        },
        recentVerifications
      }
    });
  } catch (error) {
    console.error('Get doctor verification stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch doctor verification stats',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ===== ORIGINAL ADMIN CONTROLLER FUNCTIONS =====


// User management
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ role: 'user' })
      .select('name email createdAt lastActive status')
      .sort({ createdAt: -1 });
      
    return res.json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    
    const user = await User.findByIdAndUpdate(id, { 
      status,
      statusReason: reason,
      statusUpdatedAt: Date.now(),
      statusUpdatedBy: req.user._id
    }, { new: true });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    return res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the user
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Delete all related data
    await JournalEntry.deleteMany({ userId: id });
    await Mood.deleteMany({ userId: id });
    await Notification.deleteMany({ userId: id });
    await PatientDoctorAssociation.deleteMany({ patientId: id });
    
    // Finally delete the user
    await User.findByIdAndDelete(id);
    
    return res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Professional verification (original method, can use with new methods)
exports.getAllProfessionals = async (req, res) => {
  try {
    const professionals = await User.find({ role: 'doctor' })
      .select('name email specialty isVerified createdAt')
      .sort({ createdAt: -1 });
      
    return res.json({
      success: true,
      professionals
    });
  } catch (error) {
    console.error('Error fetching professionals:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.verifyProfessional = async (req, res) => {
  try {
    const { id } = req.params;
    const { isVerified, notes } = req.body;
    
    const professional = await User.findByIdAndUpdate(id, { 
      isVerified,
      verificationNotes: notes,
      verifiedAt: isVerified ? Date.now() : null,
      verifiedBy: isVerified ? req.user._id : null
    }, { new: true });
    
    if (!professional) {
      return res.status(404).json({
        success: false,
        message: 'Professional not found'
      });
    }
    
    return res.json({
      success: true,
      professional
    });
  } catch (error) {
    console.error('Error verifying professional:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Content moderation
exports.getFlaggedContent = async (req, res) => {
  try {
    // Placeholder - implement based on your data model
    return res.json({
      success: true,
      flaggedContent: []
    });
  } catch (error) {
    console.error('Error fetching flagged content:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.updateContentStatus = async (req, res) => {
  try {
    // Placeholder - implement based on your data model
    return res.json({
      success: true,
      message: 'Content status updated'
    });
  } catch (error) {
    console.error('Error updating content status:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Report generation
exports.getSystemReport = async (req, res) => {
  try {
    // Placeholder - implement based on your requirements
    return res.json({
      success: true,
      report: {
        timestamp: new Date(),
        metrics: {
          totalUsers: await User.countDocuments({ role: 'user' }),
          totalDoctors: await User.countDocuments({ role: 'doctor' }),
          totalJournalEntries: await JournalEntry.countDocuments(),
          totalMoodEntries: await Mood.countDocuments()
        }
      }
    });
  } catch (error) {
    console.error('Error generating system report:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.getUsersReport = async (req, res) => {
  try {
    // Placeholder - implement based on your requirements
    return res.json({
      success: true,
      report: {
        timestamp: new Date(),
        userData: {
          newUsersThisWeek: 0,
          activeUsersThisWeek: 0,
          inactiveUsers: 0
        }
      }
    });
  } catch (error) {
    console.error('Error generating users report:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// System settings
exports.getSystemSettings = async (req, res) => {
  try {
    // Placeholder - implement based on your data model
    return res.json({
      success: true,
      settings: {
        maintenance: false,
        registrationEnabled: true,
        maxFileUploadSize: 5, // MB
        allowedFileTypes: ['image/jpeg', 'image/png', 'application/pdf']
      }
    });
  } catch (error) {
    console.error('Error fetching system settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.updateSystemSettings = async (req, res) => {
  try {
    // Placeholder - implement based on your data model
    return res.json({
      success: true,
      message: 'System settings updated',
      settings: req.body
    });
  } catch (error) {
    console.error('Error updating system settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Template management
exports.getAllTemplates = async (req, res) => {
  try {
    const templates = await FormTemplate.find()
      .sort({ createdAt: -1 });
      
    return res.json({
      success: true,
      templates
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await FormTemplate.findByIdAndUpdate(id, req.body, { new: true });
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }
    
    return res.json({
      success: true,
      template
    });
  } catch (error) {
    console.error('Error updating template:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await FormTemplate.findByIdAndDelete(id);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }
    
    return res.json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting template:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Feedback tracking
exports.getAllFeedback = async (req, res) => {
  try {
    // Placeholder - implement based on your data model
    return res.json({
      success: true,
      feedback: []
    });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.updateFeedbackStatus = async (req, res) => {
  try {
    // Placeholder - implement based on your data model
    return res.json({
      success: true,
      message: 'Feedback status updated'
    });
  } catch (error) {
    console.error('Error updating feedback status:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Data export
exports.generateBackup = async (req, res) => {
  try {
    // Placeholder - implement based on your requirements
    return res.json({
      success: true,
      message: 'Backup generated',
      backupUrl: '/api/admin/download/backup'
    });
  } catch (error) {
    console.error('Error generating backup:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get dashboard data with proper counts
// Get dashboard data with proper counts - FIXED VERSION
exports.getDashboardData = async (req, res) => {
  try {
    console.log('Getting admin dashboard data...');
    
    // If multi-tenant is enabled, get data from all tenants
    if (process.env.ENABLE_MULTI_TENANT === 'true') {
      // Get master connection
      const masterConn = getMasterConnection();
      if (!masterConn) {
        throw new Error('Failed to connect to master database');
      }
      
      const Tenant = masterConn.model('Tenant');
      const tenants = await Tenant.find({ active: true });
      
      let totalUsers = 0;
      let totalProfessionals = 0;
      let pendingVerifications = 0;
      let totalJournalEntries = 0;
      
      // Loop through each tenant and collect stats
      for (const tenant of tenants) {
        try {
          const tenantConn = await dbManager.connectTenant(tenant._id.toString());
          if (!tenantConn) continue;
          
          const User = tenantConn.model('User');
          const JournalEntry = tenantConn.model('JournalEntry');
          
          // Count users (patients)
          const userCount = await User.countDocuments({ role: 'patient' });
          totalUsers += userCount;
          
          // Count professionals (doctors)
          const professionalCount = await User.countDocuments({ role: 'doctor' });
          totalProfessionals += professionalCount;
          
          // Count pending verifications
          const pendingCount = await User.countDocuments({ 
            role: 'doctor', 
            verificationStatus: 'pending' 
          });
          pendingVerifications += pendingCount;
          
          // Count journal entries
          const journalCount = await JournalEntry.countDocuments();
          totalJournalEntries += journalCount;
          
        } catch (error) {
          console.error(`Error fetching stats from tenant ${tenant.name}:`, error);
        }
      }
      
      return res.json({
        success: true,
        totalUsers,
        totalProfessionals,
        pendingVerifications,
        totalJournalEntries,
        recentUsers: [] // Can implement this later if needed
      });
    } else {
      // Single tenant mode
      const totalUsers = await User.countDocuments({ role: 'patient' });
      const totalProfessionals = await User.countDocuments({ role: 'doctor' });
      const pendingVerifications = await User.countDocuments({ 
        role: 'doctor', 
        verificationStatus: 'pending' 
      });
      const totalJournalEntries = await JournalEntry.countDocuments();
      const recentUsers = await User.find({ role: 'patient' })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('firstName lastName email createdAt');
      
      return res.json({
        success: true,
        totalUsers,
        totalProfessionals,
        pendingVerifications,
        totalJournalEntries,
        recentUsers
      });
    }
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ===== TENANT SETTINGS FUNCTIONS =====

// Get tenant settings
// ✅ REPLACE your existing getTenantSettings method with this:

exports.getTenantSettings = async (req, res) => {
  try {
    const { tenantId } = req.params;
    console.log(`🔍 [ADMIN] Getting tenant settings for: ${tenantId}`);
    
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
    const tenant = await Tenant.findById(tenantId);
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }
    
    // Return tenant settings with proper structure for both light and dark logos
    const settings = {
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
      hirsSettings: tenant.hirsSettings || [
        {
          id: 1,
          icon: 'HR',
          name: 'User Dashboard',
          description: 'Controls the displays, names, and icons used by End Users on the Dashboard.',
          lastUpdated: new Date().toLocaleDateString(),
          isActive: true
        },
        {
          id: 2,
          icon: 'JE', 
          name: 'Journal Entries',
          description: 'Control what journal prompts are available for users.',
          lastUpdated: new Date().toLocaleDateString(),
          isActive: true
        },
        {
          id: 3,
          icon: 'DR',
          name: 'Mood Tracking-Dr',
          description: 'Set up mood tracking functionality for doctors and patients.',
          lastUpdated: new Date().toLocaleDateString(),
          isActive: true
        },
        {
          id: 4,
          icon: 'MA',
          name: 'Dr Mental Assessments', 
          description: 'Mental health assessment tools for healthcare professionals.',
          lastUpdated: new Date().toLocaleDateString(),
          isActive: true
        },
        {
          id: 5,
          icon: 'SM',
          name: 'Stress Managing',
          description: 'Stress management tools and resources.',
          lastUpdated: new Date().toLocaleDateString(),
          isActive: true
        },
        {
          id: 6,
          icon: 'PS',
          name: 'User Profiles',
          description: 'User profile management and customization.',
          lastUpdated: new Date().toLocaleDateString(),
          isActive: true
        },
        {
          id: 7,
          icon: 'NT',
          name: 'Notifications',
          description: 'Push notifications and alert system.',
          lastUpdated: new Date().toLocaleDateString(),
          isActive: true
        },
        {
          id: 8,
          icon: 'DA',
          name: 'Data Analytics',
          description: 'Analytics dashboard and reporting tools.',
          lastUpdated: new Date().toLocaleDateString(),
          isActive: true
        },
        {
          id: 9,
          icon: 'CA',
          name: 'Care / Report',
          description: 'Care management and reporting functionality.',
          lastUpdated: new Date().toLocaleDateString(),
          isActive: true
        },
        {
          id: 10,
          icon: 'CF',
          name: 'Config',
          description: 'System configuration and settings.',
          lastUpdated: new Date().toLocaleDateString(),
          isActive: true
        }
      ]
    };
    
    console.log('✅ Tenant settings retrieved successfully');
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('❌ Error getting tenant settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get tenant settings',
      error: error.message
    });
  }
};

// Update tenant settings
exports.updateTenantSettings = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const settings = req.body;
    console.log(`💾 [ADMIN] Updating tenant settings for: ${tenantId}`);
    console.log('Settings data:', settings);
    
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
    
    // Check if tenant exists first
    const existingTenant = await Tenant.findById(tenantId);
    if (!existingTenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }
    
    // Prepare update object (only update fields that are provided)
    const updateData = {
      updatedAt: new Date()
    };
    
    if (settings.platformName) {
      updateData.name = settings.platformName;
    }
    
    if (settings.platformDescription) {  
      updateData.description = settings.platformDescription;
    }
    
    if (settings.primaryColor) {
      updateData.primaryColor = settings.primaryColor;
    }
    
    if (settings.secondaryColor) {
      updateData.secondaryColor = settings.secondaryColor;
    }
    
    if (settings.hirsSettings) {
      updateData.hirsSettings = settings.hirsSettings;
    }
    
    // Handle logo updates
    if (settings.systemLogo) {
      if (settings.systemLogo.light) {
        updateData.logoUrl = settings.systemLogo.light;
      }
      if (settings.systemLogo.dark) {
        updateData.darkLogoUrl = settings.systemLogo.dark;
      }
    }
    
    // Handle favicon updates
    if (settings.favicon) {
      if (settings.favicon.light) {
        updateData.faviconUrl = settings.favicon.light;
      }
      if (settings.favicon.dark) {
        updateData.darkFaviconUrl = settings.favicon.dark;
      }
    }
    
    // Update tenant with new settings
    const updatedTenant = await Tenant.findByIdAndUpdate(
      tenantId,
      { $set: updateData },
      { new: true, runValidators: false }
    );
    
    if (!updatedTenant) {
      return res.status(404).json({
        success: false,
        message: 'Failed to update tenant'
      });
    }
    
    console.log('✅ Tenant settings updated successfully');
    res.json({
      success: true,
      message: 'Tenant settings updated successfully',
      data: updatedTenant
    });
  } catch (error) {
    console.error('❌ Error updating tenant settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update tenant settings',
      error: error.message
    });
  }
};


exports.updateIndividualTenantSetting = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const updateData = req.body;
    console.log(`🔧 [ADMIN] Updating individual setting for tenant: ${tenantId}`);
    console.log('Update data:', updateData);
    
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
    
    // Prepare tenant update fields
    const tenantUpdateData = {
      updatedAt: new Date()
    };
    
    // Map frontend field names to tenant model fields
    if (updateData.platformName) {
      tenantUpdateData.name = updateData.platformName;
    }
    
    if (updateData.platformDescription) {
      tenantUpdateData.description = updateData.platformDescription;
    }
    
    if (updateData.primaryColor) {
      tenantUpdateData.primaryColor = updateData.primaryColor;
    }
    
    if (updateData.secondaryColor) {
      tenantUpdateData.secondaryColor = updateData.secondaryColor;
    }
    
    if (updateData.hirsSettings) {
      tenantUpdateData.hirsSettings = updateData.hirsSettings;
    }
    
    // Update the tenant
    const updatedTenant = await Tenant.findByIdAndUpdate(
      tenantId,
      { $set: tenantUpdateData },
      { new: true, runValidators: false }
    );
    
    if (!updatedTenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }
    
    console.log('✅ Individual tenant setting updated successfully');
    res.json({
      success: true,
      message: 'Setting updated successfully',
      data: updatedTenant
    });
  } catch (error) {
    console.error('❌ Error updating individual tenant setting:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update setting',
      error: error.message
    });
  }
};


exports.updateIndividualTenantSetting = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const updateData = req.body;
    console.log(`🔧 [ADMIN] Updating individual setting for tenant: ${tenantId}`);
    console.log('Update data:', updateData);
    
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
    
    // Prepare tenant update fields
    const tenantUpdateData = {
      updatedAt: new Date()
    };
    
    // Map frontend field names to tenant model fields
    if (updateData.platformName) {
      tenantUpdateData.name = updateData.platformName;
    }
    
    if (updateData.platformDescription) {
      tenantUpdateData.description = updateData.platformDescription;
    }
    
    if (updateData.primaryColor) {
      tenantUpdateData.primaryColor = updateData.primaryColor;
    }
    
    if (updateData.secondaryColor) {
      tenantUpdateData.secondaryColor = updateData.secondaryColor;
    }
    
    if (updateData.hirsSettings) {
      tenantUpdateData.hirsSettings = updateData.hirsSettings;
    }
    
    // Update the tenant
    const updatedTenant = await Tenant.findByIdAndUpdate(
      tenantId,
      { $set: tenantUpdateData },
      { new: true, runValidators: false }
    );
    
    if (!updatedTenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }
    
    console.log('✅ Individual tenant setting updated successfully');
    res.json({
      success: true,
      message: 'Setting updated successfully',
      data: updatedTenant
    });
  } catch (error) {
    console.error('❌ Error updating individual tenant setting:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update setting',
      error: error.message
    });
  }
};

// ✅ ADD: Cloudinary upload method
exports.uploadTenantLogo = async (req, res) => {
  try {
    console.log('📤 [ADMIN] Safe upload test');
    
    // Just return success for now to test
    res.json({
      success: true,
      message: 'Upload test - app not crashing',
      url: 'https://via.placeholder.com/400x400.png?text=Test+Logo'
    });
    
  } catch (error) {
    console.error('❌ Safe upload error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Safe error handling',
      error: error.message
    });
  }
};

exports.uploadTenantAsset = async (req, res) => {
      try {
        console.log('📤 [ADMIN] Upload tenant asset (backward compatibility)');
        // Redirect to the new uploadTenantLogo method
        return exports.uploadTenantLogo(req, res);
      } catch (error) {
        console.error('❌ Error in upload tenant asset:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to upload asset',
          error: error.message
        });
      }
    };
