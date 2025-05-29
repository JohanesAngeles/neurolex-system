// server/src/controllers/doctorController.js - 


const User = require('../models/User');
const JournalEntry = require('../models/JournalEntry');
const FormTemplate = require('../models/FormTemplate');
const PatientDoctorAssociation = require('../models/PatientDoctorAssociation');
const Appointment = require('../models/Appointment'); 
const nlpService = require('../services/nlpService');
const jwt = require('jsonwebtoken');
const { uploadToS3 } = require('../utils/fileUpload');
const sendEmail = require('../utils/emailService');
const { connectToTenant } = require('../utils/dbManager');
const createUserSchema = require('../schemas/definitions/userSchema');


// ===== DOCTOR VERIFICATION METHODS =====


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
      firstName, lastName, email, password, role: 'doctor', accountStatus: 'active',
      title, specialty: specialization, licenseNumber, licenseIssuingAuthority, 
      licenseExpiryDate, licenseDocumentUrl, yearsOfPractice: parseInt(yearsOfExperience) || 0,
      clinicAddress: practiceAddress, bio, profilePicture: profilePhotoUrl,
      languages: Array.isArray(languages) ? languages : 
                (typeof languages === 'string' ? JSON.parse(languages || '[]') : []),
      emergencyAware: availableForEmergency === 'true' || availableForEmergency === true,
      telehealth: telehealth === 'true' || telehealth === true,
      inPerson: inPerson === 'true' || inPerson === true,
      consultationFee: parseFloat(consultationFee) || 0,
      termsAccepted: agreedToTerms === 'true' || agreedToTerms === true,
      isVerified: false, verificationStatus: 'pending', isActive: false, createdAt: Date.now()
    });
    
    console.log('Saving new doctor with data:', newDoctor);
    await newDoctor.save();
    
    res.status(201).json({
      success: true,
      message: 'Registration successful. Your account is pending verification.',
      data: { id: newDoctor._id, email: newDoctor.email, verificationStatus: newDoctor.verificationStatus }
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


exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const doctor = await User.findOne({ email, role: 'doctor' });
    if (!doctor) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    if (!doctor.isVerified || doctor.verificationStatus !== 'approved') {
      return res.status(403).json({
        success: false,
        message: `Your account is ${doctor.verificationStatus}. Please wait for admin verification or check your email.`,
        verificationStatus: doctor.verificationStatus
      });
    }
    
    const isMatch = await doctor.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    doctor.lastLogin = Date.now();
    await doctor.save();
    
    const token = jwt.sign({ id: doctor._id, role: doctor.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    
    res.status(200).json({
      success: true, message: 'Login successful', token,
      doctor: doctor.getPublicProfile ? doctor.getPublicProfile() : {
        _id: doctor._id, firstName: doctor.firstName, lastName: doctor.lastName,
        email: doctor.email, role: doctor.role, isVerified: doctor.isVerified
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


exports.getVerificationStatus = async (req, res) => {
  try {
    const doctorId = req.params.id || (req.user && req.user._id);
    
    if (!doctorId) {
      return res.status(400).json({ success: false, message: 'Doctor ID is required' });
    }
    
    const doctor = await User.findOne({ _id: doctorId, role: 'doctor' })
      .select('verificationStatus verificationNotes rejectionReason');
    
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
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


exports.getAvailableDoctors = async (req, res) => {
  try {
    console.log('GETAVAILABLEDOCTORS CALLED DIRECTLY');
    console.log('Query params:', req.query);
    
    const tenantId = req.query.tenantId;
    console.log('Tenant ID from query params:', tenantId || 'Not provided');
    
    if (tenantId) {
      try {
        const dbManager = require('../utils/dbManager');
        console.log(`Attempting direct connection to tenant: ${tenantId}`);
        
        const connection = await dbManager.connectTenant(tenantId);
        
        if (connection) {
          console.log(`Successfully connected to tenant database: ${tenantId}`);
          const User = connection.model('User');
          const query = { role: 'doctor', verificationStatus: 'approved' };
          
          const allDoctors = await User.find({ role: 'doctor' }).lean();
          console.log(`DIRECT: Found ${allDoctors.length} total doctors in tenant database`);
          
          const doctors = await User.find(query)
            .select('firstName lastName title credentials specialty specialization profilePicture description languages gender lgbtqAffirming availability')
            .sort({ createdAt: -1 })
            .lean();
          
          console.log(`DIRECT: Found ${doctors.length} approved doctors in tenant database`);
          
          return res.status(200).json({
            success: true, data: doctors, source: 'DIRECT TENANT CONNECTION', tenantId
          });
        }
      } catch (directError) {
        console.error('Error in direct tenant connection:', directError);
      }
    }
    
    console.log('FALLBACK: Using default database approach');
    const User = require('../models/User');
    const query = { role: 'doctor', verificationStatus: 'approved' };
    
    const doctors = await User.find(query)
      .select('firstName lastName title credentials specialty specialization profilePicture description languages gender lgbtqAffirming availability')
      .sort({ createdAt: -1 });
    
    console.log(`FALLBACK: Found ${doctors.length} approved doctors in default database`);
    
    return res.status(200).json({
      success: true, data: doctors, source: 'DEFAULT DATABASE', tenantId: 'default'
    });
  } catch (error) {
    console.error('Error fetching doctors:', error);
    return res.status(500).json({
      success: false, message: 'Failed to fetch doctors', error: error.message
    });
  }
};


// ===== NEW MISSING METHODS ADDED HERE =====


/**
 * Get list of doctors - MISSING METHOD that was causing 403 error
 * Accessible by authenticated patients to browse doctors
 */
exports.getDoctorList = async (req, res) => {
  try {
    console.log('📋 getDoctorList called - Patient can browse doctors');
    console.log('🔍 User role:', req.user?.role);
    console.log('🏢 Tenant context:', {
      tenantId: req.tenantId || 'None',
      tenantDbName: req.tenantDbName || 'None',
      tenantConnection: !!req.tenantConnection
    });
    
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
    
    // Build query for approved doctors
    const query = { 
      role: 'doctor', 
      verificationStatus: 'approved',
      isActive: { $ne: false } // Include doctors where isActive is true or undefined
    };
    
    console.log('🔍 Query for doctors:', query);
    
    // Get doctors with all necessary fields
    const doctors = await UserModel.find(query)
      .select('firstName lastName title specialty specialization profilePicture consultationFee bio yearsOfPractice clinicAddress languages emergencyAware telehealth inPerson availability education experience ratings')
      .sort({ createdAt: -1 })
      .lean();
    
    console.log(`✅ Found ${doctors.length} approved doctors in database ${req.tenantDbName || 'default'}`);
    
    // Log a sample doctor for debugging
    if (doctors.length > 0) {
      console.log('📄 Sample doctor:', {
        id: doctors[0]._id,
        name: `${doctors[0].firstName} ${doctors[0].lastName}`,
        specialty: doctors[0].specialty || doctors[0].specialization,
        verificationStatus: doctors[0].verificationStatus
      });
    }
    
    return res.status(200).json({
      success: true,
      data: doctors,
      total: doctors.length,
      source: req.tenantDbName || 'default'
    });
    
  } catch (error) {
    console.error('❌ Error fetching doctor list:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch doctors',
      error: error.message
    });
  }
};


/**
 * Get connected doctors for current user
 * This helps patients see which doctors they're connected to
 */
exports.getConnectedDoctors = async (req, res) => {
  try {
    console.log('🔗 getConnectedDoctors called');
    console.log('👤 User ID:', req.user.id || req.user._id);
    console.log('👤 User role:', req.user.role);
    
    const userId = req.user.id || req.user._id;
    
    // Use tenant-specific model
    let PatientDoctorAssociation;
    
    if (req.tenantConnection) {
      try {
        PatientDoctorAssociation = req.tenantConnection.model('PatientDoctorAssociation');
        console.log('✅ Using tenant PatientDoctorAssociation model');
      } catch (err) {
        PatientDoctorAssociation = require('../models/PatientDoctorAssociation');
        console.log('🔄 Using global PatientDoctorAssociation model');
      }
    } else if (req.getModel) {
      PatientDoctorAssociation = req.getModel('PatientDoctorAssociation');
      console.log('✅ Using PatientDoctorAssociation from req.getModel');
    } else {
      PatientDoctorAssociation = require('../models/PatientDoctorAssociation');
      console.log('🔄 Using global PatientDoctorAssociation model (no tenant connection)');
    }
    
    // Find all active associations for this user
    const associations = await PatientDoctorAssociation.find({
      patient: userId,
      status: 'active'
    }).populate({
      path: 'doctor',
      select: 'firstName lastName title specialty specialization profilePicture consultationFee bio yearsOfPractice clinicAddress languages emergencyAware telehealth inPerson'
    }).lean();
    
    console.log(`✅ Found ${associations.length} connected doctors`);
    
    // Extract doctor information
    const connectedDoctors = associations.map(assoc => ({
      associationId: assoc._id,
      connectionDate: assoc.createdAt,
      doctor: assoc.doctor
    }));
    
    return res.status(200).json({
      success: true,
      data: connectedDoctors,
      total: connectedDoctors.length
    });
    
  } catch (error) {
    console.error('❌ Error getting connected doctors:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get connected doctors',
      error: error.message
    });
  }
};


/**
 * Get current doctor for user (improved version)
 * This returns the most recently connected doctor for the current user
 */
exports.getCurrentDoctorForUser = async (req, res) => {
  try {
    console.log('👤 getCurrentDoctorForUser called');
    console.log('👤 User ID:', req.user.id || req.user._id);
    console.log('👤 User role:', req.user.role);
    
    const userId = req.user.id || req.user._id;
    
    // Use tenant-specific model
    let PatientDoctorAssociation;
    
    if (req.tenantConnection) {
      try {
        PatientDoctorAssociation = req.tenantConnection.model('PatientDoctorAssociation');
        console.log('✅ Using tenant PatientDoctorAssociation model');
      } catch (err) {
        PatientDoctorAssociation = require('../models/PatientDoctorAssociation');
        console.log('🔄 Using global PatientDoctorAssociation model');
      }
    } else if (req.getModel) {
      PatientDoctorAssociation = req.getModel('PatientDoctorAssociation');
      console.log('✅ Using PatientDoctorAssociation from req.getModel');
    } else {
      PatientDoctorAssociation = require('../models/PatientDoctorAssociation');
      console.log('🔄 Using global PatientDoctorAssociation model (no tenant connection)');
    }
    
    // Find the most recent active association
    const association = await PatientDoctorAssociation.findOne({
      patient: userId,
      status: 'active'
    })
    .populate({
      path: 'doctor',
      select: 'firstName lastName title specialty specialization profilePicture consultationFee bio yearsOfPractice clinicAddress languages emergencyAware telehealth inPerson paymentMethods'
    })
    .sort({ createdAt: -1 }) // Get the most recent connection
    .lean();
    
    if (!association || !association.doctor) {
      console.log('❌ No current doctor found for user');
      return res.status(200).json({
        success: true,
        data: null,
        message: 'No current doctor connection found'
      });
    }
    
    console.log('✅ Current doctor found:', {
      doctorId: association.doctor._id,
      doctorName: `${association.doctor.firstName} ${association.doctor.lastName}`,
      connectionDate: association.createdAt
    });
    
    return res.status(200).json({
      success: true,
      data: {
        associationId: association._id,
        connectionDate: association.createdAt,
        doctor: association.doctor
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting current doctor for user:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get current doctor',
      error: error.message
    });
  }
};


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


exports.scheduleAppointment = async (req, res) => {
  try {
    const { doctorId, date, time, type, notes } = req.body;
    const patientId = req.user._id;
    
    const appointmentDate = new Date(`${date}T${time}`);
    if (appointmentDate <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Appointment must be scheduled for a future date and time'
      });
    }
    
    const doctor = await User.findOne({ _id: doctorId, role: 'doctor' });
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }
    
    const appointment = new Appointment({
      doctor: doctorId,
      patient: patientId,
      date: appointmentDate,
      type,
      notes,
      status: 'pending'
    });
    
    await appointment.save();
    
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
    
    const patientId = req.user._id;
    
    console.log(`Connecting patient ${patientId} with doctor ${doctorId}`);
    
    const doctor = await User.findOne({ _id: doctorId, role: 'doctor' });
    if (!doctor) {
      console.log(`Doctor with ID ${doctorId} not found`);
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }
    
    const existingAssociation = await PatientDoctorAssociation.findOne({
      patient: patientId,
      doctor: doctorId
    });
    
    let result;
    
    if (existingAssociation) {
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


exports.getPatients = async (req, res) => {
  try {
    console.log('🔍 getPatients called - Multi-tenant check');
    console.log('🔍 Tenant context:', {
      tenantId: req.tenantId || 'None',
      tenantDbName: req.tenantDbName || 'None',
      tenantConnection: !!req.tenantConnection,
      hasGetModel: typeof req.getModel === 'function'
    });
    
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
    
    const patients = await UserModel.find({ role: 'patient' })
      .select('firstName lastName email _id age gender middleName nickname birthdate location clinicLocation diagnosis occupation emergencyName profilePicture onboardingCompleted createdAt')
      .sort({ createdAt: -1 });
    
    console.log(`✅ Found ${patients.length} patients in ${req.tenantDbName || 'default'} database`);
    
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


exports.getPatient = async (req, res) => {
  try {
    const { id } = req.params;
    const requestingUser = req.user;
    
    console.log(`🔍 getPatient called - Patient ID: ${id}, Requesting User: ${requestingUser.id || requestingUser._id}, Role: ${requestingUser.role}`);
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID is required'
      });
    }
    
    const mongoose = require('mongoose');
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log(`❌ Invalid ObjectId format: ${id}`);
      return res.status(400).json({
        success: false,
        message: 'Invalid patient ID format'
      });
    }
    
    const patientObjectId = new mongoose.Types.ObjectId(id);
    console.log(`🔍 Converted to ObjectId: ${patientObjectId}`);
    
    const requestingUserId = requestingUser.id || requestingUser._id;
    
    console.log('🔍 TENANT INFO:', {
      tenantId: req.tenantId || 'None',
      tenantDbName: req.tenantDbName || 'None', 
      tenantConnection: !!req.tenantConnection,
      hasGetModel: typeof req.getModel === 'function'
    });
    
    let patient = null;
    
    if (req.tenantConnection && req.tenantConnection.db) {
      try {
        console.log('🔍 PRIORITY METHOD: Direct tenant database collection access');
        const usersCollection = req.tenantConnection.db.collection('users');
        
        patient = await usersCollection.findOne({
          _id: patientObjectId,
          role: 'patient'
        });
        
        if (patient) {
          console.log('✅ PRIORITY METHOD SUCCESS: Found patient via direct collection access');
          console.log('🔍 Patient data keys:', Object.keys(patient));
        } else {
          console.log('❌ PRIORITY METHOD: Patient not found via direct collection access');
        }
      } catch (directError) {
        console.error('❌ PRIORITY METHOD failed:', directError.message);
      }
    }
    
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
    
    if (!patient) {
      console.log(`❌ Patient ${id} not found with any method`);
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }
    
    console.log('🔧 Checking access control...');
    console.log('🔧 Requesting user role:', requestingUser.role);
    console.log('🔧 Requesting user ID:', requestingUserId);
    console.log('🔧 Patient ID:', patient._id);
    
    if (requestingUser.role === 'patient') {
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
      console.log('✅ Doctor access granted: Medical professional accessing patient data');
      
    } else {
      console.log('❌ Access denied: Invalid role:', requestingUser.role);
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }
    
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


// All your existing methods continue here (getPatientJournals, getJournalEntry, etc.)
// I'm including the key ones and the remaining template/profile methods:


exports.getPatientJournals = async (req, res) => {
  try {
    const doctorId = req.user._id;
    const patientId = req.params.id;
    const { limit = 10, page = 1, startDate, endDate } = req.query;
    
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
    
    const query = { 
      user: patientId,
      isSharedWithDoctor: true,
      $or: [
        { assignedDoctor: doctorId },
        { assignedDoctor: null }
      ]
    };
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const entries = await JournalEntry.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate({
        path: 'template',
        select: 'name description fields'
      });
    
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


exports.getJournalEntry = async (req, res) => {
  try {
    const doctorId = req.user._id;
    const entryId = req.params.id;
    
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


exports.analyzeJournalEntry = async (req, res) => {
  const entryId = req.params.id;
  const { useAI, sentiment, emotions, notes, flags, applyChanges = true } = req.body;
  
  try {
    const entry = await JournalEntry.findById(entryId);
    if (!entry) {
      return res.status(404).json({ message: 'Journal entry not found' });
    }
    
    const association = await PatientDoctorAssociation.findOne({
      doctor: req.user.id,
      patient: entry.user
    });
    
    if (!association) {
      return res.status(403).json({ message: 'Not authorized to analyze this journal entry' });
    }
    
    let analysis = {
      sentiment: null,
      emotions: [],
      notes: notes || '',
      flags: flags || [],
      isAnalyzed: true,
      analyzedBy: req.user.id,
      analyzedAt: new Date()
    };
    
    let aiAnalysis = null;
    if (useAI) {
      try {
        const textContent = extractTextFromEntry(entry);
        aiAnalysis = await nlpService.analyzeJournalEntry(textContent);
        
        if (applyChanges && !sentiment && (!emotions || emotions.length === 0)) {
          analysis.sentiment = aiAnalysis.sentiment;
          analysis.emotions = aiAnalysis.emotions || [];
          
          if (aiAnalysis.flags && aiAnalysis.flags.length > 0) {
            analysis.flags = [...new Set([...analysis.flags, ...aiAnalysis.flags])];
          }
        }
      } catch (error) {
        console.error('Error in AI analysis:', error);
      }
    }
    
    if (sentiment) {
      analysis.sentiment = { type: sentiment };
    }
    
    if (emotions && emotions.length > 0) {
      analysis.emotions = Array.isArray(emotions) 
        ? emotions.map(e => (typeof e === 'string' ? { name: e } : e))
        : [];
    }
    
    if (applyChanges) {
      entry.sentimentAnalysis = analysis;
      entry.doctorNotes = notes || entry.doctorNotes;
      entry.flags = flags || entry.flags;
      await entry.save();
    }
    
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


/**
 * Get doctor profile by ID - FOR FLUTTER
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
    
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      console.log('❌ Invalid ObjectId format:', doctorId);
      return res.status(400).json({
        success: false,
        message: 'Invalid doctor ID format'
      });
    }
    
    const doctor = await UserModel.findOne({
      _id: doctorId,
      role: 'doctor',
      verificationStatus: 'approved'
    }).select('firstName lastName title credentials specialty specialization profilePicture description languages gender lgbtqAffirming availability education experience ratings consultationFee bio yearsOfPractice clinicAddress emergencyAware telehealth inPerson')
    .lean();
    
    if (!doctor) {
      console.log('❌ Doctor not found with ID:', doctorId);
      
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
 */
exports.getCurrentDoctorProfile = async (req, res) => {
  try {
    console.log('🔍 getCurrentDoctorProfile called for user:', req.user.id || req.user._id);
    
    const doctorId = req.user.id || req.user._id;
    
    if (!doctorId) {
      console.log('❌ No user ID found in request');
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
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
 */
exports.getDoctorPaymentMethods = async (req, res) => {
  try {
    const doctorId = req.params.doctorId;
    
    console.log(`🏦 Getting payment methods for doctor: ${doctorId}`);
    
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
    
    const doctor = await UserModel.findById(doctorId).select('paymentMethods firstName lastName');
    
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }
    
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


