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
const cloudinary = require('cloudinary').v2;


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

exports.getPatientById = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { tenantId } = req.query;

    console.log(`🔍 Admin fetching patient: ${patientId}, Tenant: ${tenantId || 'not specified'}`);

    // Validate patient ID
    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID is required'
      });
    }

    let patient = null;

    if (tenantId) {
      // Search in specific tenant
      try {
        const specificTenantDb = await dbManager.connectTenant(tenantId);
        
        if (!specificTenantDb) {
          console.error(`Failed to connect to tenant database: ${tenantId}`);
          return res.status(500).json({
            success: false,
            message: 'Database connection error for specified tenant'
          });
        }
        
        const User = specificTenantDb.model('User');
        
        patient = await User.findOne({
          _id: patientId,
          role: 'patient' // Ensure we only get patients
        })
        .select('-password -resetToken -resetTokenExpires')
        .lean();
          
        if (patient) {
          patient.tenantId = tenantId;
          console.log(`✅ Found patient in tenant ${tenantId}`);
        }
      } catch (tenantError) {
        console.error(`❌ Error searching in tenant ${tenantId}:`, tenantError.message);
        return res.status(500).json({
          success: false,
          message: 'Error searching in specified tenant'
        });
      }
    } else {
      // Search across all tenants
      console.log('🔍 Searching across all tenants...');
      
      try {
        // Get master connection to access tenants
        const masterConn = getMasterConnection();
        if (!masterConn) {
          throw new Error('Failed to connect to master database');
        }
        
        const Tenant = masterConn.model('Tenant');
        const tenants = await Tenant.find({ active: true });
        
        for (const tenant of tenants) {
          try {
            const tenantDb = await dbManager.connectTenant(tenant._id.toString());
            
            if (!tenantDb) {
              console.warn(`Could not connect to tenant database: ${tenant.name}`);
              continue;
            }
            
            const User = tenantDb.model('User');
            
            const foundPatient = await User.findOne({
              _id: patientId,
              role: 'patient' // Ensure we only get patients
            })
            .select('-password -resetToken -resetTokenExpires')
            .lean();
              
            if (foundPatient) {
              patient = foundPatient;
              patient.tenantId = tenant._id.toString();
              console.log(`✅ Found patient in tenant: ${tenant.name}`);
              break;
            }
          } catch (tenantError) {
            console.error(`❌ Error searching tenant ${tenant.name}:`, tenantError.message);
            continue;
          }
        }
      } catch (globalSearchError) {
        console.error('❌ Error in global patient search:', globalSearchError);
        return res.status(500).json({
          success: false,
          message: 'Error searching for patient across tenants'
        });
      }
    }

    if (!patient) {
      console.log(`❌ Patient ${patientId} not found`);
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    console.log(`✅ Patient found: ${patient.firstName} ${patient.lastName}`);

    res.json({
      success: true,
      data: patient,
      message: 'Patient details retrieved successfully'
    });

  } catch (error) {
    console.error('❌ Error in getPatientById:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching patient details',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Add this method right after the getPatientById method in your adminController.js
// Place it before the "MULTI-TENANT DOCTOR VERIFICATION FUNCTIONS" section

// Update patient by ID for admin
exports.updatePatient = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { tenantId } = req.query;
    const updateData = req.body;

    console.log(`🔄 Admin updating patient: ${patientId}, Tenant: ${tenantId || 'not specified'}`);
    console.log('Update data:', updateData);

    // Validate patient ID
    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID is required'
      });
    }

    // Remove sensitive fields from update data
    const allowedFields = [
      'firstName', 'lastName', 'middleName', 'nickname', 'email',
      'birthdate', 'age', 'gender', 'pronouns', 'location',
      'diagnosis', 'treatmentHistory', 'symptomsFrequency',
      'hasMentalHealthDoctor', 'primaryDoctor', 'doctorContact',
      'therapistName', 'therapistContact', 'psychiatristName', 'psychiatristContact',
      'clinicLocation', 'doctorContactNumber', 'doctorEmail', 'needDoctorHelp',
      'preferredHospital', 'insuranceProvider', 'insuranceNumber',
      'occupation', 'workStatus', 'livingArrangement', 'exerciseFrequency',
      'dietaryPatterns', 'sleepPatterns', 'substanceUse', 'religiousBeliefs', 'hobbies',
      'emergencyName', 'emergencyRelationship', 'emergencyPhone', 'emergencyEmail',
      'emergencyAddress', 'emergencyAware', 'accountStatus'
    ];

    // Filter update data to only include allowed fields
    const filteredUpdateData = {};
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredUpdateData[key] = updateData[key];
      }
    });

    // Add update timestamp
    filteredUpdateData.updatedAt = new Date();

    let patient = null;

    if (tenantId) {
      // Update in specific tenant
      try {
        const specificTenantDb = await dbManager.connectTenant(tenantId);
        
        if (!specificTenantDb) {
          console.error(`Failed to connect to tenant database: ${tenantId}`);
          return res.status(500).json({
            success: false,
            message: 'Database connection error for specified tenant'
          });
        }
        
        const User = specificTenantDb.model('User');
        
        // Find and update patient
        patient = await User.findOneAndUpdate(
          {
            _id: patientId,
            role: 'patient' // Ensure we only update patients
          },
          { $set: filteredUpdateData },
          { 
            new: true, // Return updated document
            runValidators: false // Skip validation for flexibility
          }
        )
        .select('-password -resetToken -resetTokenExpires')
        .lean();
          
        if (patient) {
          patient.tenantId = tenantId;
          console.log(`✅ Updated patient in tenant ${tenantId}`);
        }
      } catch (tenantError) {
        console.error(`❌ Error updating in tenant ${tenantId}:`, tenantError.message);
        return res.status(500).json({
          success: false,
          message: 'Error updating patient in specified tenant'
        });
      }
    } else {
      // Search and update across all tenants
      console.log('🔍 Searching across all tenants...');
      
      try {
        // Get master connection to access tenants
        const masterConn = getMasterConnection();
        if (!masterConn) {
          throw new Error('Failed to connect to master database');
        }
        
        const Tenant = masterConn.model('Tenant');
        const tenants = await Tenant.find({ active: true });
        
        for (const tenant of tenants) {
          try {
            const tenantDb = await dbManager.connectTenant(tenant._id.toString());
            
            if (!tenantDb) {
              console.warn(`Could not connect to tenant database: ${tenant.name}`);
              continue;
            }
            
            const User = tenantDb.model('User');
            
            // Try to find and update patient in this tenant
            const updatedPatient = await User.findOneAndUpdate(
              {
                _id: patientId,
                role: 'patient' // Ensure we only update patients
              },
              { $set: filteredUpdateData },
              { 
                new: true, // Return updated document
                runValidators: false // Skip validation for flexibility
              }
            )
            .select('-password -resetToken -resetTokenExpires')
            .lean();
              
            if (updatedPatient) {
              patient = updatedPatient;
              patient.tenantId = tenant._id.toString();
              console.log(`✅ Updated patient in tenant: ${tenant.name}`);
              break;
            }
          } catch (tenantError) {
            console.error(`❌ Error updating in tenant ${tenant.name}:`, tenantError.message);
            continue;
          }
        }
      } catch (globalSearchError) {
        console.error('❌ Error in global patient update:', globalSearchError);
        return res.status(500).json({
          success: false,
          message: 'Error updating patient across tenants'
        });
      }
    }

    if (!patient) {
      console.log(`❌ Patient ${patientId} not found or could not be updated`);
      return res.status(404).json({
        success: false,
        message: 'Patient not found or could not be updated'
      });
    }

    console.log(`✅ Patient updated successfully: ${patient.firstName} ${patient.lastName}`);

    res.json({
      success: true,
      data: patient,
      message: 'Patient updated successfully'
    });

  } catch (error) {
    console.error('❌ Error in updatePatient:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating patient',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
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
    console.log(`🔍 [ADMIN] Getting tenant settings for: ${tenantId} (from Tenant model)`);
    
    // Validate tenantId format
    if (!tenantId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tenant ID format'
      });
    }
    
    // 🚨 FIXED: Get settings directly from Tenant model
    const masterConn = getMasterConnection();
    if (!masterConn) {
      throw new Error('Failed to connect to master database');
    }
    
    const Tenant = masterConn.model('Tenant');
    
    // Find tenant with all settings
    const tenant = await Tenant.findById(tenantId);
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }
    
    // 🔧 DEFENSIVE: Initialize hirsSettings if missing
    if (!tenant.hirsSettings || tenant.hirsSettings.length === 0) {
      console.log(`⚠️ [ADMIN] No HIRS settings found, initializing defaults for tenant: ${tenantId}`);
      
      tenant.hirsSettings = [
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
      
      // Save the initialized settings
      await tenant.save();
    }
    
    // Return tenant settings with proper structure
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
      hirsSettings: tenant.hirsSettings || []
    };
    
    console.log(`✅ [ADMIN] Tenant settings retrieved from Tenant model - ${settings.hirsSettings.length} HIRS features`);
    
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('❌ [ADMIN] Error getting tenant settings:', error);
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


exports.uploadTenantLogo = async (req, res) => {
  try {
    console.log('📤 [ADMIN] Enhanced upload - Logo AND Favicon support');
    
    // Ensure JSON response
    res.setHeader('Content-Type', 'application/json');
    
    // Basic validations
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please select an image file.'
      });
    }
    
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only image files are allowed.'
      });
    }
    
    // Get parameters from request
    const logoType = req.body.logoType || 'light'; // light or dark
    const imageType = req.body.imageType || 'logo'; // logo or favicon
    const tenantId = req.body.tenantId || req.query.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required'
      });
    }
    
    // Validate imageType
    if (!['logo', 'favicon'].includes(imageType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid image type. Must be "logo" or "favicon".'
      });
    }
    
    // Validate logoType
    if (!['light', 'dark'].includes(logoType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid logo type. Must be "light" or "dark".'
      });
    }
    
    // Different size limits for logos vs favicons
    const maxSize = imageType === 'favicon' ? 2 * 1024 * 1024 : 10 * 1024 * 1024; // 2MB for favicon, 10MB for logo
    
    if (req.file.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: `File too large. Maximum size for ${imageType} is ${maxSize / (1024 * 1024)}MB.`
      });
    }
    
    console.log('📋 Upload parameters:', { 
      logoType, 
      imageType,
      tenantId, 
      fileName: req.file.originalname,
      fileSize: req.file.size 
    });
    
    // ✅ CHECK CLOUDINARY CREDENTIALS
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      console.error('❌ Missing Cloudinary credentials');
      return res.status(500).json({
        success: false,
        message: 'Cloudinary not configured. Please set environment variables.',
        missingVars: {
          CLOUDINARY_CLOUD_NAME: !process.env.CLOUDINARY_CLOUD_NAME,
          CLOUDINARY_API_KEY: !process.env.CLOUDINARY_API_KEY,
          CLOUDINARY_API_SECRET: !process.env.CLOUDINARY_API_SECRET
        }
      });
    }
    
    // ✅ CONFIGURE CLOUDINARY
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true
    });
    
    console.log('☁️ Cloudinary configured:', {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key_length: process.env.CLOUDINARY_API_KEY?.length || 0,
      api_secret_length: process.env.CLOUDINARY_API_SECRET?.length || 0
    });
    
    // ✅ TEST CLOUDINARY CONNECTION
    try {
      await cloudinary.api.ping();
      console.log('✅ Cloudinary connection successful');
    } catch (pingError) {
      console.error('❌ Cloudinary connection failed:', pingError.message);
      return res.status(500).json({
        success: false,
        message: 'Cloudinary connection failed. Check your credentials.',
        error: pingError.message
      });
    }
    
    // ✅ UPLOAD TO CLOUDINARY
    console.log(`🚀 Starting Cloudinary upload for ${imageType}...`);
    
    const uploadResult = await new Promise((resolve, reject) => {
      // Different upload options for logos vs favicons
      const uploadOptions = {
        folder: `neurolex/tenants/${tenantId}/${imageType}s`, // logos or favicons
        public_id: `${logoType}_${imageType}_${Date.now()}`,
        resource_type: 'image',
        overwrite: true,
        invalidate: true,
        use_filename: false,
        unique_filename: true,
        transformation: imageType === 'favicon' ? [
          // Favicon transformations (smaller, square)
          { width: 512, height: 512, crop: 'fill' },
          { quality: 'auto:good' },
          { fetch_format: 'auto' }
        ] : [
          // Logo transformations (larger, maintain aspect ratio)
          { width: 800, height: 600, crop: 'limit' },
          { quality: 'auto:good' },
          { fetch_format: 'auto' }
        ]
      };
      
      console.log('📤 Upload options:', uploadOptions);
      
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error('❌ Cloudinary upload error:', error);
            reject(error);
          } else {
            console.log('✅ Cloudinary upload success:', {
              public_id: result.public_id,
              secure_url: result.secure_url,
              format: result.format,
              bytes: result.bytes
            });
            resolve(result);
          }
        }
      );
      
      uploadStream.end(req.file.buffer);
    });
    
    console.log(`🎉 ${imageType} upload completed successfully!`);
    
    // ✅ UPDATE TENANT DATABASE with new image URL
    try {
      const masterConn = getMasterConnection();
      if (masterConn) {
        const Tenant = masterConn.model('Tenant');
        
        // Determine which field to update based on imageType and logoType
        let updateField;
        if (imageType === 'logo') {
          updateField = logoType === 'light' ? 'logoUrl' : 'darkLogoUrl';
        } else if (imageType === 'favicon') {
          updateField = logoType === 'light' ? 'faviconUrl' : 'darkFaviconUrl';
        }
        
        if (updateField) {
          await Tenant.findByIdAndUpdate(
            tenantId,
            { 
              [updateField]: uploadResult.secure_url,
              updatedAt: new Date()
            },
            { new: true }
          );
          console.log(`✅ Tenant ${updateField} updated in database`);
        }
      }
    } catch (dbError) {
      console.warn('⚠️ Upload successful but database update failed:', dbError.message);
      // Don't fail the request since upload was successful
    }
    
    // ✅ RETURN SUCCESS RESPONSE
    return res.status(200).json({
      success: true,
      message: `${imageType.charAt(0).toUpperCase() + imageType.slice(1)} uploaded successfully to Cloudinary`,
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      uploadType: imageType,
      variant: logoType,
      cloudinaryInfo: {
        format: uploadResult.format,
        size: uploadResult.bytes,
        width: uploadResult.width,
        height: uploadResult.height,
        created_at: uploadResult.created_at,
        version: uploadResult.version
      },
      fileInfo: {
        originalName: req.file.originalname,
        originalSize: req.file.size,
        originalType: req.file.mimetype
      },
      tenantInfo: {
        tenantId: tenantId,
        fieldUpdated: imageType === 'logo' 
          ? (logoType === 'light' ? 'logoUrl' : 'darkLogoUrl')
          : (logoType === 'light' ? 'faviconUrl' : 'darkFaviconUrl')
      }
    });
    
  } catch (error) {
    console.error('❌ Upload failed:', error);
    
    res.setHeader('Content-Type', 'application/json');
    
    return res.status(500).json({
      success: false,
      message: 'Cloudinary upload failed',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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

    // ===== HIRS FEATURE MANAGEMENT FUNCTIONS =====

// 🆕 NEW: Toggle individual HIRS feature
exports.toggleHirsFeature = async (req, res) => {
  try {
    const { tenantId, hirsId } = req.params;
    const { isActive, lastUpdated } = req.body;
    
    console.log('🔍 [DEBUG] toggleHirsFeature called with:');
    console.log('  tenantId:', tenantId);
    console.log('  hirsId:', hirsId);
    console.log('  isActive:', isActive);
    console.log('  typeof isActive:', typeof isActive);
    
    // Validate tenantId format
    if (!tenantId || !tenantId.match(/^[0-9a-fA-F]{24}$/)) {
      console.error('❌ Invalid tenant ID format:', tenantId);
      return res.status(400).json({
        success: false,
        message: 'Invalid tenant ID format'
      });
    }
    
    // Validate hirsId
    const hirsIdNum = parseInt(hirsId);
    if (isNaN(hirsIdNum) || hirsIdNum < 1 || hirsIdNum > 6) {
      console.error('❌ Invalid HIRS ID:', hirsId);
      return res.status(400).json({
        success: false,
        message: 'Invalid HIRS ID. Must be between 1 and 6.'
      });
    }
    
    // Validate isActive
    if (typeof isActive !== 'boolean') {
      console.error('❌ Invalid isActive value:', isActive, typeof isActive);
      return res.status(400).json({
        success: false,
        message: 'isActive must be a boolean value'
      });
    }
    
    // Get master connection
    const masterConn = getMasterConnection();
    if (!masterConn) {
      console.error('❌ Failed to get master connection');
      return res.status(500).json({
        success: false,
        message: 'Database connection error'
      });
    }
    
    const Tenant = masterConn.model('Tenant');
    
    // Find tenant
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      console.error('❌ Tenant not found:', tenantId);
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }
    
    console.log(`🔍 Found tenant: ${tenant.name}`);
    console.log(`🔍 Current hirsSettings:`, tenant.hirsSettings);
    
    // Initialize HIRS settings if they don't exist
    if (!tenant.hirsSettings || !Array.isArray(tenant.hirsSettings) || tenant.hirsSettings.length === 0) {
      console.log('⚠️ No HIRS settings found, initializing defaults...');
      
      tenant.hirsSettings = [
        { id: 1, icon: '📊', name: 'Dashboard', description: 'Main dashboard overview for doctors.', lastUpdated: new Date().toLocaleDateString(), isActive: true },
        { id: 2, icon: '👥', name: 'Patients', description: 'Patient management and list view.', lastUpdated: new Date().toLocaleDateString(), isActive: true },
        { id: 3, icon: '📖', name: 'Patient Journal Management', description: 'View and manage patient journal entries.', lastUpdated: new Date().toLocaleDateString(), isActive: true },
        { id: 4, icon: '📝', name: 'Journal Template Management', description: 'Create and manage journal templates for patients.', lastUpdated: new Date().toLocaleDateString(), isActive: true },
        { id: 5, icon: '📅', name: 'Appointments', description: 'Schedule and manage appointments with patients.', lastUpdated: new Date().toLocaleDateString(), isActive: true },
        { id: 6, icon: '💬', name: 'Messages', description: 'Secure messaging with patients.', lastUpdated: new Date().toLocaleDateString(), isActive: true }
      ];
      
      await tenant.save();
      console.log('✅ Default HIRS settings initialized and saved');
    }
    
    // Find the specific HIRS setting
    const hirsIndex = tenant.hirsSettings.findIndex(hirs => {
      const hirsIdNumber = typeof hirs.id === 'number' ? hirs.id : parseInt(hirs.id);
      return hirsIdNumber === hirsIdNum;
    });
    
    if (hirsIndex === -1) {
      console.error('❌ HIRS setting not found:', hirsIdNum);
      console.log('Available settings:', tenant.hirsSettings.map(h => ({ id: h.id, name: h.name })));
      return res.status(404).json({
        success: false,
        message: `HIRS setting with ID ${hirsIdNum} not found`,
        availableSettings: tenant.hirsSettings.map(h => ({ id: h.id, name: h.name }))
      });
    }
    
    // Get feature info before update
    const featureName = tenant.hirsSettings[hirsIndex].name;
    const previousState = tenant.hirsSettings[hirsIndex].isActive;
    
    console.log(`🔄 Updating ${featureName}: ${previousState} → ${isActive}`);
    
    // 🚨 CRITICAL FIX: Update the array element directly and save
    tenant.hirsSettings[hirsIndex].isActive = isActive;
    tenant.hirsSettings[hirsIndex].lastUpdated = lastUpdated || new Date().toLocaleDateString();
    tenant.updatedAt = new Date();
    
    // Mark the hirsSettings array as modified (crucial for MongoDB)
    tenant.markModified('hirsSettings');
    
    // Save the tenant document
    const savedTenant = await tenant.save();
    
    if (!savedTenant) {
      console.error('❌ Failed to save tenant document');
      return res.status(500).json({
        success: false,
        message: 'Failed to update HIRS setting'
      });
    }
    
    console.log('✅ HIRS feature updated successfully');
    
    // Verify the update
    const updatedFeature = savedTenant.hirsSettings.find(h => {
      const hirsIdNumber = typeof h.id === 'number' ? h.id : parseInt(h.id);
      return hirsIdNumber === hirsIdNum;
    });
    
    console.log(`🔍 Verification - ${updatedFeature.name} isActive: ${updatedFeature.isActive}`);
    
    // Return success response
    res.json({
      success: true,
      message: `${featureName} has been ${isActive ? 'enabled' : 'disabled'} successfully!`,
      data: {
        tenantId,
        hirsId: hirsIdNum,
        isActive,
        featureName,
        lastUpdated: updatedFeature.lastUpdated,
        verified: updatedFeature.isActive === isActive,
        previousState
      }
    });
    
  } catch (error) {
    console.error('❌ [ADMIN] Error toggling HIRS feature:', error);
    console.error('❌ [ADMIN] Error stack:', error.stack);
    
    // Return detailed error for debugging
    res.status(500).json({
      success: false,
      message: 'Failed to toggle HIRS feature',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? {
        stack: error.stack,
        name: error.name
      } : undefined
    });
  }
};

// 🆕 NEW: Get HIRS feature statistics
exports.getHirsStats = async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    console.log(`📊 [ADMIN] Getting HIRS stats for tenant: ${tenantId}`);
    
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
    
    // Calculate statistics
    const totalFeatures = tenant.hirsSettings.length;
    const activeFeatures = tenant.hirsSettings.filter(hirs => hirs.isActive).length;
    const disabledFeatures = totalFeatures - activeFeatures;
    
    const stats = {
      total: totalFeatures,
      active: activeFeatures,
      disabled: disabledFeatures,
      activePercentage: totalFeatures > 0 ? Math.round((activeFeatures / totalFeatures) * 100) : 0,
      features: tenant.hirsSettings.map(hirs => ({
        id: hirs.id,
        name: hirs.name,
        isActive: hirs.isActive,
        lastUpdated: hirs.lastUpdated
      }))
    };
    
    console.log('✅ HIRS stats retrieved successfully');
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ Error getting HIRS stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get HIRS statistics',
      error: error.message
    });
  }
};

// 🆕 NEW: Bulk update HIRS features
exports.bulkUpdateHirs = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { updates } = req.body; // Array of { hirsId, isActive }
    
    console.log(`🔄 [ADMIN] Bulk updating HIRS features for tenant: ${tenantId}`);
    console.log('Updates:', updates);
    
    // Validate tenantId format
    if (!tenantId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tenant ID format'
      });
    }
    
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Updates array is required'
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
    
    // Apply updates
    const updatedFeatures = [];
    const currentDate = new Date().toLocaleDateString();
    
    for (const update of updates) {
      const hirsIndex = tenant.hirsSettings.findIndex(hirs => hirs.id === update.hirsId);
      
      if (hirsIndex !== -1) {
        tenant.hirsSettings[hirsIndex].isActive = update.isActive;
        tenant.hirsSettings[hirsIndex].lastUpdated = currentDate;
        
        updatedFeatures.push({
          id: update.hirsId,
          name: tenant.hirsSettings[hirsIndex].name,
          isActive: update.isActive
        });
      }
    }
    
    // Save tenant
    tenant.updatedAt = new Date();
    await tenant.save();
    
    console.log('✅ HIRS features bulk updated successfully');
    res.json({
      success: true,
      message: `${updatedFeatures.length} HIRS features updated successfully`,
      data: {
        tenantId,
        updatedFeatures,
        updatedAt: tenant.updatedAt
      }
    });
  } catch (error) {
    console.error('❌ Error bulk updating HIRS features:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk update HIRS features',
      error: error.message
    });
  }
};

// ===== TEMPLATE MANAGEMENT METHODS =====

// Get all templates (admin can see all templates across all tenants)
exports.getTemplates = async (req, res) => {
  try {
    console.log('Admin getting all templates');
    console.log('Admin context:', {
      adminId: req.user.id || req.user._id,
      role: req.user.role
    });
    
    // Admin can see templates from all tenants, so we don't filter by tenant
    // Use the global FormTemplate model
    const FormTemplate = require('../models/FormTemplate');
    
    // Get all templates with creator information
    const templates = await FormTemplate.find()
      .populate('createdBy', 'firstName lastName email role')
      .sort({ createdAt: -1 });
    
    console.log(`Found ${templates.length} templates across all tenants`);
    
    return res.status(200).json({
      success: true,
      templates,
      total: templates.length
    });
  } catch (error) {
    console.error('Error fetching templates (admin):', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching templates',
      error: error.message
    });
  }
};

// Get template statistics
exports.getTemplateStats = async (req, res) => {
  try {
    console.log('Admin getting template statistics');
    
    const FormTemplate = require('../models/FormTemplate');
    
    // Get template counts by status
    const totalTemplates = await FormTemplate.countDocuments();
    const activeTemplates = await FormTemplate.countDocuments({ isActive: true });
    const defaultTemplates = await FormTemplate.countDocuments({ isDefault: true });
    
    // Get templates by category
    const templatesByCategory = await FormTemplate.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Get most recent templates
    const recentTemplates = await FormTemplate.find()
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(5);
    
    return res.status(200).json({
      success: true,
      stats: {
        total: totalTemplates,
        active: activeTemplates,
        inactive: totalTemplates - activeTemplates,
        default: defaultTemplates,
        byCategory: templatesByCategory,
        recent: recentTemplates
      }
    });
  } catch (error) {
    console.error('Error fetching template stats (admin):', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching template statistics',
      error: error.message
    });
  }
};

// Get a specific template
exports.getTemplate = async (req, res) => {
  try {
    console.log('Admin getting template with ID:', req.params.id);
    
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Template ID is required'
      });
    }
    
    const FormTemplate = require('../models/FormTemplate');
    
    // Admin can access any template
    const template = await FormTemplate.findById(id)
      .populate('createdBy', 'firstName lastName email role');
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }
    
    console.log('Template found successfully:', {
      id: template._id,
      name: template.name,
      createdBy: template.createdBy?.email || 'Unknown'
    });
    
    return res.status(200).json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Error fetching template (admin):', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching template',
      error: error.message
    });
  }
};

// Create a new template (admin)
exports.createTemplate = async (req, res) => {
  try {
    console.log('Admin creating template with data:', req.body);
    
    // Get adminId from the authenticated user
    let adminId = req.user && (req.user._id || req.user.id);
    console.log('Admin ID from authentication:', adminId);
    
    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Admin ID could not be determined.'
      });
    }
    
    // Extract template data from request body
    const { name, description, fields, isDefault, category } = req.body;
    
    const FormTemplate = require('../models/FormTemplate');
    
    // Create the template with admin as creator
    const templateData = {
      name,
      description,
      fields: fields || [],
      createdBy: adminId,
      isDefault: isDefault || false,
      category: category || 'custom',
      isActive: true
    };
    
    console.log('Creating template with data:', templateData);
    
    const template = new FormTemplate(templateData);
    const savedTemplate = await template.save();
    
    console.log('Template created successfully:', {
      id: savedTemplate._id,
      name: savedTemplate.name,
      createdBy: savedTemplate.createdBy
    });
    
    // Populate the creator info before returning
    await savedTemplate.populate('createdBy', 'firstName lastName email role');
    
    return res.status(201).json({
      success: true,
      data: savedTemplate
    });
  } catch (error) {
    console.error('Error creating template (admin):', error);
    
    // Provide better error messages based on error type
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error: ' + error.message,
        details: Object.keys(error.errors).map(key => ({ 
          field: key, 
          message: error.errors[key].message 
        }))
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Error creating template',
      error: error.message
    });
  }
};

// Update a template (admin)
exports.updateTemplate = async (req, res) => {
  try {
    console.log('Admin updating template with ID:', req.params.id);
    console.log('Update data:', req.body);
    
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Template ID is required'
      });
    }
    
    // Extract updated template data from request body
    const { name, description, fields, isDefault, category, isActive } = req.body;
    
    const FormTemplate = require('../models/FormTemplate');
    
    // Find the template (admin can update any template)
    const template = await FormTemplate.findById(id);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }
    
    // Update template fields
    if (name !== undefined) template.name = name;
    if (description !== undefined) template.description = description;
    if (fields !== undefined) template.fields = fields;
    if (isDefault !== undefined) template.isDefault = isDefault;
    if (category !== undefined) template.category = category;
    if (isActive !== undefined) template.isActive = isActive;
    
    // Save the updated template
    console.log('Saving updated template');
    await template.save();
    
    // Populate creator info
    await template.populate('createdBy', 'firstName lastName email role');
    
    console.log('Template updated successfully');
    
    return res.status(200).json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Error updating template (admin):', error);
    
    // Check for validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error: ' + error.message,
        details: Object.keys(error.errors).map(key => ({ 
          field: key, 
          message: error.errors[key].message 
        }))
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Error updating template',
      error: error.message
    });
  }
};

// Delete a template (admin)
exports.deleteTemplate = async (req, res) => {
  try {
    console.log('Admin deleting template with ID:', req.params.id);
    
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Template ID is required'
      });
    }
    
    const FormTemplate = require('../models/FormTemplate');
    
    // Find and delete the template (admin can delete any template)
    const template = await FormTemplate.findByIdAndDelete(id);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }
    
    console.log('Template deleted successfully:', template._id);
    
    // Also remove this template from any patient-doctor associations
    try {
      const PatientDoctorAssociation = require('../models/PatientDoctorAssociation');
      
      const updateResult = await PatientDoctorAssociation.updateMany(
        { 'assignedTemplates.template': id },
        { $pull: { assignedTemplates: { template: id } } }
      );
      
      console.log('Updated associations result:', {
        matchedCount: updateResult.matchedCount,
        modifiedCount: updateResult.modifiedCount
      });
    } catch (assocError) {
      console.error('Error removing template from associations:', assocError);
      // Continue anyway since the template was deleted
    }
    
    return res.status(200).json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting template (admin):', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting template',
      error: error.message
    });
  }
};

// Assign template to patients (admin)
exports.assignTemplate = async (req, res) => {
  try {
    console.log('Admin assigning template:', req.params.id);
    const templateId = req.params.id;
    const { patientIds, doctorId } = req.body;
    
    if (!patientIds || !Array.isArray(patientIds) || patientIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Patient IDs array is required'
      });
    }
    
    const FormTemplate = require('../models/FormTemplate');
    const PatientDoctorAssociation = require('../models/PatientDoctorAssociation');
    
    // Verify template exists
    const template = await FormTemplate.findById(templateId);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }
    
    // Process each patient
    const results = {
      success: [],
      failed: []
    };
    
    for (const patientId of patientIds) {
      try {
        // Find or create association between patient and doctor
        let association = await PatientDoctorAssociation.findOne({
          doctor: doctorId,
          patient: patientId
        });
        
        if (!association) {
          // Create new association
          association = new PatientDoctorAssociation({
            doctor: doctorId,
            patient: patientId,
            status: 'active',
            assignedTemplates: [{
              template: templateId,
              assignedDate: new Date(),
              active: true
            }]
          });
        } else {
          // Check if template is already assigned
          const existingAssignment = association.assignedTemplates.find(
            assignment => assignment.template.toString() === templateId
          );
          
          if (existingAssignment) {
            // Update existing assignment
            existingAssignment.active = true;
            existingAssignment.assignedDate = new Date();
          } else {
            // Add new assignment
            association.assignedTemplates.push({
              template: templateId,
              assignedDate: new Date(),
              active: true
            });
          }
        }
        
        await association.save();
        results.success.push(patientId);
      } catch (error) {
        console.error(`Error assigning template to patient ${patientId}:`, error);
        results.failed.push({
          patientId,
          message: error.message
        });
      }
    }
    
    return res.status(200).json({
      success: true,
      message: `Template assigned to ${results.success.length} patients, failed for ${results.failed.length} patients`,
      data: results
    });
  } catch (error) {
    console.error('Error assigning template (admin):', error);
    return res.status(500).json({
      success: false,
      message: 'Error assigning template',
      error: error.message
    });
  }
};


// ===== ADMIN DOCTOR MANAGEMENT FUNCTIONS =====

// POST /api/admin/doctors - Add new doctor (admin function)
exports.addDoctor = async (req, res) => {
  try {
    console.log('🔄 Admin adding doctor:', req.body);
    
    const {
      tenantId,
      firstName,
      lastName,
      email,
      password,
      personalContactNumber,
      clinicLocation,
      clinicContactNumber,
      specialty,
      title,
      areasOfExpertise,
      experience,
      licenseNumber,
      licenseIssuingAuthority,
      licenseExpiryDate,
      education,
      verificationNotes,
      role = 'doctor'
    } = req.body;

    // Validate required fields
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required'
      });
    }

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'First name, last name, email, and password are required'
      });
    }

    if (!specialty || !experience) {
      return res.status(400).json({
        success: false,
        message: 'Specialty and experience are required'
      });
    }

    if (!licenseNumber || !licenseIssuingAuthority) {
      return res.status(400).json({
        success: false,
        message: 'License number and issuing authority are required'
      });
    }

    // Connect to the specific tenant database
    const tenantConn = await dbManager.connectTenant(tenantId);
    if (!tenantConn) {
      return res.status(500).json({
        success: false,
        message: 'Failed to connect to tenant database'
      });
    }

    // Get User model from tenant connection
    const User = tenantConn.model('User');

    // Check if user already exists in this tenant
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email already exists in this clinic'
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Prepare user data
    const userData = {
      firstName,
      lastName,
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
      tenantId,
      
      // Contact information
      personalContactNumber,
      clinicLocation,
      clinicContactNumber,
      
      // Professional information
      specialty,
      specialization: specialty, // For compatibility
      title,
      areasOfExpertise,
      experience,
      
      // License information
      licenseNumber,
      licenseIssuingAuthority,
      licenseExpiryDate: licenseExpiryDate ? new Date(licenseExpiryDate) : null,
      
      // Education (simple text format for admin-added doctors)
      education: education ? [{ degree: education, institution: '', year: '' }] : [],
      
      // Verification status - AUTO APPROVED for admin-added doctors
      verificationStatus: 'approved',
      verificationDate: new Date(),
      verificationNotes: verificationNotes || 'Added by admin - automatically approved',
      isAdminAdded: true,
      isVerified: true,
      
      // Account status
      accountStatus: 'active',
      isEmailVerified: true, // Skip email verification for admin-added doctors
      
      // Timestamps
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log('🔄 Creating doctor with data:', userData);

    // Create the user
    const newDoctor = new User(userData);
    await newDoctor.save();

    console.log('✅ Doctor created successfully:', newDoctor._id);

    // Remove password from response
    const responseDoctor = newDoctor.toObject();
    delete responseDoctor.password;

    // Log admin action
    console.log(`✅ Admin ${req.user?.email} added doctor: ${email}`);

    res.status(201).json({
      success: true,
      message: 'Doctor added and approved successfully',
      data: responseDoctor
    });

  } catch (error) {
    console.error('❌ Error adding doctor:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `A doctor with this ${field} already exists`
      });
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error while adding doctor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// PUT /api/admin/doctors/:id - Update doctor (admin function)
exports.updateDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId } = req.query;
    const updateData = req.body;

    console.log(`🔄 Admin updating doctor ${id}:`, updateData);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required'
      });
    }

    // Connect to the specific tenant database
    const tenantConn = await dbManager.connectTenant(tenantId);
    if (!tenantConn) {
      return res.status(500).json({
        success: false,
        message: 'Failed to connect to tenant database'
      });
    }

    // Get User model from tenant connection
    const User = tenantConn.model('User');

    // Find the doctor
    const doctor = await User.findOne({ _id: id, role: 'doctor' });
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    // Hash new password if provided
    if (updateData.password) {
      const saltRounds = 12;
      updateData.password = await bcrypt.hash(updateData.password, saltRounds);
    }

    // Update timestamps
    updateData.updatedAt = new Date();

    // Update the doctor
    const updatedDoctor = await User.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');

    console.log('✅ Doctor updated successfully:', updatedDoctor._id);

    res.json({
      success: true,
      message: 'Doctor updated successfully',
      data: updatedDoctor
    });

  } catch (error) {
    console.error('❌ Error updating doctor:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error while updating doctor'
    });
  }
};

// DELETE /api/admin/doctors/:id - Delete doctor (admin function)
exports.deleteDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId } = req.query;

    console.log(`🔄 Admin deleting doctor ${id}, tenant: ${tenantId || 'any'}`);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required'
      });
    }

    // Connect to the specific tenant database
    const tenantConn = await dbManager.connectTenant(tenantId);
    if (!tenantConn) {
      return res.status(500).json({
        success: false,
        message: 'Failed to connect to tenant database'
      });
    }

    // Get User model from tenant connection
    const User = tenantConn.model('User');

    // Find and delete the doctor
    const deletedDoctor = await User.findOneAndDelete({ 
      _id: id, 
      role: 'doctor' 
    });
    
    if (!deletedDoctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    console.log('✅ Doctor deleted successfully:', deletedDoctor._id);

    // Log admin action
    console.log(`✅ Admin ${req.user?.email} deleted doctor: ${deletedDoctor.email}`);

    res.json({
      success: true,
      message: 'Doctor deleted successfully',
      data: { deletedId: deletedDoctor._id }
    });

  } catch (error) {
    console.error('❌ Error deleting doctor:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while deleting doctor'
    });
  }
};

exports.getAllDoctors = async (req, res) => {
  try {
    console.log('Admin getting all doctors');
    
    const { page = 1, limit = 10, tenantId, status, search } = req.query;
    
    // If multi-tenant enabled, search across tenants
    if (process.env.ENABLE_MULTI_TENANT === 'true') {
      const masterConn = getMasterConnection();
      if (!masterConn) {
        throw new Error('Failed to connect to master database');
      }
      
      const Tenant = masterConn.model('Tenant');
      
      let tenantQuery = { active: true };
      if (tenantId && tenantId !== 'all') {
        tenantQuery._id = tenantId;
      }
      
      const tenants = await Tenant.find(tenantQuery);
      let allDoctors = [];
      
      for (const tenant of tenants) {
        try {
          const tenantConn = await dbManager.connectTenant(tenant._id.toString());
          if (!tenantConn) {
            console.warn(`Could not connect to tenant database: ${tenant.name}`);
            continue;
          }
          
          const User = tenantConn.model('User');
          
          // Build doctor query
          let doctorQuery = { role: 'doctor' };
          
          // Add status filter
          if (status && status !== 'all') {
            doctorQuery.verificationStatus = status;
          }
          
          // Add search filter
          if (search) {
            doctorQuery.$or = [
              { firstName: { $regex: search, $options: 'i' } },
              { lastName: { $regex: search, $options: 'i' } },
              { email: { $regex: search, $options: 'i' } },
              { specialty: { $regex: search, $options: 'i' } }
            ];
          }
          
          const doctors = await User.find(doctorQuery)
            .select('-password -resetToken -resetTokenExpires')
            .sort({ createdAt: -1 });
          
          // Add tenant information to each doctor
          const doctorsWithTenant = doctors.map(doctor => {
            const doctorObj = doctor.toObject();
            doctorObj.tenantId = tenant._id;
            doctorObj.tenantName = tenant.name;
            return doctorObj;
          });
          
          allDoctors = [...allDoctors, ...doctorsWithTenant];
        } catch (error) {
          console.error(`Error fetching doctors from tenant ${tenant.name}:`, error);
          // Continue with other tenants even if one fails
        }
      }
      
      // Sort all doctors by creation date
      allDoctors.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      // Apply pagination
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const paginatedDoctors = allDoctors.slice(startIndex, endIndex);
      
      return res.json({
        success: true,
        data: paginatedDoctors,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: allDoctors.length,
          pages: Math.ceil(allDoctors.length / limit)
        },
        searchInfo: {
          searchedTenants: tenants.length,
          totalDoctorsFound: allDoctors.length
        }
      });
    } else {
      // Single tenant mode
      const User = require('../models/User');
      
      // Build doctor query
      let doctorQuery = { role: 'doctor' };
      
      // Add status filter
      if (status && status !== 'all') {
        doctorQuery.verificationStatus = status;
      }
      
      // Add search filter
      if (search) {
        doctorQuery.$or = [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { specialty: { $regex: search, $options: 'i' } }
        ];
      }
      
      // Get total count for pagination
      const total = await User.countDocuments(doctorQuery);
      
      // Get doctors with pagination
      const doctors = await User.find(doctorQuery)
        .select('-password -resetToken -resetTokenExpires')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));
      
      return res.json({
        success: true,
        data: doctors,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    }
  } catch (error) {
    console.error('Error getting all doctors:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch doctors',
      error: error.message
    });
  }
};

// ===== ADMIN JOURNAL MANAGEMENT METHODS =====

// Get all journal entries across all tenants (admin function)
exports.getJournalEntries = async (req, res) => {
  try {
    console.log('Admin getting all journal entries with filters:', req.query);
    
    const {
      page = 1,
      limit = 10,
      patient,
      doctor,
      tenant,
      dateFrom,
      dateTo,
      sentiment,
      mood,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // If multi-tenant enabled, search across tenants
    if (process.env.ENABLE_MULTI_TENANT === 'true') {
      const masterConn = getMasterConnection();
      if (!masterConn) {
        throw new Error('Failed to connect to master database');
      }
      
      const Tenant = masterConn.model('Tenant');
      
      // Build tenant query
      let tenantQuery = { active: true };
      if (tenant && tenant !== 'all') {
        tenantQuery._id = tenant;
      }
      
      const tenants = await Tenant.find(tenantQuery);
      let allEntries = [];
      
      // Search each tenant
      for (const tenantDoc of tenants) {
        try {
          const tenantConn = await dbManager.connectTenant(tenantDoc._id.toString());
          if (!tenantConn) {
            console.warn(`Could not connect to tenant database: ${tenantDoc.name}`);
            continue;
          }
          
          const JournalEntry = tenantConn.model('JournalEntry');
          const User = tenantConn.model('User');
          
          // Build journal query
          let journalQuery = {};
          
          // Patient filter
          if (patient && patient !== 'all') {
            journalQuery.userId = patient;
          }
          
          // Date range filter
          if (dateFrom || dateTo) {
            journalQuery.createdAt = {};
            if (dateFrom) {
              journalQuery.createdAt.$gte = new Date(dateFrom);
            }
            if (dateTo) {
              journalQuery.createdAt.$lte = new Date(dateTo + 'T23:59:59.999Z');
            }
          }
          
          // Sentiment filter
          if (sentiment && sentiment !== 'all') {
            journalQuery['sentiment.type'] = sentiment;
          }
          
          // Mood filter
          if (mood && mood !== 'all') {
            journalQuery['mood.label'] = mood;
          }
          
          // Search filter
          if (search) {
            journalQuery.$or = [
              { title: { $regex: search, $options: 'i' } },
              { content: { $regex: search, $options: 'i' } },
              { rawText: { $regex: search, $options: 'i' } }
            ];
          }
          
          console.log(`Searching tenant ${tenantDoc.name} with query:`, journalQuery);
          
          // Get entries from this tenant
          const entries = await JournalEntry.find(journalQuery)
            .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
            .lean();
          
          console.log(`Found ${entries.length} entries in tenant ${tenantDoc.name}`);
          
          // Enrich entries with patient and tenant info
          for (const entry of entries) {
            try {
              // Get patient info
              const patient = await User.findById(entry.userId)
                .select('firstName lastName email')
                .lean();
              
              if (patient) {
                entry.patientName = `${patient.firstName} ${patient.lastName}`;
                entry.patientEmail = patient.email;
              } else {
                entry.patientName = 'Unknown Patient';
                entry.patientEmail = 'unknown@example.com';
              }
              
              // Get doctor info if available
              if (entry.doctorId) {
                const doctor = await User.findById(entry.doctorId)
                  .select('firstName lastName')
                  .lean();
                
                if (doctor) {
                  entry.doctorName = `${doctor.firstName} ${doctor.lastName}`;
                }
              }
              
              // Add tenant info
              entry.tenantId = tenantDoc._id;
              entry.tenantName = tenantDoc.name;
              
              // Ensure date field
              entry.date = entry.createdAt || entry.date || new Date();
              
              // Count words in content
              const content = entry.content || entry.rawText || entry.text || '';
              entry.wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
              
              // Process emotions
              if (entry.sentiment && entry.sentiment.emotions) {
                entry.emotions = Array.isArray(entry.sentiment.emotions) 
                  ? entry.sentiment.emotions.map(e => typeof e === 'string' ? e : e.name)
                  : [];
              } else {
                entry.emotions = [];
              }
              
            } catch (enrichError) {
              console.error('Error enriching entry:', enrichError);
              // Continue with basic entry data
              entry.patientName = 'Unknown Patient';
              entry.tenantName = tenantDoc.name;
              entry.date = entry.createdAt || new Date();
              entry.wordCount = 0;
              entry.emotions = [];
            }
          }
          
          allEntries = [...allEntries, ...entries];
        } catch (tenantError) {
          console.error(`Error searching tenant ${tenantDoc.name}:`, tenantError);
          continue;
        }
      }
      
      // Sort all entries
      allEntries.sort((a, b) => {
        const aVal = a[sortBy] || a.createdAt;
        const bVal = b[sortBy] || b.createdAt;
        
        if (sortOrder === 'desc') {
          return new Date(bVal) - new Date(aVal);
        } else {
          return new Date(aVal) - new Date(bVal);
        }
      });
      
      // Apply pagination
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const paginatedEntries = allEntries.slice(startIndex, endIndex);
      
      return res.json({
        success: true,
        data: paginatedEntries,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: allEntries.length,
          pages: Math.ceil(allEntries.length / limit)
        },
        searchInfo: {
          searchedTenants: tenants.length,
          totalEntriesFound: allEntries.length
        }
      });
    } else {
      // Single tenant mode
      const JournalEntry = require('../models/JournalEntry');
      const User = require('../models/User');
      
      // Build journal query
      let journalQuery = {};
      
      // Patient filter
      if (patient && patient !== 'all') {
        journalQuery.userId = patient;
      }
      
      // Date range filter
      if (dateFrom || dateTo) {
        journalQuery.createdAt = {};
        if (dateFrom) {
          journalQuery.createdAt.$gte = new Date(dateFrom);
        }
        if (dateTo) {
          journalQuery.createdAt.$lte = new Date(dateTo + 'T23:59:59.999Z');
        }
      }
      
      // Sentiment filter
      if (sentiment && sentiment !== 'all') {
        journalQuery['sentiment.type'] = sentiment;
      }
      
      // Mood filter
      if (mood && mood !== 'all') {
        journalQuery['mood.label'] = mood;
      }
      
      // Search filter
      if (search) {
        journalQuery.$or = [
          { title: { $regex: search, $options: 'i' } },
          { content: { $regex: search, $options: 'i' } },
          { rawText: { $regex: search, $options: 'i' } }
        ];
      }
      
      // Get total count
      const total = await JournalEntry.countDocuments(journalQuery);
      
      // Get entries with pagination
      const entries = await JournalEntry.find(journalQuery)
        .populate('userId', 'firstName lastName email')
        .populate('doctorId', 'firstName lastName')
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean();
      
      // Enrich entries
      entries.forEach(entry => {
        // Patient name
        if (entry.userId) {
          entry.patientName = `${entry.userId.firstName} ${entry.userId.lastName}`;
          entry.patientEmail = entry.userId.email;
        } else {
          entry.patientName = 'Unknown Patient';
        }
        
        // Doctor name
        if (entry.doctorId) {
          entry.doctorName = `${entry.doctorId.firstName} ${entry.doctorId.lastName}`;
        }
        
        // Date
        entry.date = entry.createdAt || entry.date || new Date();
        
        // Word count
        const content = entry.content || entry.rawText || entry.text || '';
        entry.wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
        
        // Emotions
        if (entry.sentiment && entry.sentiment.emotions) {
          entry.emotions = Array.isArray(entry.sentiment.emotions) 
            ? entry.sentiment.emotions.map(e => typeof e === 'string' ? e : e.name)
            : [];
        } else {
          entry.emotions = [];
        }
      });
      
      return res.json({
        success: true,
        data: entries,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    }
  } catch (error) {
    console.error('Error getting journal entries (admin):', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch journal entries',
      error: error.message
    });
  }
};

// Get journal entry by ID (admin function)
exports.getJournalEntry = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Admin getting journal entry: ${id}`);
    
    // If multi-tenant enabled, search across tenants
    if (process.env.ENABLE_MULTI_TENANT === 'true') {
      const masterConn = getMasterConnection();
      if (!masterConn) {
        throw new Error('Failed to connect to master database');
      }
      
      const Tenant = masterConn.model('Tenant');
      const tenants = await Tenant.find({ active: true });
      
      for (const tenant of tenants) {
        try {
          const tenantConn = await dbManager.connectTenant(tenant._id.toString());
          if (!tenantConn) continue;
          
          const JournalEntry = tenantConn.model('JournalEntry');
          const User = tenantConn.model('User');
          
          const entry = await JournalEntry.findById(id).lean();
          
          if (entry) {
            // Enrich with patient info
            const patient = await User.findById(entry.userId)
              .select('firstName lastName email')
              .lean();
            
            if (patient) {
              entry.patientName = `${patient.firstName} ${patient.lastName}`;
              entry.patientEmail = patient.email;
            }
            
            // Enrich with doctor info
            if (entry.doctorId) {
              const doctor = await User.findById(entry.doctorId)
                .select('firstName lastName')
                .lean();
              
              if (doctor) {
                entry.doctorName = `${doctor.firstName} ${doctor.lastName}`;
              }
            }
            
            entry.tenantId = tenant._id;
            entry.tenantName = tenant.name;
            
            return res.json({
              success: true,
              data: entry
            });
          }
        } catch (tenantError) {
          console.error(`Error searching tenant ${tenant.name}:`, tenantError);
          continue;
        }
      }
      
      return res.status(404).json({
        success: false,
        message: 'Journal entry not found'
      });
    } else {
      // Single tenant mode
      const JournalEntry = require('../models/JournalEntry');
      
      const entry = await JournalEntry.findById(id)
        .populate('userId', 'firstName lastName email')
        .populate('doctorId', 'firstName lastName')
        .lean();
      
      if (!entry) {
        return res.status(404).json({
          success: false,
          message: 'Journal entry not found'
        });
      }
      
      // Enrich entry
      if (entry.userId) {
        entry.patientName = `${entry.userId.firstName} ${entry.userId.lastName}`;
        entry.patientEmail = entry.userId.email;
      }
      
      if (entry.doctorId) {
        entry.doctorName = `${entry.doctorId.firstName} ${entry.doctorId.lastName}`;
      }
      
      return res.json({
        success: true,
        data: entry
      });
    }
  } catch (error) {
    console.error('Error getting journal entry (admin):', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch journal entry',
      error: error.message
    });
  }
};

// Delete journal entry (admin function)
exports.deleteJournalEntry = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Admin deleting journal entry: ${id}`);
    
    // If multi-tenant enabled, search across tenants
    if (process.env.ENABLE_MULTI_TENANT === 'true') {
      const masterConn = getMasterConnection();
      if (!masterConn) {
        throw new Error('Failed to connect to master database');
      }
      
      const Tenant = masterConn.model('Tenant');
      const tenants = await Tenant.find({ active: true });
      
      for (const tenant of tenants) {
        try {
          const tenantConn = await dbManager.connectTenant(tenant._id.toString());
          if (!tenantConn) continue;
          
          const JournalEntry = tenantConn.model('JournalEntry');
          
          const deletedEntry = await JournalEntry.findByIdAndDelete(id);
          
          if (deletedEntry) {
            console.log(`Journal entry deleted from tenant: ${tenant.name}`);
            return res.json({
              success: true,
              message: 'Journal entry deleted successfully'
            });
          }
        } catch (tenantError) {
          console.error(`Error deleting from tenant ${tenant.name}:`, tenantError);
          continue;
        }
      }
      
      return res.status(404).json({
        success: false,
        message: 'Journal entry not found'
      });
    } else {
      // Single tenant mode
      const JournalEntry = require('../models/JournalEntry');
      
      const deletedEntry = await JournalEntry.findByIdAndDelete(id);
      
      if (!deletedEntry) {
        return res.status(404).json({
          success: false,
          message: 'Journal entry not found'
        });
      }
      
      return res.json({
        success: true,
        message: 'Journal entry deleted successfully'
      });
    }
  } catch (error) {
    console.error('Error deleting journal entry (admin):', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete journal entry',
      error: error.message
    });
  }
};

// Export journal entries to PDF (admin function)
exports.exportJournalEntriesToPDF = async (req, res) => {
  try {
    console.log('Admin exporting journal entries to PDF with filters:', req.query);
    
    const {
      patient,
      doctor,
      tenant,
      dateFrom,
      dateTo,
      sentiment,
      mood,
      search
    } = req.query;

    let allEntries = [];

    // Get entries using the same logic as getJournalEntries but without pagination
    if (process.env.ENABLE_MULTI_TENANT === 'true') {
      const masterConn = getMasterConnection();
      if (!masterConn) {
        throw new Error('Failed to connect to master database');
      }
      
      const Tenant = masterConn.model('Tenant');
      
      let tenantQuery = { active: true };
      if (tenant && tenant !== 'all') {
        tenantQuery._id = tenant;
      }
      
      const tenants = await Tenant.find(tenantQuery);
      
      for (const tenantDoc of tenants) {
        try {
          const tenantConn = await dbManager.connectTenant(tenantDoc._id.toString());
          if (!tenantConn) continue;
          
          const JournalEntry = tenantConn.model('JournalEntry');
          const User = tenantConn.model('User');
          
          // Build query (same as getJournalEntries)
          let journalQuery = {};
          
          if (patient && patient !== 'all') {
            journalQuery.userId = patient;
          }
          
          if (dateFrom || dateTo) {
            journalQuery.createdAt = {};
            if (dateFrom) {
              journalQuery.createdAt.$gte = new Date(dateFrom);
            }
            if (dateTo) {
              journalQuery.createdAt.$lte = new Date(dateTo + 'T23:59:59.999Z');
            }
          }
          
          if (sentiment && sentiment !== 'all') {
            journalQuery['sentiment.type'] = sentiment;
          }
          
          if (mood && mood !== 'all') {
            journalQuery['mood.label'] = mood;
          }
          
          if (search) {
            journalQuery.$or = [
              { title: { $regex: search, $options: 'i' } },
              { content: { $regex: search, $options: 'i' } },
              { rawText: { $regex: search, $options: 'i' } }
            ];
          }
          
          const entries = await JournalEntry.find(journalQuery)
            .sort({ createdAt: -1 })
            .lean();
          
          // Enrich entries
          for (const entry of entries) {
            try {
              const patient = await User.findById(entry.userId)
                .select('firstName lastName')
                .lean();
              
              if (patient) {
                entry.patientName = `${patient.firstName} ${patient.lastName}`;
              } else {
                entry.patientName = 'Unknown Patient';
              }
              
              if (entry.doctorId) {
                const doctor = await User.findById(entry.doctorId)
                  .select('firstName lastName')
                  .lean();
                
                if (doctor) {
                  entry.doctorName = `${doctor.firstName} ${doctor.lastName}`;
                }
              }
              
              entry.tenantName = tenantDoc.name;
              entry.date = entry.createdAt || entry.date || new Date();
              
              const content = entry.content || entry.rawText || entry.text || '';
              entry.wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
            } catch (enrichError) {
              console.error('Error enriching entry for PDF:', enrichError);
              entry.patientName = 'Unknown Patient';
              entry.tenantName = tenantDoc.name;
              entry.date = entry.createdAt || new Date();
              entry.wordCount = 0;
            }
          }
          
          allEntries = [...allEntries, ...entries];
        } catch (tenantError) {
          console.error(`Error exporting from tenant ${tenantDoc.name}:`, tenantError);
          continue;
        }
      }
    } else {
      // Single tenant mode
      const JournalEntry = require('../models/JournalEntry');
      
      let journalQuery = {};
      
      if (patient && patient !== 'all') {
        journalQuery.userId = patient;
      }
      
      if (dateFrom || dateTo) {
        journalQuery.createdAt = {};
        if (dateFrom) {
          journalQuery.createdAt.$gte = new Date(dateFrom);
        }
        if (dateTo) {
          journalQuery.createdAt.$lte = new Date(dateTo + 'T23:59:59.999Z');
        }
      }
      
      if (sentiment && sentiment !== 'all') {
        journalQuery['sentiment.type'] = sentiment;
      }
      
      if (mood && mood !== 'all') {
        journalQuery['mood.label'] = mood;
      }
      
      if (search) {
        journalQuery.$or = [
          { title: { $regex: search, $options: 'i' } },
          { content: { $regex: search, $options: 'i' } },
          { rawText: { $regex: search, $options: 'i' } }
        ];
      }
      
      allEntries = await JournalEntry.find(journalQuery)
        .populate('userId', 'firstName lastName')
        .populate('doctorId', 'firstName lastName')
        .sort({ createdAt: -1 })
        .lean();
      
      // Enrich entries
      allEntries.forEach(entry => {
        if (entry.userId) {
          entry.patientName = `${entry.userId.firstName} ${entry.userId.lastName}`;
        } else {
          entry.patientName = 'Unknown Patient';
        }
        
        if (entry.doctorId) {
          entry.doctorName = `${entry.doctorId.firstName} ${entry.doctorId.lastName}`;
        }
        
        entry.date = entry.createdAt || entry.date || new Date();
        
        const content = entry.content || entry.rawText || entry.text || '';
        entry.wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
      });
    }

    // Sort entries by date
    allEntries.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Generate PDF using PDFKit
    const doc = new PDFDocument();
    
    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=journal-entries-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    
    // Pipe the PDF to the response
    doc.pipe(res);
    
    // Add PDF content
    doc.fontSize(18).text('Journal Entries Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Generated on: ${new Date().toLocaleDateString()}`);
    doc.moveDown();
    
    // Add filter information
    doc.fontSize(14).text('Filters Applied:');
    doc.fontSize(10);
    
    if (patient && patient !== 'all') {
      doc.text(`Patient ID: ${patient}`);
    } else {
      doc.text('Patient: All Patients');
    }
    
    if (tenant && tenant !== 'all') {
      doc.text(`Tenant ID: ${tenant}`);
    } else {
      doc.text('Tenant: All Tenants');
    }
    
    if (dateFrom) {
      doc.text(`From Date: ${dateFrom}`);
    }
    
    if (dateTo) {
      doc.text(`To Date: ${dateTo}`);
    }
    
    if (sentiment && sentiment !== 'all') {
      doc.text(`Sentiment: ${sentiment}`);
    } else {
      doc.text('Sentiment: All');
    }
    
    if (mood && mood !== 'all') {
      doc.text(`Mood: ${mood}`);
    } else {
      doc.text('Mood: All');
    }
    
    if (search) {
      doc.text(`Search: "${search}"`);
    }
    
    doc.moveDown();
    
    // Add entries summary
    doc.fontSize(14).text(`Total Journal Entries: ${allEntries.length}`);
    doc.moveDown();
    
    if (allEntries.length > 0) {
      // Add entries
      doc.fontSize(12);
      
      for (let i = 0; i < allEntries.length; i++) {
        const entry = allEntries[i];
        
        // Add new page if we're near the bottom
        if (doc.y > doc.page.height - 150) {
          doc.addPage();
        }
        
        // Entry header
        doc.font('Helvetica-Bold');
        doc.text(`${i + 1}. ${entry.title || 'Untitled Entry'}`, { underline: true });
        
        doc.font('Helvetica');
        doc.text(`Patient: ${entry.patientName}`);
        doc.text(`Date: ${new Date(entry.date).toLocaleDateString()}`);
        
        if (entry.tenantName) {
          doc.text(`Clinic: ${entry.tenantName}`);
        }
        
        if (entry.doctorName) {
          doc.text(`Doctor: ${entry.doctorName}`);
        }
        
        if (entry.sentiment && entry.sentiment.type) {
          doc.text(`Sentiment: ${entry.sentiment.type}`);
        }
        
        if (entry.mood && entry.mood.label) {
          doc.text(`Mood: ${entry.mood.label}`);
        }
        
        doc.text(`Words: ${entry.wordCount}`);
        
        // Entry content (truncated)
        const content = entry.content || entry.rawText || entry.text || '';
        const truncatedContent = content.length > 200 ? content.substring(0, 200) + '...' : content;
        
        doc.moveDown(0.5);
        doc.text('Content:', { continued: false });
        doc.text(truncatedContent, { indent: 20, width: 500 });
        
        doc.moveDown();
        
        // Add separator line
        doc.moveTo(50, doc.y)
           .lineTo(doc.page.width - 50, doc.y)
           .stroke();
        
        doc.moveDown();
      }
    } else {
      doc.text('No journal entries match the selected filters.');
    }
    
    // Finalize the PDF
    doc.end();
    
  } catch (error) {
    console.error('Error exporting journal entries to PDF (admin):', error);
    
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to export journal entries to PDF',
        error: error.message
      });
    }
  }
};

// Get journal statistics (admin function)
exports.getJournalStats = async (req, res) => {
  try {
    console.log('Admin getting journal statistics');
    
    let totalEntries = 0;
    let sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
    let moodCounts = {};
    let recentEntries = [];
    
    if (process.env.ENABLE_MULTI_TENANT === 'true') {
      const masterConn = getMasterConnection();
      if (!masterConn) {
        throw new Error('Failed to connect to master database');
      }
      
      const Tenant = masterConn.model('Tenant');
      const tenants = await Tenant.find({ active: true });
      
      for (const tenant of tenants) {
        try {
          const tenantConn = await dbManager.connectTenant(tenant._id.toString());
          if (!tenantConn) continue;
          
          const JournalEntry = tenantConn.model('JournalEntry');
          const User = tenantConn.model('User');
          
          // Count entries
          const entryCount = await JournalEntry.countDocuments();
          totalEntries += entryCount;
          
          // Get sentiment counts
          const sentimentAgg = await JournalEntry.aggregate([
            {
              $group: {
                _id: '$sentiment.type',
                count: { $sum: 1 }
              }
            }
          ]);
          
          sentimentAgg.forEach(item => {
            if (item._id && sentimentCounts.hasOwnProperty(item._id)) {
              sentimentCounts[item._id] += item.count;
            }
          });
          
          // Get mood counts
          const moodAgg = await JournalEntry.aggregate([
            {
              $group: {
                _id: '$mood.label',
                count: { $sum: 1 }
              }
            }
          ]);
          
          moodAgg.forEach(item => {
            if (item._id) {
              moodCounts[item._id] = (moodCounts[item._id] || 0) + item.count;
            }
          });
          
          // Get recent entries from this tenant
          const tenantRecentEntries = await JournalEntry.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();
          
          // Enrich with patient info and add to recent entries
          for (const entry of tenantRecentEntries) {
            try {
              const patient = await User.findById(entry.userId)
                .select('firstName lastName')
                .lean();
              
              if (patient) {
                entry.patientName = `${patient.firstName} ${patient.lastName}`;
              } else {
                entry.patientName = 'Unknown Patient';
              }
              
              entry.tenantName = tenant.name;
              recentEntries.push(entry);
            } catch (enrichError) {
              console.error('Error enriching recent entry:', enrichError);
            }
          }
          
        } catch (tenantError) {
          console.error(`Error getting stats from tenant ${tenant.name}:`, tenantError);
          continue;
        }
      }
      
      // Sort recent entries and limit to 10
      recentEntries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      recentEntries = recentEntries.slice(0, 10);
      
    } else {
      // Single tenant mode
      const JournalEntry = require('../models/JournalEntry');
      
      // Count total entries
      totalEntries = await JournalEntry.countDocuments();
      
      // Get sentiment counts
      const sentimentAgg = await JournalEntry.aggregate([
        {
          $group: {
            _id: '$sentiment.type',
            count: { $sum: 1 }
          }
        }
      ]);
      
      sentimentAgg.forEach(item => {
        if (item._id && sentimentCounts.hasOwnProperty(item._id)) {
          sentimentCounts[item._id] = item.count;
        }
      });
      
      // Get mood counts
      const moodAgg = await JournalEntry.aggregate([
        {
          $group: {
            _id: '$mood.label',
            count: { $sum: 1 }
          }
        }
      ]);
      
      moodAgg.forEach(item => {
        if (item._id) {
          moodCounts[item._id] = item.count;
        }
      });
      
      // Get recent entries
      recentEntries = await JournalEntry.find()
        .populate('userId', 'firstName lastName')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();
      
      // Enrich recent entries
      recentEntries.forEach(entry => {
        if (entry.userId) {
          entry.patientName = `${entry.userId.firstName} ${entry.userId.lastName}`;
        } else {
          entry.patientName = 'Unknown Patient';
        }
      });
    }
    
    // Calculate percentages
    const sentimentPercentages = {};
    Object.keys(sentimentCounts).forEach(sentiment => {
      sentimentPercentages[sentiment] = totalEntries > 0 
        ? Math.round((sentimentCounts[sentiment] / totalEntries) * 100) 
        : 0;
    });
    
    const stats = {
      total: totalEntries,
      sentimentCounts,
      sentimentPercentages,
      moodCounts,
      recentEntries,
      averageEntriesPerDay: 0, // Could calculate this based on date range
      topEmotions: [] // Could implement emotion analysis
    };
    
    return res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('Error getting journal stats (admin):', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch journal statistics',
      error: error.message
    });
  }
};

// Get all patients for filter dropdown (admin function)
exports.getAllPatientsForFilter = async (req, res) => {
  try {
    console.log('Admin getting all patients for filter');
    
    let allPatients = [];
    
    if (process.env.ENABLE_MULTI_TENANT === 'true') {
      const masterConn = getMasterConnection();
      if (!masterConn) {
        throw new Error('Failed to connect to master database');
      }
      
      const Tenant = masterConn.model('Tenant');
      const tenants = await Tenant.find({ active: true });
      
      for (const tenant of tenants) {
        try {
          const tenantConn = await dbManager.connectTenant(tenant._id.toString());
          if (!tenantConn) continue;
          
          const User = tenantConn.model('User');
          
          const patients = await User.find({ role: 'patient' })
            .select('firstName lastName email')
            .sort({ firstName: 1 })
            .lean();
          
          // Add tenant info to each patient
          const patientsWithTenant = patients.map(patient => ({
            ...patient,
            tenantId: tenant._id,
            tenantName: tenant.name
          }));
          
          allPatients = [...allPatients, ...patientsWithTenant];
        } catch (tenantError) {
          console.error(`Error fetching patients from tenant ${tenant.name}:`, tenantError);
          continue;
        }
      }
      
      // Sort all patients by first name
      allPatients.sort((a, b) => a.firstName.localeCompare(b.firstName));
      
    } else {
      // Single tenant mode
      const User = require('../models/User');
      
      allPatients = await User.find({ role: 'patient' })
        .select('firstName lastName email')
        .sort({ firstName: 1 })
        .lean();
    }
    
    return res.json({
      success: true,
      data: allPatients
    });
    
  } catch (error) {
    console.error('Error getting patients for filter (admin):', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch patients',
      error: error.message
    });
  }
};

// Get all doctors for filter dropdown (admin function)
exports.getAllDoctorsForFilter = async (req, res) => {
  try {
    console.log('Admin getting all doctors for filter');
    
    let allDoctors = [];
    
    if (process.env.ENABLE_MULTI_TENANT === 'true') {
      const masterConn = getMasterConnection();
      if (!masterConn) {
        throw new Error('Failed to connect to master database');
      }
      
      const Tenant = masterConn.model('Tenant');
      const tenants = await Tenant.find({ active: true });
      
      for (const tenant of tenants) {
        try {
          const tenantConn = await dbManager.connectTenant(tenant._id.toString());
          if (!tenantConn) continue;
          
          const User = tenantConn.model('User');
          
          const doctors = await User.find({ 
            role: 'doctor',
            verificationStatus: 'approved' 
          })
            .select('firstName lastName email specialty')
            .sort({ firstName: 1 })
            .lean();
          
          // Add tenant info to each doctor
          const doctorsWithTenant = doctors.map(doctor => ({
            ...doctor,
            tenantId: tenant._id,
            tenantName: tenant.name
          }));
          
          allDoctors = [...allDoctors, ...doctorsWithTenant];
        } catch (tenantError) {
          console.error(`Error fetching doctors from tenant ${tenant.name}:`, tenantError);
          continue;
        }
      }
      
      // Sort all doctors by first name
      allDoctors.sort((a, b) => a.firstName.localeCompare(b.firstName));
      
    } else {
      // Single tenant mode
      const User = require('../models/User');
      
      allDoctors = await User.find({ 
        role: 'doctor',
        verificationStatus: 'approved' 
      })
        .select('firstName lastName email specialty')
        .sort({ firstName: 1 })
        .lean();
    }
    
    return res.json({
      success: true,
      data: allDoctors
    });
    
  } catch (error) {
    console.error('Error getting doctors for filter (admin):', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch doctors',
      error: error.message
    });
  }
};