// server/src/controllers/doctorController.js

const User = require('../models/User');
const JournalEntry = require('../models/JournalEntry');
const FormTemplate = require('../models/FormTemplate');
const PatientDoctorAssociation = require('../models/PatientDoctorAssociation');
const Appointment = require('../models/Appointment'); 
const nlpService = require('../services/nlpService');
const jwt = require('jsonwebtoken');
const { uploadToS3 } = require('../utils/fileUpload');
const sendEmail = require('../utils/emailService');
const { connectToTenant } = require('../utils/dbManager'); // Add this import
const createUserSchema = require('../schemas/definitions/userSchema'); // Add this import

// ===== DOCTOR VERIFICATION METHODS =====

/**
 * Doctor registration with professional verification
 * @public - Accessible without authentication
 */
// Update this part in your doctor controller's register function




exports.register = async (req, res) => {
  try {
    console.log('Doctor registration request body:', req.body);
    console.log('Doctor registration files:', req.files);
    
    const {
      firstName, lastName, email, password, title, specialization,
      licenseNumber, licenseIssuingAuthority, licenseExpiryDate,
      yearsOfExperience, practiceAddress, bio, languages, 
      availableForEmergency, consultationFee, telehealth, inPerson,
      agreedToTerms, agreedToPrivacyPolicy, agreedToCodeOfConduct
    } = req.body;
    
    // Check if doctor already exists
    const existingDoctor = await User.findOne({ email });
    if (existingDoctor) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }
    
    // Handle file uploads
    let licenseDocumentUrl = '';
    let profilePhotoUrl = '';
    
    if (req.files && req.files.licenseDocument) {
      licenseDocumentUrl = await uploadToS3(
        req.files.licenseDocument[0],
        `licenses/${licenseNumber}`
      );
    }
    
    if (req.files && req.files.profilePhoto) {
      profilePhotoUrl = await uploadToS3(
        req.files.profilePhoto[0],
        `doctors/profiles/${firstName}-${lastName}`
      );
    }
    
    // Create new doctor with ALL fields from the form
    const newDoctor = new User({
      // Basic info
      firstName,
      lastName,
      email,
      password,
      role: 'doctor',
      accountStatus: 'active',
      
      // Professional details
      title,
      specialty: specialization,
      licenseNumber,
      licenseIssuingAuthority, 
      licenseExpiryDate,
      licenseDocumentUrl, // Add this which was missing
      yearsOfPractice: parseInt(yearsOfExperience) || 0,
      clinicAddress: practiceAddress,
      
      // Profile info
      bio,
      profilePicture: profilePhotoUrl,
      
      // Parse arrays correctly 
      languages: Array.isArray(languages) ? languages : 
                (typeof languages === 'string' ? JSON.parse(languages || '[]') : []),
      
      // Boolean values
      emergencyAware: availableForEmergency === 'true' || availableForEmergency === true,
      telehealth: telehealth === 'true' || telehealth === true,
      inPerson: inPerson === 'true' || inPerson === true,
      
      // Add missing fields from your form
      consultationFee: parseFloat(consultationFee) || 0,
      
      // Terms acceptance
      termsAccepted: agreedToTerms === 'true' || agreedToTerms === true,
      
      // Verification related fields
      isVerified: false,
      verificationStatus: 'pending',
      isActive: false,
      createdAt: Date.now()
    });
    
    console.log('Saving new doctor with data:', newDoctor);
    await newDoctor.save();
    
    // Rest of your function...
    res.status(201).json({
      success: true,
      message: 'Registration successful. Your account is pending verification.',
      data: {
        id: newDoctor._id,
        email: newDoctor.email,
        verificationStatus: newDoctor.verificationStatus
      }
    });
  } catch (error) {
    console.error('Doctor registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Doctor login with verification status check
 * @public - Accessible without authentication
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find doctor by email
    const doctor = await User.findOne({ email, role: 'doctor' });
    if (!doctor) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Check if doctor is verified
    if (!doctor.isVerified || doctor.verificationStatus !== 'approved') {
      return res.status(403).json({
        success: false,
        message: `Your account is ${doctor.verificationStatus}. Please wait for admin verification or check your email.`,
        verificationStatus: doctor.verificationStatus
      });
    }
    
    // Verify password
    const isMatch = await doctor.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Update last login
    doctor.lastLogin = Date.now();
    await doctor.save();
    
    // Generate JWT token
    const token = jwt.sign(
      { id: doctor._id, role: doctor.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    
    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      doctor: doctor.getPublicProfile ? doctor.getPublicProfile() : {
        _id: doctor._id,
        firstName: doctor.firstName,
        lastName: doctor.lastName,
        email: doctor.email,
        role: doctor.role,
        isVerified: doctor.isVerified
      }
    });
  } catch (error) {
    console.error('Doctor login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get verification status for a doctor
 * @public - Accessible without authentication but requires doctor ID
 */
exports.getVerificationStatus = async (req, res) => {
  try {
    const doctorId = req.params.id || (req.user && req.user._id);
    
    if (!doctorId) {
      return res.status(400).json({
        success: false,
        message: 'Doctor ID is required'
      });
    }
    
    const doctor = await User.findOne({ 
      _id: doctorId, 
      role: 'doctor' 
    }).select('verificationStatus verificationNotes rejectionReason');
    
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        verificationStatus: doctor.verificationStatus,
        verificationNotes: doctor.verificationNotes,
        rejectionReason: doctor.rejectionReason
      }
    });
  } catch (error) {
    console.error('Get verification status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch verification status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ===== PATIENT-FACING DOCTOR METHODS =====

/**
 * Get available doctors with optional filtering
 * @public - Accessible without auth or role restriction
 */
exports.getAvailableDoctors = async (req, res) => {
  try {
    console.log('-------------------------------------');
    console.log('GETAVAILABLEDOCTORS CALLED DIRECTLY');
    console.log('Query params:', req.query);
    
    // CRITICAL: Extract tenant ID directly from query params
    const tenantId = req.query.tenantId;
    console.log('Tenant ID from query params:', tenantId || 'Not provided');
    
    // Skip middleware context and directly connect to tenant database if tenantId provided
    if (tenantId) {
      try {
        // Connect directly to tenant database
        const dbManager = require('../utils/dbManager');
        console.log(`Attempting direct connection to tenant: ${tenantId}`);
        
        const connection = await dbManager.connectTenant(tenantId);
        
        if (connection) {
          console.log(`Successfully connected to tenant database: ${tenantId} - bypassing middleware`);
          
          // Get User model directly from connection
          const User = connection.model('User');
          
          // Build query - only include doctors with approved status
          const query = { 
            role: 'doctor', 
            verificationStatus: 'approved'
          };
          
          console.log('DIRECT CONNECTION QUERY:', JSON.stringify(query));
          
          // Log all doctors in tenant database (for debugging)
          const allDoctors = await User.find({ role: 'doctor' }).lean();
          console.log(`DIRECT: Found ${allDoctors.length} total doctors in tenant database`);
          
          // Log each doctor's details
          allDoctors.forEach((doc, i) => {
            console.log(`TENANT Doctor ${i+1}:`, {
              id: doc._id,
              name: `${doc.firstName} ${doc.lastName}`,
              email: doc.email || 'No email',
              verificationStatus: doc.verificationStatus || 'Not set',
              isVerified: !!doc.isVerified,
              isActive: !!doc.isActive
            });
          });
          
          // Execute query to get approved doctors
          const doctors = await User.find(query)
            .select('firstName lastName title credentials specialty specialization profilePicture description languages gender lgbtqAffirming availability')
            .sort({ createdAt: -1 })
            .lean();
          
          console.log(`DIRECT: Found ${doctors.length} approved doctors in tenant database`);
          
          // Return results
          return res.status(200).json({
            success: true,
            data: doctors,
            source: 'DIRECT TENANT CONNECTION',
            tenantId
          });
        } else {
          console.error(`Failed to connect directly to tenant database: ${tenantId}`);
        }
      } catch (directError) {
        console.error('Error in direct tenant connection:', directError);
      }
    }
    
    // If we reach here, we couldn't use the direct connection approach
    // Fall back to the default database
    
    console.log('FALLBACK: Using default database approach');
    
    // Get the default User model
    const User = require('../models/User');
    
    // Build the same query
    const query = { 
      role: 'doctor', 
      verificationStatus: 'approved'
    };
    
    console.log('DEFAULT QUERY:', JSON.stringify(query));
    
    // Find doctors using the default User model
    const doctors = await User.find(query)
      .select('firstName lastName title credentials specialty specialization profilePicture description languages gender lgbtqAffirming availability')
      .sort({ createdAt: -1 });
    
    console.log(`FALLBACK: Found ${doctors.length} approved doctors in default database`);
    
    // Return results
    return res.status(200).json({
      success: true,
      data: doctors,
      source: 'DEFAULT DATABASE',
      tenantId: 'default'
    });
  } catch (error) {
    console.error('Error fetching doctors:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch doctors',
      error: error.message
    });
  }
};
/**
 * Get detailed doctor profile
 * @public - Accessible by authenticated patients
 */
exports.getDoctorProfile = async (req, res) => {
  try {
    const { doctorId } = req.params;
    
    const doctor = await User.findOne({
      _id: doctorId,
      role: 'doctor'
    }).select('firstName lastName title credentials specialty profilePicture description languages gender lgbtqAffirming availability education experience ratings');
    
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: doctor
    });
  } catch (error) {
    console.error('Error fetching doctor profile:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch doctor profile',
      error: error.message
    });
  }
};

/**
 * Schedule appointment with doctor
 * @public - Accessible by authenticated patients
 */
exports.scheduleAppointment = async (req, res) => {
  try {
    const { doctorId, date, time, type, notes } = req.body;
    const patientId = req.user._id; // From auth middleware
    
    // Validate date and time
    const appointmentDate = new Date(`${date}T${time}`);
    if (appointmentDate <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Appointment must be scheduled for a future date and time'
      });
    }
    
    // Check if doctor exists
    const doctor = await User.findOne({ _id: doctorId, role: 'doctor' });
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }
    
    // Check doctor availability (implement based on your availability model)
    // This would check the doctor's schedule to make sure the time slot is available
    // You'd need to implement this based on your system's requirements
    
    // Create new appointment
    const appointment = new Appointment({
      doctor: doctorId,
      patient: patientId,
      date: appointmentDate,
      type,
      notes,
      status: 'pending' // Pending confirmation from doctor
    });
    
    await appointment.save();
    
    // Check if patient-doctor relationship exists, create if not
    const existingAssociation = await PatientDoctorAssociation.findOne({
      patient: patientId,
      doctor: doctorId
    });
    
    if (!existingAssociation) {
      const association = new PatientDoctorAssociation({
        patient: patientId,
        doctor: doctorId,
        status: 'active'
      });
      
      await association.save();
    }
    
    return res.status(201).json({
      success: true,
      message: 'Appointment scheduled successfully',
      data: appointment
    });
  } catch (error) {
    console.error('Error scheduling appointment:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to schedule appointment',
      error: error.message
    });
  }
};

/**
 * Connect patient with doctor (establish relationship)
 * @public - Accessible by authenticated patients
 */
exports.connectWithDoctor = async (req, res) => {
  try {
    console.log('connectWithDoctor called with body:', req.body);
    
    const { doctorId } = req.body;
    
    if (!doctorId) {
      console.log('Missing doctorId in request body');
      return res.status(400).json({
        success: false,
        message: 'Doctor ID is required'
      });
    }
    
    const patientId = req.user._id; // From auth middleware
    
    console.log(`Connecting patient ${patientId} with doctor ${doctorId}`);
    
    // Check if doctor exists
    const doctor = await User.findOne({ _id: doctorId, role: 'doctor' });
    if (!doctor) {
      console.log(`Doctor with ID ${doctorId} not found`);
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }
    
    // Check if relationship already exists
    const existingAssociation = await PatientDoctorAssociation.findOne({
      patient: patientId,
      doctor: doctorId
    });
    
    let result;
    
    if (existingAssociation) {
      // If the relationship exists but is inactive, reactivate it
      if (existingAssociation.status !== 'active') {
        existingAssociation.status = 'active';
        result = await existingAssociation.save();
        
        console.log('Reactivated existing association:', result);
        
        return res.status(200).json({
          success: true,
          message: 'Connection with doctor reactivated',
          data: result
        });
      }
      
      console.log('Association already exists and is active');
      
      return res.status(200).json({
        success: true,
        message: 'Already connected with this doctor',
        data: existingAssociation
      });
    }
    
    // Create new relationship
    const association = new PatientDoctorAssociation({
      patient: patientId,
      doctor: doctorId,
      status: 'active'
    });
    
    result = await association.save();
    
    console.log('Created new association:', result);
    
    return res.status(201).json({
      success: true,
      message: 'Connected with doctor successfully',
      data: result
    });
  } catch (error) {
    console.error('Error connecting with doctor:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to connect with doctor',
      error: error.message
    });
  }
};

// ===== DOCTOR METHODS =====

// Get all patients associated with the doctor
exports.getPatients = async (req, res) => {
  try {
    console.log('🔍 getPatients called - Multi-tenant check');
    console.log('🔍 Tenant context:', {
      tenantId: req.tenantId || 'None',
      tenantDbName: req.tenantDbName || 'None',
      tenantConnection: !!req.tenantConnection,
      hasGetModel: typeof req.getModel === 'function'
    });
    
    // 🔧 FIX: Use tenant-specific User model
    let UserModel;
    
    // PRIORITY 1: Use tenant connection if available
    if (req.tenantConnection) {
      try {
        UserModel = req.tenantConnection.model('User');
        console.log('✅ Using User model from tenant connection:', req.tenantDbName);
      } catch (err) {
        console.error('❌ Error getting User model from tenant connection:', err);
        UserModel = require('../models/User');
        console.log('🔄 Falling back to global User model');
      }
    } else if (req.getModel) {
      // PRIORITY 2: Use req.getModel if available
      UserModel = req.getModel('User');
      console.log('✅ Using User model from req.getModel');
    } else {
      // FALLBACK: Use global User model
      UserModel = require('../models/User');
      console.log('🔄 Using global User model (no tenant connection)');
    }
    
    // 🔧 FIX: Query patients with ALL onboarding fields
    const patients = await UserModel.find({ role: 'patient' })
      .select('firstName lastName email _id age gender middleName nickname birthdate location clinicLocation diagnosis occupation emergencyName profilePicture onboardingCompleted createdAt')
      .sort({ createdAt: -1 });
    
    console.log(`✅ Found ${patients.length} patients in ${req.tenantDbName || 'default'} database`);
    
    // 🔍 Debug: Log patient data to see what fields are available
    if (patients.length > 0) {
      console.log('🔍 Sample patient data:', {
        id: patients[0]._id,
        name: `${patients[0].firstName} ${patients[0].lastName}`,
        age: patients[0].age,
        gender: patients[0].gender,
        hasOnboardingData: !!patients[0].age || !!patients[0].gender,
        onboardingCompleted: patients[0].onboardingCompleted,
        allFields: Object.keys(patients[0].toObject())
      });
    }
    
    return res.status(200).json({
      success: true,
      patients: patients,
      debug: {
        database: req.tenantDbName || 'default',
        tenantId: req.tenantId || 'none',
        totalFound: patients.length
      }
    });
  } catch (error) {
    console.error('❌ Error fetching patients:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching patients',
      error: error.message
    });
  }
};  

// Get a specific patient's details
exports.getPatient = async (req, res) => {
  try {
    const { id } = req.params;
    const requestingUser = req.user;
    
    console.log(`🔍 getPatient called - Patient ID: ${id}, Requesting User: ${requestingUser.id || requestingUser._id}, Role: ${requestingUser.role}`);
    
    // Validate patient ID
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID is required'
      });
    }
    
    // CRITICAL: Import mongoose for ObjectId handling
    const mongoose = require('mongoose');
    
    // CRITICAL: Validate and convert patient ID to ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log(`❌ Invalid ObjectId format: ${id}`);
      return res.status(400).json({
        success: false,
        message: 'Invalid patient ID format'
      });
    }
    
    // Convert to ObjectId for reliable querying
    const patientObjectId = new mongoose.Types.ObjectId(id);
    console.log(`🔍 Converted to ObjectId: ${patientObjectId}`);
    
    // Get the requesting user's ID (handle both _id and id)
    const requestingUserId = requestingUser.id || requestingUser._id;
    
    // Debug tenant information
    console.log('🔍 TENANT INFO:', {
      tenantId: req.tenantId || 'None',
      tenantDbName: req.tenantDbName || 'None', 
      tenantConnection: !!req.tenantConnection,
      hasGetModel: typeof req.getModel === 'function'
    });
    
    let patient = null;
    
    // PRIORITY 1: Try direct database collection access (most reliable for tenant DBs)
    if (req.tenantConnection && req.tenantConnection.db) {
      try {
        console.log('🔍 PRIORITY METHOD: Direct tenant database collection access');
        const usersCollection = req.tenantConnection.db.collection('users');
        
        // Query with ObjectId directly
        patient = await usersCollection.findOne({
          _id: patientObjectId,
          role: 'patient'
        });
        
        if (patient) {
          console.log('✅ PRIORITY METHOD SUCCESS: Found patient via direct collection access');
          console.log('🔍 Patient data keys:', Object.keys(patient));
        } else {
          console.log('❌ PRIORITY METHOD: Patient not found via direct collection access');
          
          // Debug: Check if patient exists without role filter
          const anyUser = await usersCollection.findOne({ _id: patientObjectId });
          if (anyUser) {
            console.log('🔍 User exists but role is:', anyUser.role);
          } else {
            console.log('🔍 User does not exist at all with this ID');
            
            // Debug: Check what users exist in the collection
            const sampleUsers = await usersCollection.find({}).limit(5).toArray();
            console.log('🔍 Sample users in collection:');
            sampleUsers.forEach((user, i) => {
              console.log(`User ${i+1}: ID=${user._id}, role=${user.role}, name=${user.firstName} ${user.lastName}`);
            });
          }
        }
      } catch (directError) {
        console.error('❌ PRIORITY METHOD failed:', directError.message);
      }
    }
    
    // FALLBACK 1: Try tenant User model if direct access failed
    if (!patient && req.tenantConnection) {
      try {
        console.log('🔍 FALLBACK 1: Tenant User model');
        const UserModel = req.tenantConnection.model('User');
        
        patient = await UserModel.findOne({
          _id: patientObjectId,
          role: 'patient'
        }).lean();
        
        if (patient) {
          console.log('✅ FALLBACK 1 SUCCESS: Found patient via tenant User model');
        } else {
          console.log('❌ FALLBACK 1: Patient not found via tenant User model');
        }
      } catch (tenantModelError) {
        console.error('❌ FALLBACK 1 failed:', tenantModelError.message);
      }
    }
    
    // FALLBACK 2: Try req.getModel if available
    if (!patient && req.getModel) {
      try {
        console.log('🔍 FALLBACK 2: req.getModel User');
        const UserModel = req.getModel('User');
        
        patient = await UserModel.findOne({
          _id: patientObjectId,
          role: 'patient'
        }).lean();
        
        if (patient) {
          console.log('✅ FALLBACK 2 SUCCESS: Found patient via req.getModel');
        } else {
          console.log('❌ FALLBACK 2: Patient not found via req.getModel');
        }
      } catch (getModelError) {
        console.error('❌ FALLBACK 2 failed:', getModelError.message);
      }
    }
    
    // FALLBACK 3: Try global User model as last resort
    if (!patient) {
      try {
        console.log('🔍 FALLBACK 3: Global User model (last resort)');
        const User = require('../models/User');
        
        patient = await User.findOne({
          _id: patientObjectId,
          role: 'patient'
        }).lean();
        
        if (patient) {
          console.log('✅ FALLBACK 3 SUCCESS: Found patient via global User model');
        } else {
          console.log('❌ FALLBACK 3: Patient not found via global User model');
        }
      } catch (globalModelError) {
        console.error('❌ FALLBACK 3 failed:', globalModelError.message);
      }
    }
    
    // Check if patient exists
    if (!patient) {
      console.log(`❌ Patient ${id} not found with any method`);
      
      // Additional debug: Try to find ANY user with this ID (regardless of role)
      if (req.tenantConnection && req.tenantConnection.db) {
        try {
          const usersCollection = req.tenantConnection.db.collection('users');
          const anyUserWithId = await usersCollection.findOne({ _id: patientObjectId });
          
          if (anyUserWithId) {
            console.log('🔍 DEBUG: Found user with this ID but wrong role:', {
              id: anyUserWithId._id,
              role: anyUserWithId.role,
              name: `${anyUserWithId.firstName} ${anyUserWithId.lastName}`,
              email: anyUserWithId.email
            });
          }
        } catch (debugError) {
          console.error('Debug query failed:', debugError.message);
        }
      }
      
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }
    
    // 🔧 ACCESS CONTROL: Check if user can access this patient data
    console.log('🔧 Checking access control...');
    console.log('🔧 Requesting user role:', requestingUser.role);
    console.log('🔧 Requesting user ID:', requestingUserId);
    console.log('🔧 Patient ID:', patient._id);
    
    if (requestingUser.role === 'patient') {
      // Patients can only access their own data
      const patientIdString = patient._id.toString();
      const requestingUserIdString = requestingUserId.toString();
      
      console.log('🔧 Patient access check:', {
        patientId: patientIdString,
        requestingUserId: requestingUserIdString,
        match: patientIdString === requestingUserIdString
      });
      
      if (patientIdString !== requestingUserIdString) {
        console.log('❌ Access denied: Patient trying to access another patient\'s data');
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only view your own profile.'
        });
      }
      
      console.log('✅ Patient access granted: User accessing own data');
      
    } else if (requestingUser.role === 'doctor') {
      // Doctors can access any patient data (they're verified medical professionals)
      console.log('✅ Doctor access granted: Medical professional accessing patient data');
      
    } else {
      // Other roles are not allowed
      console.log('❌ Access denied: Invalid role:', requestingUser.role);
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }
    
    // Remove sensitive data before sending response
    const sanitizedPatient = {
      ...patient,
      password: undefined,
      passwordResetToken: undefined,
      emailVerificationToken: undefined,
      refreshToken: undefined,
      resetPasswordToken: undefined,
      resetPasswordExpires: undefined
    };
    
    console.log(`✅ Patient ${id} data retrieved successfully`);
    console.log('🔍 Final patient data keys:', Object.keys(sanitizedPatient));
    console.log('🔍 Final onboarding fields check:', {
      age: sanitizedPatient.age,
      gender: sanitizedPatient.gender,
      location: sanitizedPatient.location,
      middleName: sanitizedPatient.middleName,
      nickname: sanitizedPatient.nickname,
      birthdate: sanitizedPatient.birthdate,
      clinicLocation: sanitizedPatient.clinicLocation
    });
    
    return res.status(200).json({
      success: true,
      data: sanitizedPatient,
      debug: {
        accessGrantedTo: requestingUser.role,
        requestingUserId: requestingUserId,
        method: 'direct_collection_access',
        tenantInfo: {
          tenantId: req.tenantId || 'None',
          tenantDbName: req.tenantDbName || 'None'
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching patient details:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching patient details',
      error: error.message
    });
  }
};

// Get patient's journal entries - with doctor restriction
exports.getPatientJournals = async (req, res) => {
  try {
    const doctorId = req.user._id;
    const patientId = req.params.id;
    const { limit = 10, page = 1, startDate, endDate } = req.query;
    
    // Check if the doctor is associated with this patient
    const association = await PatientDoctorAssociation.findOne({
      doctor: doctorId,
      patient: patientId,
      status: 'active'
    });
    
    if (!association) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found or not associated with this doctor'
      });
    }
    
    // Build query - only show entries shared with this specific doctor
    const query = { 
      user: patientId,
      isSharedWithDoctor: true,
      // NEW: Only return journal entries that have this doctor as the assigned doctor
      // OR entries that have no specific doctor assigned (for backward compatibility)
      $or: [
        { assignedDoctor: doctorId },
        { assignedDoctor: null }
      ]
    };
    
    // Add date range if provided
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get entries
    const entries = await JournalEntry.find(query)
      .sort({ createdAt: -1 }) // Most recent first
      .skip(skip)
      .limit(parseInt(limit))
      .populate({
        path: 'template',
        select: 'name description fields'
      });
    
    // Get total count for pagination
    const total = await JournalEntry.countDocuments(query);
    
    return res.status(200).json({
      success: true,
      data: entries,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching patient journals:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching patient journals',
      error: error.message
    });
  }
};

// Get a specific journal entry
exports.getJournalEntry = async (req, res) => {
  try {
    const doctorId = req.user._id;
    const entryId = req.params.id;
    
    // Get the entry
    const entry = await JournalEntry.findById(entryId)
      .populate({
        path: 'user',
        select: 'firstName lastName email'
      })
      .populate({
        path: 'template',
        select: 'name description fields'
      });
    
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Journal entry not found'
      });
    }
    
    // Check if this doctor is associated with the patient
    const association = await PatientDoctorAssociation.findOne({
      doctor: doctorId,
      patient: entry.user._id,
      status: 'active'
    });
    
    if (!association) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this journal entry'
      });
    }
    
    // Check if entry is shared with doctor
    if (!entry.isSharedWithDoctor) {
      return res.status(403).json({
        success: false,
        message: 'This journal entry is not shared with the doctor'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: entry
    });
  } catch (error) {
    console.error('Error fetching journal entry:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching journal entry',
      error: error.message
    });
  }
};

/**
 * Analyze a journal entry
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.analyzeJournalEntry = async (req, res) => {
  const entryId = req.params.id;
  const { useAI, sentiment, emotions, notes, flags, applyChanges = true } = req.body;
  
  try {
    // 1. Find the journal entry
    const entry = await JournalEntry.findById(entryId);
    if (!entry) {
      return res.status(404).json({ message: 'Journal entry not found' });
    }
    
    // 2. Check if doctor has permission to analyze this entry
    // This finds if the doctor is associated with the patient who created the entry
    const association = await PatientDoctorAssociation.findOne({
      doctor: req.user.id,
      patient: entry.user
    });
    
    if (!association) {
      return res.status(403).json({ message: 'Not authorized to analyze this journal entry' });
    }
    
    // 3. Prepare the analysis object
    let analysis = {
      sentiment: null,
      emotions: [],
      notes: notes || '',
      flags: flags || [],
      isAnalyzed: true,
      analyzedBy: req.user.id,
      analyzedAt: new Date()
    };
    
    // 4. Run AI analysis if requested
    let aiAnalysis = null;
    if (useAI) {
      try {
        // Extract text content for analysis
        const textContent = extractTextFromEntry(entry);
        
        // Call the NLP service
        aiAnalysis = await nlpService.analyzeJournalEntry(textContent);
        
        // If no manual inputs provided, use AI results
        if (applyChanges && !sentiment && (!emotions || emotions.length === 0)) {
          analysis.sentiment = aiAnalysis.sentiment;
          analysis.emotions = aiAnalysis.emotions || [];
          
          // Add any flags detected by AI
          if (aiAnalysis.flags && aiAnalysis.flags.length > 0) {
            analysis.flags = [...new Set([...analysis.flags, ...aiAnalysis.flags])];
          }
        }
      } catch (error) {
        console.error('Error in AI analysis:', error);
        // Continue with manual analysis even if AI fails
      }
    }
    
    // 5. Apply manual inputs if provided
    if (sentiment) {
      analysis.sentiment = { type: sentiment };
    }
    
    if (emotions && emotions.length > 0) {
      analysis.emotions = Array.isArray(emotions) 
        ? emotions.map(e => (typeof e === 'string' ? { name: e } : e))
        : [];
    }
    
    // 6. Save the analysis to the database if requested
    if (applyChanges) {
      entry.sentimentAnalysis = analysis;
      entry.doctorNotes = notes || entry.doctorNotes;
      entry.flags = flags || entry.flags;
      await entry.save();
    }
    
    // 7. Return the results
    return res.status(200).json({
      message: 'Analysis completed successfully',
      entryId: entry._id,
      analysis: analysis,
      aiAnalysis: aiAnalysis
    });
  } catch (error) {
    console.error('Error analyzing journal entry:', error);
    return res.status(500).json({ message: 'Failed to analyze journal entry', error: error.message });
  }
};

// Add a note to a journal entry
exports.addNoteToJournalEntry = async (req, res) => {
  try {
    const doctorId = req.user._id;
    const entryId = req.params.id;
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Note content is required'
      });
    }
    
    // Get the entry
    const entry = await JournalEntry.findById(entryId)
      .populate({
        path: 'user',
        select: 'firstName lastName email'
      });
    
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Journal entry not found'
      });
    }
    
    // Check if this doctor is associated with the patient
    const association = await PatientDoctorAssociation.findOne({
      doctor: doctorId,
      patient: entry.user._id,
      status: 'active'
    });
    
    if (!association) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to add notes to this journal entry'
      });
    }
    
    // Add the note
    entry.doctorNotes.push({
      content,
      createdBy: doctorId
    });
    
    await entry.save();
    
    return res.status(200).json({
      success: true,
      data: entry.doctorNotes[entry.doctorNotes.length - 1]
    });
  } catch (error) {
    console.error('Error adding note to journal entry:', error);
    return res.status(500).json({
      success: false,
      message: 'Error adding note to journal entry',
      error: error.message
    });
  }
};

// Create a new form template
exports.createTemplate = async (req, res) => {
  try {
    console.log('Creating template with data:', req.body);
    console.log('Tenant context details:', {
      tenant: req.tenant ? req.tenant.name : 'None',
      tenantId: req.tenantId || 'None',
      tenantDbName: req.tenantDbName || 'None',
      hasConnection: !!req.tenantConnection,
      hasGetModel: typeof req.getModel === 'function'
    });
    
    // Get doctorId from the authenticated user - handle both possible locations
    let doctorId = req.user && (req.user._id || req.user.id);
    
    console.log('User ID from authentication:', doctorId);
    
    // If doctorId is still undefined, extract it from the token directly
    if (!doctorId) {
      console.log('Attempting to extract user ID from authorization header');
      
      // Get token from the Authorization header
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          // Extract and verify the token
          const token = authHeader.split(' ')[1];
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          
          // Get the user ID from the decoded token
          doctorId = decoded.id || decoded._id;
          console.log('Extracted user ID from token:', doctorId);
        } catch (tokenError) {
          console.error('Error extracting user ID from token:', tokenError);
        }
      }
    }
    
    // Check for user ID in request body as a last resort
    if (!doctorId && req.body.createdBy) {
      doctorId = req.body.createdBy;
      console.log('Using createdBy from request body:', doctorId);
    }
    
    // If we still don't have a doctorId, return an appropriate error
    if (!doctorId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. User ID could not be determined.'
      });
    }
    
    // Extract template data from request body
    const { name, description, fields, isDefault } = req.body;
    
    // IMPORTANT FIX: Get the appropriate FormTemplate model for the current tenant
    let FormTemplate;
    
    // Use tenant-specific model if available
    if (req.tenantConnection) {
      try {
        FormTemplate = req.tenantConnection.model('FormTemplate');
        console.log('Using FormTemplate model from tenant connection:', req.tenantDbName);
      } catch (err) {
        console.error('Error getting FormTemplate model from tenant connection:', err);
        // Fall back to global model
        FormTemplate = require('../models/FormTemplate');
        console.log('Falling back to global FormTemplate model');
      }
    } else if (req.getModel) {
      // If req.getModel is available (set by tenantMiddleware), use that
      FormTemplate = req.getModel('FormTemplate');
      console.log('Using FormTemplate model from req.getModel');
    } else {
      // Use the global model if no tenant connection
      FormTemplate = require('../models/FormTemplate');
      console.log('Using global FormTemplate model (no tenant connection)');
    }
    
    // IMPORTANT FIX: Create the template with tenantId included
    const templateData = {
      name,
      description,
      fields: fields || [],
      createdBy: doctorId,
      isDefault: isDefault || false
    };
    
    // Add tenantId if available - CRITICAL FIX!
    if (req.tenantId) {
      templateData.tenantId = req.tenantId;
      console.log('Added tenantId to template data:', req.tenantId);
    }
    
    const template = new FormTemplate(templateData);
    
    console.log('Template object before save:', template);
    console.log('Template Model:', template.constructor.modelName);
    console.log('Template DB:', template.db ? template.db.name : 'Unknown');
    
    // Save the template
    const savedTemplate = await template.save();
    console.log('Template saved successfully:', {
      id: savedTemplate._id,
      name: savedTemplate.name,
      createdBy: savedTemplate.createdBy,
      tenantId: savedTemplate.tenantId
    });
    
    // Verify the template was saved
    try {
      const count = await FormTemplate.countDocuments();
      console.log(`Total templates in database after save: ${count}`);
      
      const verifyTemplate = await FormTemplate.findById(savedTemplate._id);
      console.log('Template verification:', verifyTemplate ? 'Found' : 'Not found');
    } catch (verifyError) {
      console.error('Error verifying template was saved:', verifyError);
    }
    
    return res.status(201).json({
      success: true,
      data: savedTemplate,
      tenant: req.tenantDbName || 'None'
    });
  } catch (error) {
    console.error('Error creating template:', error);
    
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

// Get all templates for a doctor
exports.getTemplates = async (req, res) => {
  try {
    console.log('Getting templates for doctor');
    console.log('Tenant context:', {
      tenantConnection: !!req.tenantConnection,
      tenantDbName: req.tenantDbName || 'unknown',
      tenantId: req.tenantId || 'unknown'
    });
    
    // Get doctorId from the authenticated user - handle both possible locations
    let doctorId = req.user && (req.user._id || req.user.id);
    
    console.log('User ID from authentication:', doctorId);
    
    // Get the appropriate FormTemplate model for the current tenant
    let FormTemplate;
    
    // Use tenant-specific model if available
    if (req.tenantConnection) {
      try {
        FormTemplate = req.tenantConnection.model('FormTemplate');
        console.log('Using FormTemplate model from tenant connection:', req.tenantDbName);
      } catch (err) {
        console.error('Error getting FormTemplate model from tenant connection:', err);
        // Fall back to global model
        FormTemplate = require('../models/FormTemplate');
        console.log('Falling back to global FormTemplate model');
      }
    } else if (req.getModel) {
      // If req.getModel is available (set by tenantMiddleware), use that
      FormTemplate = req.getModel('FormTemplate');
      console.log('Using FormTemplate model from req.getModel');
    } else {
      // Use the global model if no tenant connection
      FormTemplate = require('../models/FormTemplate');
      console.log('Using global FormTemplate model (no tenant connection)');
    }
    
    // Build query for templates
    const query = { createdBy: doctorId };
    
    // Add tenantId to query if available
    if (req.tenantId) {
      query.tenantId = req.tenantId;
      console.log('Added tenantId to query:', req.tenantId);
    }
    
    // Run debug query to see what's in the database
    console.log('DEBUG: Checking all templates in the database');
    const allTemplates = await FormTemplate.find().lean();
    console.log(`Found ${allTemplates.length} total templates in database`);
    
    // If there are templates, log their createdBy values to compare
    if (allTemplates.length > 0) {
      console.log('All templates in database:');
      allTemplates.forEach((template, index) => {
        console.log(`Template ${index + 1}: name="${template.name}", createdBy=${template.createdBy}, tenantId=${template.tenantId || 'None'}`);
      });
    }
    
    // Get templates for this doctor with tenantId
    console.log('Executing query with:', query);
    const templates = await FormTemplate.find(query).sort({ createdAt: -1 });
    
    console.log(`Found ${templates.length} templates for doctor ID ${doctorId} in database ${req.tenantDbName || 'unknown'}`);
    
    // Enhanced logging about the tenant context
    const tenantInfo = {
      tenantId: req.tenantId || 'unknown',
      tenantDbName: req.tenantDbName || 'unknown',
      modelSource: req.tenantConnection ? 'tenant connection' : (req.getModel ? 'req.getModel' : 'global model'),
      templatesFound: templates.length
    };
    console.log('Tenant context details:', tenantInfo);
    
    return res.status(200).json({
      success: true,
      templates,
      tenantContext: tenantInfo // Include this for debugging
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching templates',
      error: error.message
    });
  }
};

// Get a specific template
exports.getTemplate = async (req, res) => {
  try {
    console.log('Getting single template with ID:', req.params.id);
    console.log('Tenant context:', {
      tenantConnection: !!req.tenantConnection,
      tenantDbName: req.tenantDbName || 'unknown',
      tenantId: req.tenantId || 'unknown'
    });
    
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Template ID is required'
      });
    }
    
    // Get doctorId from the authenticated user
    let doctorId = req.user && (req.user._id || req.user.id);
    console.log('User ID from authentication:', doctorId);
    
    // Get the appropriate FormTemplate model for the current tenant
    let FormTemplate;
    
    // Use tenant-specific model if available
    if (req.tenantConnection) {
      try {
        FormTemplate = req.tenantConnection.model('FormTemplate');
        console.log('Using FormTemplate model from tenant connection:', req.tenantDbName);
      } catch (err) {
        console.error('Error getting FormTemplate model from tenant connection:', err);
        FormTemplate = require('../models/FormTemplate');
        console.log('Falling back to global FormTemplate model');
      }
    } else if (req.getModel) {
      FormTemplate = req.getModel('FormTemplate');
      console.log('Using FormTemplate model from req.getModel');
    } else {
      FormTemplate = require('../models/FormTemplate');
      console.log('Using global FormTemplate model (no tenant connection)');
    }
    
    // Build query for the specific template
    const query = { _id: id };
    
    // Add tenantId to query if available (IMPORTANT)
    if (req.tenantId) {
      query.tenantId = req.tenantId;
      console.log('Added tenantId to query:', req.tenantId);
    }
    
    // For improved security, you would normally also filter by createdBy
    // But for debugging purposes, we'll temporarily remove this constraint
    // to see if the template exists at all
    console.log('Looking for template with query:', query);
    
    // First try to find without createdBy constraint to debug
    const anyTemplate = await FormTemplate.findOne({ _id: id }).lean();
    if (anyTemplate) {
      console.log('Found template in database WITHOUT createdBy constraint:');
      console.log({
        id: anyTemplate._id,
        name: anyTemplate.name,
        createdBy: anyTemplate.createdBy,
        tenantId: anyTemplate.tenantId || 'None'
      });
      
      // If the template exists but with a different createdBy, log this info
      if (anyTemplate.createdBy && anyTemplate.createdBy.toString() !== doctorId.toString()) {
        console.log('Template belongs to a different user!');
        console.log('Template createdBy:', anyTemplate.createdBy);
        console.log('Current user ID:', doctorId);
      }
    } else {
      console.log('NO template found with ID:', id);
      
      // Check all templates to see if there's any in the database
      const allTemplates = await FormTemplate.find().lean();
      console.log(`Found ${allTemplates.length} total templates in database`);
      
      if (allTemplates.length > 0) {
        console.log('Available templates:');
        allTemplates.forEach((template, index) => {
          console.log(`Template ${index + 1}: ID=${template._id}, name="${template.name}", createdBy=${template.createdBy}, tenantId=${template.tenantId || 'None'}`);
        });
      }
    }
    
    // Now try the actual query with all constraints
    const template = await FormTemplate.findOne(query);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found',
        context: {
          templateId: id,
          tenantId: req.tenantId || 'None',
          doctorId: doctorId
        }
      });
    }
    
    console.log('Template found successfully:', {
      id: template._id,
      name: template.name,
      createdBy: template.createdBy,
      tenantId: template.tenantId || 'None'
    });
    
    return res.status(200).json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching template',
      error: error.message
    });
  }
};

// Assign a template to patients
exports.assignTemplate = async (req, res) => {
  try {
    const doctorId = req.user._id;
    const templateId = req.params.id;
    const { patientIds } = req.body;
    
    if (!patientIds || !Array.isArray(patientIds) || patientIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Patient IDs array is required'
      });
    }
    
    // Verify template exists and belongs to doctor
    const template = await FormTemplate.findOne({
      _id: templateId,
      createdBy: doctorId
    });
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }
    
    // Get all active associations for this doctor with the specified patients
    const associations = await PatientDoctorAssociation.find({
      doctor: doctorId,
      patient: { $in: patientIds },
      status: 'active'
    });
    
    // Create a map for quick lookups
    const associationMap = new Map();
    associations.forEach(assoc => {
      associationMap.set(assoc.patient.toString(), assoc);
    });
    
    // Process each patient
    const results = {
      success: [],
      failed: []
    };
    
    for (const patientId of patientIds) {
      try {
        const association = associationMap.get(patientId);
        
        if (!association) {
          // Check if patient exists
          const patientExists = await User.exists({
            _id: patientId,
            role: 'patient'
          });
          
          if (!patientExists) {
            results.failed.push({
              patientId,
              message: 'Patient not found'
            });
            continue;
          }
          
          // Create new association
          const newAssociation = new PatientDoctorAssociation({
            doctor: doctorId,
            patient: patientId,
            status: 'active',
            assignedTemplates: [{
              template: templateId,
              assignedDate: new Date(),
              active: true
            }]
          });
          
          await newAssociation.save();
          results.success.push(patientId);
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
          
          await association.save();
          results.success.push(patientId);
        }
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
    console.error('Error assigning template:', error);
    return res.status(500).json({
      success: false,
      message: 'Error assigning template',
      error: error.message
    });
  }
};

// Get all journal entries for doctor's patients
exports.getJournalEntries = async (req, res) => {
  try {
    console.log("Fetching journal entries with query params:", req.query);
    
    // Add this to check if user exists
    if (!req.user || !req.user._id) {
      console.log("No authenticated user found");
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const doctorId = req.user._id;
    console.log("Doctor ID:", doctorId);
    
    const { limit = 10, page = 1, patientId, startDate, endDate } = req.query;
    
    // Get all active patient associations
    const patientAssociations = await PatientDoctorAssociation.find({
      doctor: doctorId,
      status: 'active'
    });
    
    console.log(`Found ${patientAssociations.length} patient associations`);
    
    const patientIds = patientAssociations.map(assoc => assoc.patient);
    
    // Build query with explicit debug logging
    const query = {
      user: patientId ? patientId : { $in: patientIds },
      isSharedWithDoctor: true
    };
    
    // Add the $or condition for assignedDoctor but handle possible undefined values
    query.$or = [
      { assignedDoctor: doctorId },
      { assignedDoctor: null },
      { assignedDoctor: { $exists: false } }  // To handle documents without this field
    ];
    
    console.log("Query built:", JSON.stringify(query));
    
    // Add date range if provided
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get entries
    console.log("Executing Journal.find with query");
    const entries = await JournalEntry.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate({
        path: 'user',
        select: 'firstName lastName email profilePicture'
      })
      .populate({
        path: 'template',
        select: 'name description'
      });
    
    console.log(`Found ${entries.length} journal entries`);
    
    // Get total count for pagination
    const total = await JournalEntry.countDocuments(query);
    
    return res.status(200).json({
      success: true,
      data: entries,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching journal entries:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({
      success: false,
      message: 'Error fetching journal entries',
      error: error.message
    });
  }
};

// Get dashboard stats for the doctor
exports.getDashboardStats = async (req, res) => {
  try {
    const doctorId = req.user._id;
    
    // Get all active patient associations
    const patientAssociations = await PatientDoctorAssociation.find({
      doctor: doctorId,
      status: 'active'
    });
    
    const patientIds = patientAssociations.map(assoc => assoc.patient);

    // Get total patients count
    const totalPatients = patientIds.length;
    
    // Get journal entries from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentEntries = await JournalEntry.find({
      user: { $in: patientIds },
      isSharedWithDoctor: true,
      createdAt: { $gte: thirtyDaysAgo }
    });
    
    // Calculate sentiment distribution
    const sentimentCounts = {
      positive: 0,
      negative: 0,
      neutral: 0,
      unanalyzed: 0
    };
    
    recentEntries.forEach(entry => {
      if (entry.sentimentAnalysis && entry.sentimentAnalysis.sentiment) {
        const sentiment = entry.sentimentAnalysis.sentiment.type;
        if (sentiment in sentimentCounts) {
          sentimentCounts[sentiment]++;
        }
      } else {
        sentimentCounts.unanalyzed++;
      }
    });
    
    // Identify patients with concerning sentiment trends
    const patientSentiments = {};
    
    recentEntries.forEach(entry => {
      const patientId = entry.user.toString();
      
      if (!patientSentiments[patientId]) {
        patientSentiments[patientId] = {
          entries: 0,
          negativeDays: 0,
          lastEntry: null
        };
      }
      
      patientSentiments[patientId].entries++;
      
      if (entry.sentimentAnalysis && 
          entry.sentimentAnalysis.sentiment && 
          entry.sentimentAnalysis.sentiment.type === 'negative') {
        patientSentiments[patientId].negativeDays++;
      }
      
      // Track most recent entry
      if (!patientSentiments[patientId].lastEntry || 
          entry.createdAt > patientSentiments[patientId].lastEntry.createdAt) {
        patientSentiments[patientId].lastEntry = {
          createdAt: entry.createdAt,
          sentiment: entry.sentimentAnalysis?.sentiment?.type || 'unanalyzed'
        };
      }
    });
    
    // Identify concerning patients (>50% negative days)
    const concerningPatients = [];
    
    for (const [patientId, data] of Object.entries(patientSentiments)) {
      if (data.entries >= 3 && (data.negativeDays / data.entries) > 0.5) {
        // Get patient info
        const patient = await User.findById(patientId).select('firstName lastName email profilePicture');
        
        if (patient) {
          concerningPatients.push({
            patient,
            stats: {
              totalEntries: data.entries,
              negativeDays: data.negativeDays,
              negativePercentage: Math.round((data.negativeDays / data.entries) * 100),
              lastEntry: data.lastEntry
            }
          });
        }
      }
    }
    
    return res.status(200).json({
      success: true,
      data: {
        totalPatients,
        recentJournalEntries: recentEntries.length,
        sentimentDistribution: sentimentCounts,
        concerningPatients: concerningPatients.slice(0, 5) // Limit to top 5
      }
    });
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting dashboard stats',
      error: error.message
    });
  }
};

exports.updateTemplate = async (req, res) => {
  try {
    console.log('Updating template with ID:', req.params.id);
    console.log('Update data:', req.body);
    console.log('Tenant context:', {
      tenantConnection: !!req.tenantConnection,
      tenantDbName: req.tenantDbName || 'unknown',
      tenantId: req.tenantId || 'unknown'
    });
    
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Template ID is required'
      });
    }
    
    // Get doctorId from the authenticated user
    let doctorId = req.user && (req.user._id || req.user.id);
    console.log('User ID from authentication:', doctorId);
    
    // Extract updated template data from request body
    const { name, description, fields, isDefault } = req.body;
    
    // Get the appropriate FormTemplate model for the current tenant
    let FormTemplate;
    
    // Use tenant-specific model if available
    if (req.tenantConnection) {
      try {
        FormTemplate = req.tenantConnection.model('FormTemplate');
        console.log('Using FormTemplate model from tenant connection:', req.tenantDbName);
      } catch (err) {
        console.error('Error getting FormTemplate model from tenant connection:', err);
        FormTemplate = require('../models/FormTemplate');
        console.log('Falling back to global FormTemplate model');
      }
    } else if (req.getModel) {
      FormTemplate = req.getModel('FormTemplate');
      console.log('Using FormTemplate model from req.getModel');
    } else {
      FormTemplate = require('../models/FormTemplate');
      console.log('Using global FormTemplate model (no tenant connection)');
    }
    
    // Build query to find the template
    const query = { _id: id };
    
    // Add tenantId to query if available (IMPORTANT)
    if (req.tenantId) {
      query.tenantId = req.tenantId;
      console.log('Added tenantId to query:', req.tenantId);
    }
    
    // Find the template
    console.log('Looking for template with query:', query);
    const template = await FormTemplate.findOne(query);
    
    if (!template) {
      // Debug: try to find the template without tenantId constraint
      const anyTemplate = await FormTemplate.findById(id);
      if (anyTemplate) {
        console.log('Template exists but might be in a different tenant:');
        console.log({
          id: anyTemplate._id,
          name: anyTemplate.name,
          tenantId: anyTemplate.tenantId || 'None',
          ourTenantId: req.tenantId || 'None'
        });
      }
      
      return res.status(404).json({
        success: false,
        message: 'Template not found',
        debug: {
          id,
          tenantId: req.tenantId || 'None'
        }
      });
    }
    
    // Update template fields
    if (name) template.name = name;
    if (description !== undefined) template.description = description;
    if (fields) template.fields = fields;
    if (isDefault !== undefined) template.isDefault = isDefault;
    
    // Make sure tenantId is still set
    if (req.tenantId && (!template.tenantId || template.tenantId.toString() !== req.tenantId.toString())) {
      template.tenantId = req.tenantId;
      console.log('Updated tenantId on template');
    }
    
    // Save the updated template
    console.log('Saving updated template');
    await template.save();
    
    console.log('Template updated successfully');
    
    return res.status(200).json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Error updating template:', error);
    
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

// Delete a template
exports.deleteTemplate = async (req, res) => {
  try {
    console.log('Deleting template with ID:', req.params.id);
    console.log('Tenant context:', {
      tenantConnection: !!req.tenantConnection,
      tenantDbName: req.tenantDbName || 'unknown',
      tenantId: req.tenantId || 'unknown'
    });
    
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Template ID is required'
      });
    }
    
    // Get doctorId from the authenticated user
    let doctorId = req.user && (req.user._id || req.user.id);
    console.log('User ID from authentication:', doctorId);
    
    // Get the appropriate FormTemplate model for the current tenant
    let FormTemplate;
    
    // Use tenant-specific model if available
    if (req.tenantConnection) {
      try {
        FormTemplate = req.tenantConnection.model('FormTemplate');
        console.log('Using FormTemplate model from tenant connection:', req.tenantDbName);
      } catch (err) {
        console.error('Error getting FormTemplate model from tenant connection:', err);
        FormTemplate = require('../models/FormTemplate');
        console.log('Falling back to global FormTemplate model');
      }
    } else if (req.getModel) {
      FormTemplate = req.getModel('FormTemplate');
      console.log('Using FormTemplate model from req.getModel');
    } else {
      FormTemplate = require('../models/FormTemplate');
      console.log('Using global FormTemplate model (no tenant connection)');
    }
    
    // Build query to find the template
    const query = { _id: id };
    
    // Add tenantId to query if available (IMPORTANT)
    if (req.tenantId) {
      query.tenantId = req.tenantId;
      console.log('Added tenantId to query:', req.tenantId);
    }
    
    // Find and delete the template
    console.log('Looking for template to delete with query:', query);
    const template = await FormTemplate.findOneAndDelete(query);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found',
        debug: {
          id,
          tenantId: req.tenantId || 'None'
        }
      });
    }
    
    console.log('Template deleted successfully:', template._id);
    
    // Also remove this template from any patient-doctor associations
    const PatientDoctorAssociation = req.tenantConnection ? 
      req.tenantConnection.model('PatientDoctorAssociation') : 
      require('../models/PatientDoctorAssociation');
    
    try {
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
    console.error('Error deleting template:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting template',
      error: error.message
    });
  }
};

/**
 * Get doctor profile by ID - NEW FUNCTION FOR FLUTTER
 * @public - Accessible by authenticated patients
 * This is separate from the existing getDoctorProfile to avoid conflicts
 */
exports.getDoctorProfileById = async (req, res) => {
  try {
    console.log('🔍 getDoctorProfileById called with params:', req.params);
    console.log('🏢 Tenant context:', {
      tenantId: req.tenantId || 'None',
      tenantDbName: req.tenantDbName || 'None',
      tenantConnection: !!req.tenantConnection
    });
    
    const doctorId = req.params.id;
    
    if (!doctorId) {
      console.log('❌ No doctor ID provided');
      return res.status(400).json({
        success: false,
        message: 'Doctor ID is required'
      });
    }
    
    console.log('🔍 Looking for doctor with ID:', doctorId);
    
    // Use tenant-specific User model
    let UserModel;
    
    if (req.tenantConnection) {
      try {
        UserModel = req.tenantConnection.model('User');
        console.log('✅ Using User model from tenant connection:', req.tenantDbName);
      } catch (err) {
        console.error('❌ Error getting User model from tenant connection:', err);
        UserModel = require('../models/User');
        console.log('🔄 Falling back to global User model');
      }
    } else if (req.getModel) {
      UserModel = req.getModel('User');
      console.log('✅ Using User model from req.getModel');
    } else {
      UserModel = require('../models/User');
      console.log('🔄 Using global User model (no tenant connection)');
    }
    
    // Validate ObjectId format
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      console.log('❌ Invalid ObjectId format:', doctorId);
      return res.status(400).json({
        success: false,
        message: 'Invalid doctor ID format'
      });
    }
    
    // Query for approved doctor
    const doctor = await UserModel.findOne({
      _id: doctorId,
      role: 'doctor',
      verificationStatus: 'approved'
    }).select('firstName lastName title credentials specialty specialization profilePicture description languages gender lgbtqAffirming availability education experience ratings consultationFee bio yearsOfPractice clinicAddress emergencyAware telehealth inPerson')
    .lean();
    
    if (!doctor) {
      console.log('❌ Doctor not found with ID:', doctorId);
      
      // Debug: Check if doctor exists with different verification status
      const anyDoctor = await UserModel.findOne({
        _id: doctorId,
        role: 'doctor'
      }).select('_id firstName lastName verificationStatus').lean();
      
      if (anyDoctor) {
        console.log('🔍 Doctor exists but verification status is:', anyDoctor.verificationStatus);
        return res.status(404).json({
          success: false,
          message: 'Doctor not available (pending verification)',
          debug: {
            found: true,
            verificationStatus: anyDoctor.verificationStatus
          }
        });
      }
      
      return res.status(404).json({
        success: false,
        message: 'Doctor not found',
        debug: {
          found: false,
          doctorId: doctorId,
          tenantId: req.tenantId || 'None'
        }
      });
    }
    
    console.log('✅ Doctor found:', {
      id: doctor._id,
      name: `${doctor.firstName} ${doctor.lastName}`,
      specialty: doctor.specialty || doctor.specialization
    });
    
    return res.status(200).json({
      success: true,
      data: doctor
    });
    
  } catch (error) {
    console.error('❌ Error fetching doctor profile by ID:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch doctor profile',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Get current doctor's own profile
 * @authenticated - For logged-in doctors only
 */
exports.getCurrentDoctorProfile = async (req, res) => {
  try {
    console.log('🔍 getCurrentDoctorProfile called for user:', req.user.id || req.user._id);
    console.log('🏢 Tenant context:', {
      tenantId: req.tenantId || 'None',
      tenantDbName: req.tenantDbName || 'None',
      tenantConnection: !!req.tenantConnection
    });
    
    // Get the requesting user's ID (handle both _id and id)
    const doctorId = req.user.id || req.user._id;
    
    if (!doctorId) {
      console.log('❌ No user ID found in request');
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    // Use tenant-specific User model
    let UserModel;
    
    if (req.tenantConnection) {
      try {
        UserModel = req.tenantConnection.model('User');
        console.log('✅ Using User model from tenant connection:', req.tenantDbName);
      } catch (err) {
        console.error('❌ Error getting User model from tenant connection:', err);
        UserModel = require('../models/User');
        console.log('🔄 Falling back to global User model');
      }
    } else if (req.getModel) {
      UserModel = req.getModel('User');
      console.log('✅ Using User model from req.getModel');
    } else {
      UserModel = require('../models/User');
      console.log('🔄 Using global User model (no tenant connection)');
    }
    
    // Find the current doctor's profile
    const doctor = await UserModel.findById(doctorId)
      .select('firstName lastName email title specialty specialization profilePicture bio consultationFee yearsOfPractice clinicAddress languages emergencyAware telehealth inPerson verificationStatus')
      .lean();
    
    if (!doctor) {
      console.log('❌ Doctor profile not found for ID:', doctorId);
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found'
      });
    }
    
    // Check if this is actually a doctor
    if (doctor.role && doctor.role !== 'doctor') {
      console.log('❌ User is not a doctor, role:', doctor.role);
      return res.status(403).json({
        success: false,
        message: 'Access denied. Doctor role required.'
      });
    }
    
    console.log('✅ Doctor profile retrieved successfully:', {
      id: doctor._id,
      name: `${doctor.firstName} ${doctor.lastName}`,
      email: doctor.email
    });
    
    // Remove sensitive fields before sending
    const sanitizedProfile = {
      ...doctor,
      password: undefined,
      passwordResetToken: undefined,
      emailVerificationToken: undefined,
      refreshToken: undefined
    };
    
    return res.status(200).json({
      success: true,
      data: sanitizedProfile
    });
    
  } catch (error) {
    console.error('❌ Error getting current doctor profile:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting doctor profile',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Get doctor's payment methods for mobile app
 * This endpoint is used by the mobile payment modal to display doctor's payment options
 */
exports.getDoctorPaymentMethods = async (req, res) => {
  try {
    const doctorId = req.params.doctorId;
    
    console.log(`🏦 Getting payment methods for doctor: ${doctorId}`);
    
    // ✅ FIX: Use existing tenant connection from middleware instead of connecting again
    let UserModel;
    
    if (req.tenantConnection) {
      try {
        UserModel = req.tenantConnection.model('User');
        console.log('✅ Using User model from tenant connection');
      } catch (err) {
        console.error('❌ Error getting User model from tenant connection:', err);
        UserModel = require('../models/User');
        console.log('🔄 Falling back to global User model');
      }
    } else if (req.getModel) {
      UserModel = req.getModel('User');
      console.log('✅ Using User model from req.getModel');
    } else {
      UserModel = require('../models/User');
      console.log('🔄 Using global User model (no tenant connection)');
    }
    
    // Find doctor and get payment methods
    const doctor = await UserModel.findById(doctorId).select('paymentMethods firstName lastName');
    
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }
    
    // Extract payment methods
    const paymentMethods = doctor.paymentMethods || {
      gcash: { enabled: false, qrCode: null },
      paymaya: { enabled: false, qrCode: null },
      bankAccounts: []
    };
    
    console.log(`✅ Found payment methods for Dr. ${doctor.firstName} ${doctor.lastName}`);
    console.log(`🏦 GCash enabled: ${paymentMethods.gcash?.enabled}`);
    console.log(`🏦 PayMaya enabled: ${paymentMethods.paymaya?.enabled}`);
    console.log(`🏦 Bank accounts: ${paymentMethods.bankAccounts?.length || 0}`);
    
    res.json({
      success: true,
      data: {
        doctorId: doctor._id,
        doctorName: `${doctor.firstName} ${doctor.lastName}`,
        paymentMethods: paymentMethods
      },
      message: 'Payment methods retrieved successfully'
    });
    
  } catch (error) {
    console.error('❌ Error getting doctor payment methods:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get payment methods',
      error: error.message
    });
  }
};

