// server/src/controllers/authController.js

const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');
const sendEmail = require('../utils/emailService');
const { getMasterConnection } = require('../config/dbMaster');
const dbManager = require('../utils/dbManager');
const bcryptjs = require('bcryptjs');

const StreamChat = require('stream-chat').StreamChat;

// Initialize Stream Chat with environment variables
const streamClient = StreamChat.getInstance(
  process.env.STREAM_CHAT_API_KEY, // From .env file
  process.env.STREAM_CHAT_SECRET   // From .env file
);

// Validate Stream Chat configuration
if (!process.env.STREAM_CHAT_API_KEY || !process.env.STREAM_CHAT_SECRET) {
  console.warn('⚠️ Stream Chat credentials not found in environment variables');
  console.warn('Please add STREAM_CHAT_API_KEY and STREAM_CHAT_SECRET to your .env file');
}

// Create a new Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Helper function to generate JWT token without expiration
const generateToken = (userId, role, tenantId = null) => {
  const payload = { 
    id: userId, 
    role: role 
  };
  
  // Add tenant ID to token if provided
  if (tenantId) {
    payload.tenantId = tenantId;
  }
  
  return jwt.sign(
    payload,
    process.env.JWT_SECRET
    // No expiresIn parameter means the token will never expire
  );
};

// Helper function to send response with token
const createSendToken = (user, statusCode, res, tenant = null) => {
  // Generate token (with tenant ID if available)
  const token = generateToken(user._id, user.role, tenant ? tenant._id : null);
  
  // Don't send password in response
  user.password = undefined;
  
  // Prepare response data
  const responseData = {
    success: true,
    token,
    user
  };
  
  // Add tenant info if available
  if (tenant) {
    responseData.tenant = {
      _id: tenant._id,
      name: tenant.name,
      logoUrl: tenant.logoUrl,
      primaryColor: tenant.primaryColor,
      secondaryColor: tenant.secondaryColor
    };
  }
  
  res.status(statusCode).json(responseData);
};

// Helper function to generate a 6-digit verification code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Helper function to hash a token
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Get all available tenants (clinics)
exports.getTenants = async (req, res) => {
  try {
    const tenants = await dbManager.getAllTenants();
    
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

// Register new user
exports.register = async (req, res, next) => {
  try {
    console.log('Registration request body:', req.body);
    console.log('Registration files:', req.files);
    
    // Check if req.body exists
    if (!req.body) {
      return res.status(400).json({
        success: false,
        message: 'Request body is missing'
      });
    }
    
    // Extract form data - Updated to include new fields
    const { 
      firstName, 
      lastName, 
      email, 
      password, 
      confirmPassword,
      termsAccepted,
      tenantId: rawTenantId,
      
      // NEW: Contact Information
      personalContactNumber,
      clinicLocation,
      clinicContactNumber,
      
      // NEW: Professional Information
      specialty,
      title,
      areasOfExpertise,
      experience,
      
      // NEW: Availability (JSON strings)
      availability,
      appointmentTypes,
      
      // NEW: Credentials (JSON strings)
      education,
      licenses,
      certifications
    } = req.body;
    
    // FIX: Handle tenantId array issue
    const tenantId = Array.isArray(rawTenantId) ? rawTenantId[0] : rawTenantId;
    console.log('Fixed tenantId:', tenantId);
    
    // Process file uploads if present
    let profilePhotoUrl = null;
    let licenseDocumentUrl = null;
    let educationCertificateUrl = null;
    let additionalDocumentUrls = [];
    
    if (req.files) {
      if (req.files.profilePhoto && req.files.profilePhoto.length > 0) {
        profilePhotoUrl = req.files.profilePhoto[0].path.replace(/\\/g, '/');
        console.log('Profile photo uploaded:', profilePhotoUrl);
      }
      
      if (req.files.licenseDocument && req.files.licenseDocument.length > 0) {
        licenseDocumentUrl = req.files.licenseDocument[0].path.replace(/\\/g, '/');
        console.log('License document uploaded:', licenseDocumentUrl);
      }
      
      if (req.files.educationCertificate && req.files.educationCertificate.length > 0) {
        educationCertificateUrl = req.files.educationCertificate[0].path.replace(/\\/g, '/');
        console.log('Education certificate uploaded:', educationCertificateUrl);
      }
      
      if (req.files.additionalDocuments && req.files.additionalDocuments.length > 0) {
        additionalDocumentUrls = req.files.additionalDocuments.map(file => file.path.replace(/\\/g, '/'));
        console.log('Additional documents uploaded:', additionalDocumentUrls);
      }
    }
    
    // Get role from body or params
    const role = req.body.role || req.query.role || 'patient';
    console.log(`Registering user with role: ${role}`);
    
    // Get tenant ID from body or request object (set by middleware)
    const effectiveTenantId = tenantId || req.tenantId;
    console.log(`Using tenant ID: ${effectiveTenantId}`);
    
    // Variable to store the User model (either from default DB or tenant DB)
    let UserModel;
    let tenant = null;
    
    // If multi-tenant is enabled and tenantId is provided, use tenant-specific database
    if (process.env.ENABLE_MULTI_TENANT === 'true' && effectiveTenantId) {
      try {
        // Get tenant info from master database
        const masterConn = getMasterConnection();
        const Tenant = masterConn.model('Tenant');
        tenant = await Tenant.findById(effectiveTenantId);
        
        if (!tenant || !tenant.active) {
          return res.status(400).json({
            success: false,
            message: 'Invalid or inactive clinic selected'
          });
        }
        
        console.log(`Connecting to tenant database: ${tenant.name} for ${role} registration`);
        
        // Connect to tenant database
        const tenantConn = await dbManager.connectTenant(effectiveTenantId);
        if (!tenantConn) {
          throw new Error(`Failed to connect to tenant database: ${effectiveTenantId}`);
        }
        
        // Get the User model from tenant connection
        UserModel = tenantConn.model('User');
        console.log(`Using User model from tenant: ${tenant.name}`);
      } catch (error) {
        console.error('Error connecting to tenant:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to connect to tenant database',
          error: error.message
        });
      }
    } else {
      console.log('No tenant ID provided, using default User model');
      UserModel = require('../models/User');
    }
    
    // Validate required fields
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        errors: [
          { field: 'firstName', message: firstName ? '' : 'First name is required' },
          { field: 'lastName', message: lastName ? '' : 'Last name is required' },
          { field: 'email', message: email ? '' : 'Email is required' },
          { field: 'password', message: password ? '' : 'Password is required' }
        ].filter(err => err.message)
      });
    }
    
    // Check if password matches confirm password
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match',
        errors: [{ field: 'confirmPassword', message: 'Passwords do not match' }]
      });
    }
    
    // Doctor role-specific validation
    if (role === 'doctor') {
      if (!specialty || !experience) {
        return res.status(400).json({
          success: false,
          message: 'Missing required professional fields',
          errors: [
            { field: 'specialty', message: specialty ? '' : 'Specialty is required' },
            { field: 'experience', message: experience ? '' : 'Experience is required' }
          ].filter(err => err.message)
        });
      }
      
      // Require license document and education certificate for doctors
      if (!licenseDocumentUrl || !educationCertificateUrl) {
        return res.status(400).json({
          success: false,
          message: 'Required documents are missing',
          errors: [
            { field: 'licenseDocument', message: licenseDocumentUrl ? '' : 'License document is required' },
            { field: 'educationCertificate', message: educationCertificateUrl ? '' : 'Education certificate is required' }
          ].filter(err => err.message)
        });
      }
    }
    
    // Check if email already exists with timeout handling
    let existingUser;
    try {
      existingUser = await UserModel.findOne({ email }).maxTimeMS(5000); // 5 second timeout
    } catch (timeoutError) {
      console.error('Database timeout checking existing user:', timeoutError);
      return res.status(500).json({
        success: false,
        message: 'Database connection timeout. Please try again.',
        error: 'Connection timeout'
      });
    }
    
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already in use',
        errors: [{ field: 'email', message: 'Email already in use' }]
      });
    }
    
    // Create new user with role
    const user = new UserModel({
      firstName,
      lastName,
      email,
      password,
      termsAccepted: termsAccepted === 'true' || termsAccepted === true,
      role: role,
      accountStatus: role === 'doctor' ? 'pending' : 'active',
      tenantId: tenant ? tenant._id : null
    });
    
    // Add NEW contact information
    if (personalContactNumber) user.personalContactNumber = personalContactNumber;
    if (clinicLocation) user.clinicLocation = clinicLocation;
    if (clinicContactNumber) user.clinicContactNumber = clinicContactNumber;
    
    // Add doctor-specific fields if role is doctor
    if (role === 'doctor') {
      console.log('Adding doctor-specific fields');
      
      // Professional Information
      if (specialty) user.specialty = specialty;
      if (title) user.title = title;
      if (areasOfExpertise) user.areasOfExpertise = areasOfExpertise;
      if (experience) user.experience = experience;
      
      // Parse and add availability
      if (availability && typeof availability === 'string') {
        try {
          user.availability = JSON.parse(availability);
        } catch (e) {
          console.error('Error parsing availability:', e);
        }
      } else if (availability && typeof availability === 'object') {
        user.availability = availability;
      }
      
      // Parse and add appointment types
      if (appointmentTypes && typeof appointmentTypes === 'string') {
        try {
          user.appointmentTypes = JSON.parse(appointmentTypes);
        } catch (e) {
          console.error('Error parsing appointment types:', e);
        }
      } else if (appointmentTypes && typeof appointmentTypes === 'object') {
        user.appointmentTypes = appointmentTypes;
      }
      
      // Parse and add credentials
      if (education && typeof education === 'string') {
        try {
          user.education = JSON.parse(education);
        } catch (e) {
          console.error('Error parsing education:', e);
          user.education = [];
        }
      } else if (education && Array.isArray(education)) {
        user.education = education;
      } else {
        user.education = [];
      }
      
      if (licenses && typeof licenses === 'string') {
        try {
          user.licenses = JSON.parse(licenses);
        } catch (e) {
          console.error('Error parsing licenses:', e);
          user.licenses = [];
        }
      } else if (licenses && Array.isArray(licenses)) {
        user.licenses = licenses;
      } else {
        user.licenses = [];
      }
      
      if (certifications && typeof certifications === 'string') {
        try {
          user.certifications = JSON.parse(certifications);
        } catch (e) {
          console.error('Error parsing certifications:', e);
          user.certifications = [];
        }
      } else if (certifications && Array.isArray(certifications)) {
        user.certifications = certifications;
      } else {
        user.certifications = [];
      }
      
      // Add file URLs for doctors
      if (profilePhotoUrl) {
        user.profilePicture = profilePhotoUrl;
      }
      
      if (licenseDocumentUrl) {
        user.licenseDocumentUrl = licenseDocumentUrl;
      }
      
      if (educationCertificateUrl) {
        user.educationCertificateUrl = educationCertificateUrl;
      }
      
      if (additionalDocumentUrls.length > 0) {
        user.additionalDocumentUrls = additionalDocumentUrls;
      }
      
      // Set verification status for doctors
      user.verificationStatus = 'pending';
      
      // Fix for verificationNotes - make it an array of objects
      user.verificationNotes = [{
        content: 'Awaiting review by admin',
        timestamp: new Date()
      }];
    } else if (profilePhotoUrl) {
      // Add profile photo for non-doctor roles
      user.profilePicture = profilePhotoUrl;
    }
    
    console.log('User object before saving:', JSON.stringify(user, null, 2));
    
    // Generate verification code
    const verificationCode = generateVerificationCode();
    const hashedToken = hashToken(verificationCode);
    
    // Set verification token on user object
    user.emailVerificationToken = hashedToken;
    user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    
    // Hash the password manually before saving
    try {
      if (user.password) {
        console.log('Manually hashing password before saving');
        const bcryptjs = require('bcryptjs');
        const salt = await bcryptjs.genSalt(10);
        user.password = await bcryptjs.hash(user.password, salt);
        console.log('Password hashed successfully');
      }
      
      // Save with validation disabled and timeout
      await user.save({ 
        validateBeforeSave: false,
        maxTimeMS: 10000 // 10 second timeout
      });
      console.log(`User saved successfully in ${tenant ? 'tenant' : 'default'} database with ID: ${user._id}`);
    } catch (validationError) {
      console.error('User validation error:', validationError);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validationError.errors || [{ message: validationError.message }]
      });
    }
    
    // Prepare email content - include tenant name if available
    const welcomeMessage = tenant 
      ? `Welcome to ${tenant.name}!`
      : 'Welcome to our platform!';
    
    // Send verification email
    try {
      const sendEmail = require('../utils/emailService');
      await sendEmail({
        to: user.email,
        subject: 'Verify your email address',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>${welcomeMessage}</h2>
            <p>Thank you for registering${role === 'doctor' ? ' as a healthcare professional' : ''}. Please use the verification code below to complete your registration:</p>
            <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 24px; letter-spacing: 5px; margin: 20px 0;">
              <strong>${verificationCode}</strong>
            </div>
            <p>This code will expire in 24 hours.</p>
            ${role === 'doctor' ? '<p>After verification, your professional profile will be reviewed by our administrative team before being activated.</p>' : ''}
            <p>If you did not request this, please ignore this email.</p>
          </div>
        `
      });
      
      // Prepare response
      const response = {
        success: true,
        message: 'User registered successfully. Please check your email for verification code.',
        email: user.email,
        role: user.role,
        accountStatus: user.accountStatus
      };
      
      // Add tenant info if available
      if (tenant) {
        response.tenantId = tenant._id;
        response.tenantName = tenant.name;
      }
      
      // Send response without token (user needs to verify email first)
      res.status(201).json(response);
    } catch (emailError) {
      console.error('Error sending verification email:', emailError);
      // If email sending fails, delete the user
      await UserModel.findByIdAndDelete(user._id);
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification email. Please try again.'
      });
    }
  } catch (error) {
    console.error('Registration error details:', error);
    return res.status(500).json({
      success: false,
      message: 'Error registering user',
      error: error.message
    });
  }
};

// ✅ ADD: Generate Stream Chat token for authenticated users
const generateChatToken = async (req, res) => {
  try {
    console.log('🔄 Generating Stream Chat token...');
    
    // Check if Stream Chat is properly configured
    if (!process.env.STREAM_CHAT_API_KEY || !process.env.STREAM_CHAT_SECRET) {
      return res.status(500).json({
        success: false,
        message: 'Stream Chat is not properly configured on the server'
      });
    }
    
    // Get user ID from request body or authenticated user
    const userId = req.body.userId || (req.user && req.user.id);
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required to generate chat token'
      });
    }
    
    console.log(`🔄 Generating token for user: ${userId}`);
    
    // Generate token using Stream Chat SDK
    const token = streamClient.createToken(userId);
    
    if (!token) {
      throw new Error('Failed to generate token');
    }
    
    console.log('✅ Stream Chat token generated successfully');
    
    res.json({
      success: true,
      message: 'Stream Chat token generated successfully',
      data: {
        token: token,
        userId: userId,
        apiKey: process.env.STREAM_CHAT_API_KEY, // Use environment variable
        expires: 'never' // Your tokens don't expire
      }
    });
    
  } catch (error) {
    console.error('❌ Error generating Stream Chat token:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate chat token',
      error: error.message
    });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    const { email, password, tenantId } = req.body;
    
    console.log('==== LOGIN ATTEMPT ====');
    console.log(`Email: ${email}`);
    if (tenantId) console.log(`Tenant ID: ${tenantId}`);

    // Check if email and password are provided
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Variable to store the User model (either from default DB or tenant DB)
    let UserModel = null;
    let tenant = null;
    let connection = null;
    let foundInTenant = false;
    
    // If multi-tenant is enabled and tenantId is provided, use tenant-specific database
    if (process.env.ENABLE_MULTI_TENANT === 'true' && tenantId) {
      try {
        console.log(`Connecting to tenant database with ID: ${tenantId}`);
        
        // Get tenant info from master database
        const masterConn = getMasterConnection();
        const Tenant = masterConn.model('Tenant');
        tenant = await Tenant.findById(tenantId);
        
        if (!tenant || !tenant.active) {
          return res.status(400).json({
            success: false,
            message: 'Invalid or inactive clinic selected'
          });
        }
        
        // Connect to tenant database
        connection = await dbManager.connectTenant(tenantId);
        if (connection) {
          console.log(`Connected to tenant database: ${tenant.name}`);
          UserModel = connection.model('User');
          
          // Try to find the user in tenant database
          const tenantUser = await UserModel.findOne({ email }).select('+password');
          
          if (tenantUser) {
            foundInTenant = true;
            console.log(`User found in tenant database: ${tenant.name}`);
            
            // Continue with checking password
            if (!tenantUser.password) {
              console.log('User has no password set (might be Google auth only)');
              return res.status(401).json({
                success: false,
                message: 'Invalid login method'
              });
            }
            
            console.log('Comparing password...');
            const isMatch = await tenantUser.comparePassword(password);
            console.log(`Password match result: ${isMatch}`);
            
            if (!isMatch) {
              return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
              });
            }
            
            // For doctor roles, check if account is approved
            if (tenantUser.role === 'doctor' && tenantUser.accountStatus !== 'active') {
              return res.status(401).json({
                success: false,
                message: 'Your doctor account is pending approval',
                pendingApproval: true
              });
            }
            
            // Generate token (with tenant info)
            console.log('Generating token...');
            const token = generateToken(tenantUser._id, tenantUser.role, tenant._id);
            
            // Remove password from response
            tenantUser.password = undefined;
            
            // Prepare response data
            const responseData = {
              success: true,
              token,
              user: {
                _id: tenantUser._id,
                firstName: tenantUser.firstName,
                lastName: tenantUser.lastName,
                email: tenantUser.email,
                profilePicture: tenantUser.profilePicture,
                role: tenantUser.role,
                onboardingCompleted: tenantUser.onboardingCompleted
              },
              tenant: {
                _id: tenant._id,
                name: tenant.name,
                logoUrl: tenant.logoUrl,
                primaryColor: tenant.primaryColor,
                secondaryColor: tenant.secondaryColor
              }
            };
            
            // Send response
            console.log('Login successful, sending response');
            return res.status(200).json(responseData);
          } else {
            console.log(`User not found in tenant database ${tenant.name}`);
          }
        } else {
          console.log(`Failed to connect to tenant database: ${tenantId}`);
        }
      } catch (error) {
        console.error('Error connecting to tenant:', error);
      }
    }
    
    // If we reach here, either:
    // 1. No tenantId was provided
    // 2. The tenant connection failed
    // 3. The user wasn't found in the tenant database
    
    // Try the default database (fallback)
    console.log('Trying default database...');
    UserModel = require('../models/User');
    
    try {
      console.log(`Finding user with email in default database: ${email}`);
      const user = await UserModel.findOne({ email }).select('+password');
      
      // Log details for debugging
      if (user) {
        console.log(`User found in default database: ${user.email}`);
        console.log(`User role: ${user.role}`);
        console.log(`Account status: ${user.accountStatus}`);
        console.log(`Password exists: ${!!user.password}`);
      } else {
        console.log(`No user found with email: ${email} in any database`);
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }
      
      // Check if password exists before comparing
      if (!user.password) {
        console.log('User has no password set (might be Google auth only)');
        return res.status(401).json({
          success: false,
          message: 'Invalid login method'
        });
      }
      
      // Check if password matches
      console.log('Comparing password...');
      const isMatch = await user.comparePassword(password);
      console.log(`Password match result: ${isMatch}`);
      
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }
      
      // For doctor roles, check if account is approved
      if (user.role === 'doctor' && user.accountStatus !== 'active') {
        return res.status(401).json({
          success: false,
          message: 'Your doctor account is pending approval',
          pendingApproval: true
        });
      }
      
      // Generate token (with tenant info if available)
      console.log('Generating token...');
      const token = generateToken(user._id, user.role, tenant ? tenant._id : null);
      
      // Remove password from response
      user.password = undefined;
      
      // Prepare response data
      const responseData = {
        success: true,
        token,
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          profilePicture: user.profilePicture,
          role: user.role,
          onboardingCompleted: user.onboardingCompleted
        }
      };
      
      // Add tenant info if available
      if (tenant) {
        responseData.tenant = {
          _id: tenant._id,
          name: tenant.name,
          logoUrl: tenant.logoUrl,
          primaryColor: tenant.primaryColor,
          secondaryColor: tenant.secondaryColor
        };
      }
      
      // Send response
      console.log('Login successful (from default database), sending response');
      res.status(200).json(responseData);
    } catch (dbError) {
      console.error('Database error during login:', dbError);
      return res.status(500).json({
        success: false,
        message: 'Database error during login',
        error: dbError.message
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during login',
      error: error.message
    });
  }
};

// Google authentication
exports.googleAuth = async (req, res, next) => {
  try {
    const { idToken, tenantId } = req.body;
    
    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    
    const { sub: googleId, email, given_name, family_name, picture } = ticket.getPayload();
    
    // Variable to store the User model (either from default DB or tenant DB)
    let UserModel = User;
    let tenant = null;
    
    // If multi-tenant is enabled and tenantId is provided, use tenant-specific database
    if (process.env.ENABLE_MULTI_TENANT === 'true' && tenantId) {
      try {
        // Get tenant info from master database
        const masterConn = getMasterConnection();
        const Tenant = masterConn.model('Tenant');
        tenant = await Tenant.findById(tenantId);
        
        if (!tenant || !tenant.active) {
          return res.status(400).json({
            success: false,
            message: 'Invalid or inactive clinic selected'
          });
        }
        
        // Connect to tenant database
        const tenantConn = await dbManager.connectTenant(tenant._id.toString(), tenant.dbName);
        UserModel = tenantConn.model('User');
      } catch (error) {
        console.error('Error connecting to tenant:', error);
        // Fall back to regular User model if tenant connection fails
      }
    }
    
    // Check if user exists with Google ID or email
    let user = await UserModel.findOne({ $or: [{ googleId }, { email }] });
    
    // Track if this is a new user
    const isNewUser = !user;
    
    if (!user) {
      // Create new user if doesn't exist
      user = await UserModel.create({
        firstName: given_name || 'User',
        lastName: family_name || '',
        email,
        googleId,
        profilePicture: picture || 'default-profile.png',
        isEmailVerified: true, // Google already verified email
        termsAccepted: true, // Assuming terms accepted
        onboardingCompleted: false, // New users need onboarding
        role: 'patient' // Google login only for patients
      });
    } else {
      // Update existing user with Google info
      user.googleId = googleId;
      user.isEmailVerified = true;
      
      // Update profile info if not already set
      if (!user.firstName) user.firstName = given_name || 'User';
      if (!user.lastName) user.lastName = family_name || '';
      if (!user.profilePicture || user.profilePicture === 'default-profile.png') {
        user.profilePicture = picture || 'default-profile.png';
      }
      
      await user.save({ validateBeforeSave: false });
    }
    
    // Update last login timestamp
    user.lastLogin = Date.now();
    await user.save({ validateBeforeSave: false });
    
    // Generate token with role using the helper (and tenant if available)
    const token = generateToken(user._id, user.role, tenant ? tenant._id : null);
    
    // Don't send password in response
    user.password = undefined;
    
    // Prepare response data
    const responseData = {
      success: true,
      token,
      user,
      isNewUser,
      onboardingRequired: !user.onboardingCompleted,
      redirectTo: !user.onboardingCompleted ? '/onboarding' : '/dashboard'
    };
    
    // Add tenant info if available
    if (tenant) {
      responseData.tenant = {
        _id: tenant._id,
        name: tenant.name,
        logoUrl: tenant.logoUrl,
        primaryColor: tenant.primaryColor,
        secondaryColor: tenant.secondaryColor
      };
    }
    
    // Send response
    res.status(200).json(responseData);
  } catch (error) {
    next(error);
  }
};

// Verify email
// Verify email
exports.verifyEmail = async (req, res, next) => {
  try {
    let { email, code, tenantId } = req.body;
    
    console.log('Verification attempt:', { email, code, tenantId });
    
    // Normalize the email
    email = email.toLowerCase().trim();
    
    // Variable to store the User model
    let UserModel = User;
    let tenant = null;
    let connection = null;
    let userFoundInTenant = false;
    
    // If multi-tenant is enabled and tenantId is provided, use tenant-specific database
    if (process.env.ENABLE_MULTI_TENANT === 'true' && tenantId) {
      try {
        // Get tenant info from master database
        const masterConn = getMasterConnection();
        const Tenant = masterConn.model('Tenant');
        tenant = await Tenant.findById(tenantId);
        
        if (!tenant || !tenant.active) {
          return res.status(400).json({
            success: false,
            message: 'Invalid or inactive clinic selected'
          });
        }
        
        // Connect to tenant database
        connection = await dbManager.connectTenant(tenant._id);
        UserModel = connection.model('User');
        console.log(`Connected to tenant database: ${tenant.name}`);
      } catch (error) {
        console.error('Error connecting to tenant:', error);
        return res.status(500).json({
          success: false,
          message: 'Error connecting to tenant database',
          error: error.message
        });
      }
    }
    
    // First try to find the user by email in tenant DB - this uses Mongoose
    let user = await UserModel.findOne({ email });
    
    // If user not found in tenant DB but we're in multi-tenant mode, try the default DB
    if (!user && process.env.ENABLE_MULTI_TENANT === 'true') {
      console.log(`User not found in tenant database. Checking default database...`);
      
      // Try to find in the default database
      user = await User.findOne({ email });
      
      if (user) {
        console.log(`Found user in default database instead:`, {
          id: user._id,
          email: user.email,
          hasToken: !!user.emailVerificationToken
        });
        
        userFoundInTenant = false;
        // Use the default User model instead
        UserModel = User;
      }
    } else if (user) {
      userFoundInTenant = true;
      console.log(`Found user in tenant database:`, {
        id: user._id,
        email: user.email,
        hasToken: !!user.emailVerificationToken
      });
    }
    
    if (!user) {
      console.log(`No user found with email: ${email} in any database`);
      return res.status(400).json({
        success: false,
        message: 'User not found'
      });
    }
    
    console.log('User found:', {
      id: user._id,
      email: user.email,
      database: userFoundInTenant ? 'tenant' : 'default',
      hasToken: !!user.emailVerificationToken,
      tokenExpiry: user.emailVerificationExpires
    });
    
    // If using tenant database, handle verification via direct MongoDB operations
    if (userFoundInTenant && connection) {
      // DIRECT MONGODB ACCESS for verification token operations
      // Get the MongoDB client and database directly
      const client = connection.getClient();
      const db = client.db(tenant.dbName);
      const usersCollection = db.collection('users');
      
      // If the user doesn't have a verification token, we need to generate one
      if (!user.emailVerificationToken || !user.emailVerificationExpires) {
        console.log('User does not have a verification token. Resending...');
        
        // Generate a new verification code
        const verificationCode = generateVerificationCode();
        const hashedToken = hashToken(verificationCode);
        
        // Set token expiry to 24 hours from now
        const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
        
        // Update user directly in MongoDB
        const updateResult = await usersCollection.updateOne(
          { _id: user._id },
          { 
            $set: { 
              emailVerificationToken: hashedToken,
              emailVerificationExpires: tokenExpiry,
              hasVerificationToken: true
            }
          }
        );
        
        console.log('MongoDB direct update result:', updateResult);
        
        // Check if the update was successful
        if (updateResult.modifiedCount === 0) {
          return res.status(500).json({
            success: false,
            message: 'Error setting verification token'
          });
        }
        
        // Fetch the updated user to confirm the token was set
        const updatedUser = await usersCollection.findOne({ _id: user._id });
        console.log('User after direct MongoDB update:', {
          email: updatedUser.email,
          hasToken: !!updatedUser.emailVerificationToken,
          tokenExpiry: updatedUser.emailVerificationExpires,
          hasVerificationToken: updatedUser.hasVerificationToken
        });
        
        // Send verification email
        const welcomeMessage = tenant 
          ? `Verification Code for ${tenant.name}`
          : 'Verification Code';
        
        await sendEmail({
          to: user.email,
          subject: 'New Verification Code',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>${welcomeMessage}</h2>
              <p>We've generated a new verification code for you:</p>
              <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 24px; letter-spacing: 5px; margin: 20px 0;">
                <strong>${verificationCode}</strong>
              </div>
              <p>This code will expire in 24 hours.</p>
              <p>Please use this new code to verify your email.</p>
            </div>
          `
        });
        
        return res.status(400).json({
          success: false,
          message: 'No active verification code found. A new code has been sent to your email.',
          newCodeSent: true
        });
      }
      
      // Hash the provided code for comparison
      const hashedCode = hashToken(code);
      
      console.log('Code received:', code);
      console.log('Hashed code (first 10 chars):', hashedCode.substring(0, 10) + '...');
      console.log('User token (first 10 chars):', user.emailVerificationToken.substring(0, 10) + '...');
      
      // Check if token matches and is not expired
      const tokenMatches = user.emailVerificationToken === hashedCode;
      const tokenNotExpired = user.emailVerificationExpires > Date.now();
      
      console.log('Token matches:', tokenMatches);
      console.log('Token not expired:', tokenNotExpired);
      
      if (!tokenMatches || !tokenNotExpired) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired verification code'
        });
      }
      
      // Token is valid - mark user as verified using direct MongoDB update
      const verifyResult = await usersCollection.updateOne(
        { _id: user._id },
        { 
          $set: { 
            isEmailVerified: true,
            isVerified: true,
            hasVerificationToken: false
          },
          $unset: {
            emailVerificationToken: "",
            emailVerificationExpires: ""
          }
        }
      );
      
      console.log('Verification update result:', verifyResult);
      
      // Reload the user to get updated fields
      const verifiedUser = await UserModel.findById(user._id);
      
      // Generate token with role and tenant info if available
      const token = generateToken(verifiedUser._id, verifiedUser.role, tenant ? tenant._id : null);
      
      // Don't send password in response
      verifiedUser.password = undefined;
      
      // Determine redirect based on role and onboarding status
      let redirectTo = !verifiedUser.onboardingCompleted ? '/onboarding' : '/dashboard';
      
      // If doctor is verified but pending approval, show doctor verification page
      if (verifiedUser.role === 'doctor' && verifiedUser.accountStatus === 'pending') {
        redirectTo = '/doctor-verification';
      }
      
      // Prepare response data
      const responseData = {
        success: true,
        token,
        user: verifiedUser,
        onboardingRequired: !verifiedUser.onboardingCompleted,
        redirectTo: redirectTo
      };
      
      // Add tenant info if available
      if (tenant) {
        responseData.tenant = {
          _id: tenant._id,
          name: tenant.name,
          logoUrl: tenant.logoUrl,
          primaryColor: tenant.primaryColor
        };
      }
      
      // Send response
      res.status(200).json(responseData);
    } else {
      // Handle verification using default Mongoose methods for default database
      
      // If the user doesn't have a verification token, we need to generate one
      if (!user.emailVerificationToken || !user.emailVerificationExpires) {
        console.log('User does not have a verification token in default DB. Resending...');
        
        // Generate a new verification code
        const verificationCode = generateVerificationCode();
        const hashedToken = hashToken(verificationCode);
        
        // Set verification token on user
        user.emailVerificationToken = hashedToken;
        user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        user.hasVerificationToken = true;
        
        // Save the updated user
        await user.save({ validateBeforeSave: false });
        
        // Verify the token was saved
        const updatedUser = await User.findById(user._id);
        console.log('User after update in default DB:', {
          email: updatedUser.email,
          hasToken: !!updatedUser.emailVerificationToken,
          tokenExpiry: updatedUser.emailVerificationExpires
        });
        
        // Send verification email
        const welcomeMessage = tenant 
          ? `Verification Code for ${tenant.name}`
          : 'Verification Code';
        
        await sendEmail({
          to: user.email,
          subject: 'New Verification Code',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>${welcomeMessage}</h2>
              <p>We've generated a new verification code for you:</p>
              <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 24px; letter-spacing: 5px; margin: 20px 0;">
                <strong>${verificationCode}</strong>
              </div>
              <p>This code will expire in 24 hours.</p>
              <p>Please use this new code to verify your email.</p>
            </div>
          `
        });
        
        return res.status(400).json({
          success: false,
          message: 'No active verification code found. A new code has been sent to your email.',
          newCodeSent: true
        });
      }
      
      // Hash the provided code for comparison
      const hashedCode = hashToken(code);
      
      console.log('Code received:', code);
      console.log('Hashed code (first 10 chars):', hashedCode.substring(0, 10) + '...');
      console.log('User token (first 10 chars):', user.emailVerificationToken.substring(0, 10) + '...');
      
      // Check if token matches and is not expired
      const tokenMatches = user.emailVerificationToken === hashedCode;
      const tokenNotExpired = user.emailVerificationExpires > Date.now();
      
      console.log('Token matches:', tokenMatches);
      console.log('Token not expired:', tokenNotExpired);
      
      if (!tokenMatches || !tokenNotExpired) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired verification code'
        });
      }
      
      // Token is valid - mark user as verified
      user.isEmailVerified = true;
      user.isVerified = true;
      user.hasVerificationToken = false;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      
      await user.save({ validateBeforeSave: false });
      
      // Generate token with role and tenant info if available
      const token = generateToken(user._id, user.role, tenant ? tenant._id : null);
      
      // Don't send password in response
      user.password = undefined;
      
      // Determine redirect based on role and onboarding status
      let redirectTo = !user.onboardingCompleted ? '/onboarding' : '/dashboard';
      
      // If doctor is verified but pending approval, show doctor verification page
      if (user.role === 'doctor' && user.accountStatus === 'pending') {
        redirectTo = '/doctor-verification';
      }
      
      // Prepare response data
      const responseData = {
        success: true,
        token,
        user,
        onboardingRequired: !user.onboardingCompleted,
        redirectTo: redirectTo
      };
      
      // Add tenant info if available
      if (tenant) {
        responseData.tenant = {
          _id: tenant._id,
          name: tenant.name,
          logoUrl: tenant.logoUrl,
          primaryColor: tenant.primaryColor
        };
      }
      
      // Send response
      res.status(200).json(responseData);
    }
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying email',
      error: error.message 
    });
  }
};

// Resend verification code - SINGLE updated implementation
exports.resendVerificationCode = async (req, res, next) => {
  try {
    const { email, tenantId } = req.body;
    
    console.log(`Resending verification code for email: ${email}, tenant: ${tenantId || 'none'}`);
    
    // Variable to store the User model
    let UserModel = User;
    let tenant = null;
    let connection = null;
    let defaultConnection = null;
    
    // If multi-tenant is enabled and tenantId is provided, use tenant-specific database
    if (process.env.ENABLE_MULTI_TENANT === 'true' && tenantId) {
      try {
        // Get tenant info from master database
        const masterConn = getMasterConnection();
        const Tenant = masterConn.model('Tenant');
        tenant = await Tenant.findById(tenantId);
        
        if (!tenant || !tenant.active) {
          return res.status(400).json({
            success: false,
            message: 'Invalid or inactive clinic selected'
          });
        }
        
        // Connect to tenant database
        connection = await dbManager.connectTenant(tenant._id);
        UserModel = connection.model('User');
        console.log(`Connected to tenant database: ${tenant.name}`);
      } catch (error) {
        console.error('Error connecting to tenant:', error);
        return res.status(500).json({
          success: false,
          message: 'Error connecting to tenant database',
          error: error.message
        });
      }
    }
    
    // Find user by email using Mongoose
    let user = await UserModel.findOne({ email });
    
    // If user not found in tenant database, try the default database
    if (!user && process.env.ENABLE_MULTI_TENANT === 'true') {
      console.log(`User not found in tenant database, checking default database...`);
      user = await User.findOne({ email });
      
      if (user) {
        console.log(`User found in default database, will use this record instead.`);
        
        // If we need to migrate this user to the tenant database, we could do that here
        // For now, just use the default database record
        UserModel = User;
        connection = null;
      }
    }
    
    if (!user) {
      console.log(`No user found with email: ${email} in any database`);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    console.log('User found:', {
      id: user._id,
      email: user.email,
      database: connection ? 'tenant' : 'default',
      hasVerificationToken: user.hasVerificationToken || !!user.emailVerificationToken,
      tokenExpiry: user.emailVerificationExpires
    });
    
    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }
    
    // Generate new verification code
    const verificationCode = generateVerificationCode();
    const hashedToken = hashToken(verificationCode);
    
    console.log(`Generated new verification code: ${verificationCode}`);
    console.log(`Hashed token (first 10 chars): ${hashedToken.substring(0, 10)}...`);
    
    // Update user with new verification token
    if (connection) {
      // DIRECT MONGODB ACCESS for verification token operations with tenant database
      const client = connection.getClient();
      const db = client.db(tenant.dbName);
      const usersCollection = db.collection('users');
      
      // Update user directly in MongoDB
      const updateResult = await usersCollection.updateOne(
        { _id: user._id },
        { 
          $set: { 
            emailVerificationToken: hashedToken,
            emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            hasVerificationToken: true
          }
        }
      );
      
      console.log('MongoDB direct update result:', updateResult);
      
      // Check if the update was successful
      if (updateResult.modifiedCount === 0) {
        return res.status(500).json({
          success: false,
          message: 'Error setting verification token'
        });
      }
      
      // Fetch the updated user to confirm the token was set
      const updatedUser = await usersCollection.findOne({ _id: user._id });
      console.log('User after direct MongoDB update:', {
        email: updatedUser.email,
        hasToken: !!updatedUser.emailVerificationToken,
        tokenExpiry: updatedUser.emailVerificationExpires,
        hasVerificationToken: updatedUser.hasVerificationToken
      });
    } else {
      // Use Mongoose update for default database
      user.emailVerificationToken = hashedToken;
      user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      user.hasVerificationToken = true;
      
      await user.save({ validateBeforeSave: false });
      
      console.log('User updated with Mongoose:', {
        email: user.email,
        hasToken: !!user.emailVerificationToken,
        tokenExpiry: user.emailVerificationExpires,
        hasVerificationToken: user.hasVerificationToken
      });
    }
    
    // Prepare email content - include tenant name if available
    const welcomeMessage = tenant 
      ? `Verification Code for ${tenant.name}`
      : 'Verification Code';
    
    // Send verification email
    await sendEmail({
      to: user.email,
      subject: 'Verify your email address',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>${welcomeMessage}</h2>
          <p>Please use the verification code below to verify your email:</p>
          <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 24px; letter-spacing: 5px; margin: 20px 0;">
            <strong>${verificationCode}</strong>
          </div>
          <p>This code will expire in 24 hours.</p>
          <p>If you did not request this, please ignore this email.</p>
        </div>
      `
    });
    
    res.status(200).json({
      success: true,
      message: 'Verification code sent to your email'
    });
  } catch (error) {
    console.error('Error resending verification code:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending verification code',
      error: error.message
    });
  }
};

// Forgot password - Update to support tenants
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email, tenantId } = req.body;
    
    // Variable to store the User model (either from default DB or tenant DB)
    let UserModel = User;
    let tenant = null;
    
    // If multi-tenant is enabled and tenantId is provided, use tenant-specific database
    if (process.env.ENABLE_MULTI_TENANT === 'true' && tenantId) {
      try {
        // Get tenant info from master database
        const masterConn = getMasterConnection();
        const Tenant = masterConn.model('Tenant');
        tenant = await Tenant.findById(tenantId);
        
        if (!tenant || !tenant.active) {
          return res.status(400).json({
            success: false,
            message: 'Invalid or inactive clinic selected'
          });
        }
        
        // Connect to tenant database
        const tenantConn = await dbManager.connectTenant(tenant._id.toString(), tenant.dbName);
        UserModel = tenantConn.model('User');
      } catch (error) {
        console.error('Error connecting to tenant:', error);
        // Fall back to regular User model if tenant connection fails
      }
    }
    
    // Find user by email
    const user = await UserModel.findOne({ email });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Generate 6-digit reset code
    const resetCode = generateVerificationCode();
    
    // Hash reset code and store in user document
    user.passwordResetToken = crypto
      .createHash('sha256')
      .update(resetCode)
      .digest('hex');
    
    // Set expiration (10 minutes)
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000;
    
    await user.save({ validateBeforeSave: false });
    
    // Prepare email content - include tenant name if available
    const resetMessage = tenant 
      ? `Password Reset Request for ${tenant.name}`
      : 'Password Reset Request';
    
    // Send reset code email
    await sendEmail({
      to: user.email,
      subject: 'Password Reset Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>${resetMessage}</h2>
          <p>You requested to reset your password. Please use the code below:</p>
          <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 24px; letter-spacing: 5px; margin: 20px 0;">
            <strong>${resetCode}</strong>
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you did not request this, please ignore this email.</p>
        </div>
      `
    });
    
    res.status(200).json({
      success: true,
      message: 'Password reset code sent to your email'
    });
  } catch (error) {
    next(error);
  }
};

// Verify reset code - Update to support tenants
exports.verifyResetCode = async (req, res, next) => {
  try {
    const { email, code, tenantId } = req.body;
    
    // Variable to store the User model (either from default DB or tenant DB)
    let UserModel = User;
    
    // If multi-tenant is enabled and tenantId is provided, use tenant-specific database
    if (process.env.ENABLE_MULTI_TENANT === 'true' && tenantId) {
      try {
        // Get tenant info from master database
        const masterConn = getMasterConnection();
        const Tenant = masterConn.model('Tenant');
        const tenant = await Tenant.findById(tenantId);
        
        if (!tenant || !tenant.active) {
          return res.status(400).json({
            success: false,
            message: 'Invalid or inactive clinic selected'
          });
        }
        
        // Connect to tenant database
        const tenantConn = await dbManager.connectTenant(tenant._id.toString(), tenant.dbName);
        UserModel = tenantConn.model('User');
      } catch (error) {
        console.error('Error connecting to tenant:', error);
        // Fall back to regular User model if tenant connection fails
      }
    }
    
    // Hash the provided code for comparison
    const hashedCode = crypto
      .createHash('sha256')
      .update(code)
      .digest('hex');
    
    // Find user with matching email and reset token
    const user = await UserModel.findOne({
      email,
      passwordResetToken: hashedCode,
      passwordResetExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset code'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Reset code verified successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Reset password with code - Update to support tenants
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, code, newPassword, confirmPassword, tenantId } = req.body;
    
    // Validate password match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }
    
    // Variable to store the User model (either from default DB or tenant DB)
    let UserModel = User;
    
    // If multi-tenant is enabled and tenantId is provided, use tenant-specific database
    if (process.env.ENABLE_MULTI_TENANT === 'true' && tenantId) {
      try {
        // Get tenant info from master database
        const masterConn = getMasterConnection();
        const Tenant = masterConn.model('Tenant');
        const tenant = await Tenant.findById(tenantId);
        
        if (!tenant || !tenant.active) {
          return res.status(400).json({
            success: false,
            message: 'Invalid or inactive clinic selected'
          });
        }
        
        // Connect to tenant database
        const tenantConn = await dbManager.connectTenant(tenant._id.toString(), tenant.dbName);
        UserModel = tenantConn.model('User');
      } catch (error) {
        console.error('Error connecting to tenant:', error);
        // Fall back to regular User model if tenant connection fails
      }
    }
    
    // Hash the provided code for comparison
    const hashedCode = crypto
      .createHash('sha256')
      .update(code)
      .digest('hex');
    
    // Find user with matching email and reset token
    const user = await UserModel.findOne({
      email,
      passwordResetToken: hashedCode,
      passwordResetExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset code'
      });
    }
    
    // Update password and clear reset tokens
    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Get user profile
exports.getMe = async (req, res, next) => {
  try {
    // User object is already attached to req by the protect middleware
    const { user, tenantConnection } = req;
    
    // For safety, remove password from response
    user.password = undefined;
    
    // Get any additional data needed for the profile
    // For example, if we need to get the tenant info:
    let tenantData = null;
    
    // If in multi-tenant mode and user has a tenantId
    if (process.env.ENABLE_MULTI_TENANT === 'true' && user.tenantId) {
      try {
        const masterConn = getMasterConnection();
        const Tenant = masterConn.model('Tenant');
        
        const tenant = await Tenant.findById(user.tenantId)
          .select('name logoUrl primaryColor secondaryColor');
        
        if (tenant) {
          tenantData = tenant.toObject();
        }
      } catch (error) {
        console.error('Error fetching tenant details:', error);
        // Continue without tenant info if there's an error
      }
    }
    
    // Send response
    res.status(200).json({
      success: true,
      user,
      tenant: tenantData
    });
  } catch (error) {
    next(error);
  }
};

// Admin only - Get all users
exports.getAllUsers = async (req, res, next) => {
  try {
    let UserModel;
    
    // If in multi-tenant mode, use tenant-specific connection
    if (process.env.ENABLE_MULTI_TENANT === 'true' && req.tenantConnection) {
      UserModel = req.tenantConnection.model('User');
    } else {
      UserModel = User;
    }
    
    const users = await UserModel.find().select('-password');
    
    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    next(error);
  }
};

exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('==== ADMIN LOGIN ATTEMPT ====');
    console.log(`Email: ${email}`);

    // Check if email and password are provided
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Use the User model from the master database
    const User = require('../models/User');
    
    // Find the user by email and ensure they have admin role
    const adminUser = await User.findOne({ 
      email, 
      role: 'admin' 
    }).select('+password');
    
    if (!adminUser) {
      console.log(`No admin found with email: ${email}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    console.log(`Admin found: ${adminUser._id}`);
    
    // Check if password matches
    const isMatch = await adminUser.comparePassword(password);
    
    if (!isMatch) {
      console.log('Password does not match');
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Generate token
    const token = generateToken(adminUser._id, adminUser.role);
    
    // Remove sensitive data
    adminUser.password = undefined;
    
    // Send response
    console.log('Admin login successful');
    res.status(200).json({
      success: true,
      token,
      user: {
        _id: adminUser._id,
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        email: adminUser.email,
        role: adminUser.role
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during login',
      error: error.message
    });
  }
};

module.exports = {
  getTenants: exports.getTenants,
  register: exports.register,
  login: exports.login,
  googleAuth: exports.googleAuth,
  verifyEmail: exports.verifyEmail,
  resendVerificationCode: exports.resendVerificationCode,
  forgotPassword: exports.forgotPassword,
  verifyResetCode: exports.verifyResetCode,
  resetPassword: exports.resetPassword,
  getMe: exports.getMe,
  getAllUsers: exports.getAllUsers,
  adminLogin: exports.adminLogin,
  generateChatToken,
};