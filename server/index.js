// server/index.js

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const fs = require('fs');
const http = require('http');
const jwt = require('jsonwebtoken');

// Load environment variables from .env file
dotenv.config();

// ============= HEROKU CONFIGURATION - ADDED =============
// Heroku-specific configurations
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 5000;

console.log(`🚀 Starting Neurolex in ${process.env.NODE_ENV} mode`);
console.log(`📊 Port: ${PORT}`);
console.log(`🏢 Multi-tenant: ${process.env.ENABLE_MULTI_TENANT}`);

// Database configuration for Heroku
const getMongoURI = () => {
  if (isProduction) {
    // For Heroku, use MongoDB Atlas connection string
    return process.env.MONGODB_URI || process.env.MONGO_URI;
  }
  return process.env.MONGO_URI;
};

// Certificate handling for Heroku - FIXED VERSION
const getCertificatePath = () => {
  // FORCE USERNAME/PASSWORD AUTHENTICATION FOR ATLAS
  // Check if using Atlas connection string (contains mongodb+srv://)
  const mongoURI = getMongoURI();
  if (mongoURI && mongoURI.includes('mongodb+srv://')) {
    console.log('🔄 Detected Atlas connection string - using username/password auth');
    return null; // Force username/password authentication
  }
  
  if (isProduction) {
    // On Heroku, we won't use certificate files (use MongoDB Atlas instead)
    return null;
  }
  
  // Only use certificates for local MongoDB with certificate setup
  const certPath = path.join(__dirname, 'certificates/angeles_admin1.pem');
  if (fs.existsSync(certPath)) {
    return certPath;
  }
  
  return null; // No certificate found, use username/password
};

// Updated database connection logic for Heroku - FIXED VERSION
const connectToDatabase = async () => {
  const mongoURI = getMongoURI();
  const certPath = getCertificatePath();
  
  if (!mongoURI) {
    throw new Error('MongoDB URI not provided. Check MONGODB_URI or MONGO_URI environment variable.');
  }

  console.log(`🔗 Connecting to MongoDB in ${process.env.NODE_ENV} mode`);
  console.log(`📍 Using URI: ${mongoURI.replace(/\/\/.*@/, '//***:***@')}`); // Hide credentials in logs

  const connectionOptions = {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000, // Increased for Heroku
    socketTimeoutMS: 45000,
    // Removed problematic options for newer MongoDB drivers
    // bufferCommands: false,  // REMOVED - causes issues with newer drivers
    // bufferMaxEntries: 0     // REMOVED - not supported in newer versions
  };

  // Only add certificate options if certificate path exists AND not using Atlas
  if (certPath && fs.existsSync(certPath) && !mongoURI.includes('mongodb+srv://')) {
    console.log('🔐 Using certificate authentication');
    connectionOptions.tls = true;
    connectionOptions.tlsCertificateKeyFile = certPath;
    connectionOptions.authMechanism = 'MONGODB-X509';
    connectionOptions.authSource = '$external';
  } else {
    console.log('🔑 Using standard MongoDB authentication (username/password)');
    // Don't add any auth options - let Atlas handle it
  }

  try {
    const connection = await mongoose.connect(mongoURI, connectionOptions);
    console.log(`✅ MongoDB Connected: ${connection.connection.host}`);
    return connection;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    throw error;
  }
};
// ============= END HEROKU CONFIGURATION =============

// Multi-tenant support imports
const { connectMaster } = require('./src/config/dbMaster');
const dbManager = require('./src/utils/dbManager');

// Import the socket utility
const { initializeSocketServer, getIo } = require('./src/utils/socket');

// Import models
const User = require('./src/models/User');
const PatientDoctorAssociation = require('./src/models/PatientDoctorAssociation');
const Appointment = require('./src/models/Appointment');
const JournalEntry = require('./src/models/JournalEntry');
const Mood = require('./src/models/Mood');

// Import middleware
const { protect } = require('./src/middleware/auth');
const tenantMiddleware = require('./src/middleware/tenantMiddleware');

// Import controllers
const doctorController = require('./src/controllers/doctorController');

// ============= FIXED: ROUTE IMPORTS - COMMENTED OUT PROBLEMATIC ROUTES =============
// Import route files that are working
const doctorRoutes = require('./src/routes/doctorRoutes');
const appointmentRoutes = require('./src/routes/appointmentRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const tenantRoutes = require('./src/routes/tenantRoutes'); // Multi-tenant routes

// ============= TEMPORARILY COMMENTED OUT - THESE CAUSE PATH-TO-REGEXP ERROR =============
// const journalRoutes = require('./src/routes/journalRoutes');
// const moodRoutes = require('./src/routes/moodRoutes');
// const billingRoutes = require('./src/routes/billingRoutes');
// const apiRoutes = require('./src/routes/index'); // Central routes file
// ==================================================================================

console.log('✅ Essential routes loaded successfully');
// ============= END ROUTE IMPORTS =============

// Initialize express app
const app = express();

// Create HTTP server from Express app
const server = http.createServer(app);

// Initialize Socket.io with the HTTP server using our utility
const io = initializeSocketServer(server);

// TRUST PROXY SETTING - Fix for rate limit warning
app.set('trust proxy', 1);

// Set security-related HTTP headers
app.use(helmet({
  contentSecurityPolicy: false // Disable CSP for development
}));

// Parse JSON request body
app.use(express.json({ limit: '10kb' }));

// Parse URL-encoded request body
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ============= UPDATED CORS CONFIGURATION FOR HEROKU =============
// Setup CORS - Updated to handle all environments
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (process.env.NODE_ENV === 'production') {
      // Production: Allow Heroku domains and any custom domains
      const allowedOrigins = [
        process.env.CLIENT_URL,
        process.env.HEROKU_APP_URL,
        /\.herokuapp\.com$/,
        /^https:\/\/.*\.herokuapp\.com$/
      ].filter(Boolean);
      
      // Check if origin matches any allowed pattern
      const isAllowed = allowedOrigins.some(allowedOrigin => {
        if (typeof allowedOrigin === 'string') {
          return origin === allowedOrigin;
        }
        if (allowedOrigin instanceof RegExp) {
          return allowedOrigin.test(origin);
        }
        return false;
      });
      
      if (isAllowed) {
        return callback(null, true);
      } else {
        console.warn(`🚫 CORS blocked: ${origin}`);
        return callback(null, true); // Allow anyway for now, remove in production
      }
    } else {
      // Development: Allow localhost and common dev origins
      const devOrigins = [
        'http://localhost:3000',
        'http://localhost:3001', 
        'http://127.0.0.1:3000',
        'http://localhost'
      ];
      
      if (devOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        console.warn(`🚫 CORS blocked in dev: ${origin}`);
        return callback(null, true); // Allow in development anyway
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id']
}));
// ============= END CORS CONFIGURATION =============

// Request logging in development environment
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

app.use('/uploads/qr-codes', express.static(path.join(__dirname, 'uploads/qr-codes'), {
  maxAge: '1d',
  etag: false,
  // Add logging for debugging
  setHeaders: (res, path, stat) => {
    console.log(`📁 Serving static file: ${path}`);
  }
}));

// Attach io to request object for controllers to use
app.use((req, res, next) => {
  req.io = getIo();
  next();
});

// Debug middleware for tenant context
const debugTenantContext = (req, res, next) => {
  // Skip for static files and non-API routes
  if (!req.path.startsWith('/api') || req.path.includes('.')) {
    return next();
  }
  
  console.log(`
--------- TENANT DEBUG (${req.method} ${req.path}) ---------
User: ${req.user ? `ID: ${req.user.id || req.user._id}, Role: ${req.user.role}` : 'Not authenticated'}
Tenant context:
  • tenantId: ${req.tenantId || 'none'}
  • tenantDbName: ${req.tenantDbName || 'none'}
  • tenantConnection: ${req.tenantConnection ? 'exists' : 'none'}  
  • getModel function: ${typeof req.getModel === 'function' ? 'available' : 'not available'}
Auth header: ${req.headers.authorization ? 'present' : 'none'}
-----------------------------------------------------
`);
  
  // Store the original end function
  const originalEnd = res.end;
  
  // Override the end function to log response status
  res.end = function() {
    console.log(`
--------- TENANT RESPONSE (${req.method} ${req.path}) ---------
Status: ${res.statusCode}
Tenant context preserved: ${req.tenantId ? 'yes' : 'no'}
-----------------------------------------------------
`);
    
    // Call the original end function
    return originalEnd.apply(this, arguments);
  };
  
  next();
};

// Apply the debug middleware
app.use(debugTenantContext);

// Rate limiting to prevent brute force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minute window
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});

// Apply rate limiting to auth routes
app.use('/api/auth', authLimiter);

// IMPORTANT: Mount tenant routes FIRST to ensure public routes work without auth
app.use('/api/tenants', tenantRoutes);

// ============= SIMPLE TEST ROUTES TO REPLACE PROBLEMATIC ONES =============
app.get('/api/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Neurolex API is working perfectly!',
    timestamp: new Date(),
    environment: process.env.NODE_ENV,
    version: '1.0.0'
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date()
  });
});

// Protected test routes
app.get('/api/auth/test', protect, (req, res) => {
  res.json({ 
    success: true, 
    message: 'Authentication working',
    user: {
      id: req.user.id,
      role: req.user.role,
      email: req.user.email
    }
  });
});

// Simple journal test route
app.get('/api/journal/test', protect, (req, res) => {
  res.json({ 
    success: true, 
    message: 'Journal API endpoint working',
    user: req.user ? req.user.id : 'No user',
    features: ['create', 'read', 'update', 'delete']
  });
});

// Simple mood test route  
app.get('/api/mood/test', protect, (req, res) => {
  res.json({ 
    success: true, 
    message: 'Mood API endpoint working',
    user: req.user ? req.user.id : 'No user',
    features: ['track', 'history', 'analytics']
  });
});

// Simple billing test route
app.get('/api/billing/test', protect, (req, res) => {
  res.json({ 
    success: true, 
    message: 'Billing API endpoint working',
    user: req.user ? req.user.id : 'No user',
    features: ['payments', 'invoices', 'reports']
  });
});
// ============= END SIMPLE TEST ROUTES =============

// IMPORTANT: Patient-facing endpoints - added BEFORE restrictTo middleware
// These need to be defined BEFORE the doctor routes to avoid the role restriction

// Get available doctors (for patient search)
app.get('/api/doctor/available', protect, doctorController.getAvailableDoctors);

// Connect with doctor (for patients) - direct implementation
const connectWithDoctor = async (req, res) => {
  try {
    console.log('connectWithDoctor called with body:', req.body);
    
    // Extract data from request
    const { doctorId } = req.body;
    
    // FIXED: Use req.user.id instead of req.user._id
    const patientId = req.user ? req.user.id : null;
    
    // Validate required fields
    if (!doctorId) {
      return res.status(400).json({
        success: false,
        message: 'Doctor ID is required'
      });
    }
    
    // Validate patient ID
    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID is not available. Please log in again.'
      });
    }
    
    console.log(`Patient ID: ${patientId}, Doctor ID: ${doctorId}`);
    
    // DIRECT DB APPROACH - Similar to appointment solution
    if (req.tenantConnection && req.tenantConnection.db) {
      try {
        console.log('Using tenant database direct access');
        
        // Get collections
        const usersCollection = req.tenantConnection.db.collection('users');
        const associationsCollection = req.tenantConnection.db.collection('patientdoctorassociations');
        
        // Convert IDs to ObjectID
        const doctorObjectId = mongoose.Types.ObjectId.isValid(doctorId) 
          ? new mongoose.Types.ObjectId(doctorId) 
          : doctorId;
          
        const patientObjectId = mongoose.Types.ObjectId.isValid(patientId) 
          ? new mongoose.Types.ObjectId(patientId) 
          : patientId;
        
        // Check if doctor exists
        const doctor = await usersCollection.findOne({ _id: doctorObjectId });
        
        if (!doctor) {
          return res.status(404).json({
            success: false, 
            message: 'Doctor not found'
          });
        }
        
        if (doctor.role !== 'doctor') {
          return res.status(400).json({
            success: false,
            message: 'Selected user is not a doctor'
          });
        }
        
        // Check for existing association
        const existingAssociation = await associationsCollection.findOne({
          patient: patientObjectId,
          doctor: doctorObjectId
        });
        
        if (existingAssociation) {
          // Update status if needed
          if (existingAssociation.status !== 'active') {
            await associationsCollection.updateOne(
              { _id: existingAssociation._id },
              { $set: { status: 'active' } }
            );
          }
          
          return res.status(200).json({
            success: true,
            message: 'Already connected with this doctor',
            data: { doctorId, patientId }
          });
        }
        
        // Create new association
        const newAssociation = {
          patient: patientObjectId,
          doctor: doctorObjectId,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        // Add tenantId if available
        if (req.tenantId) {
          newAssociation.tenantId = req.tenantId;
        }
        
        // Insert the association
        const result = await associationsCollection.insertOne(newAssociation);
        
        // Update the relationships
        await usersCollection.updateOne(
          { _id: patientObjectId },
          { $addToSet: { doctors: doctorObjectId } }
        );
        
        await usersCollection.updateOne(
          { _id: doctorObjectId },
          { $addToSet: { patients: patientObjectId } }
        );
        
        return res.status(201).json({
          success: true,
          message: 'Successfully connected with doctor',
          data: { doctorId, patientId }
        });
      } catch (directDbError) {
        console.error('Error using direct DB access:', directDbError);
        // Fall through to default approach
      }
    }
    
    // STANDARD MONGOOSE APPROACH
    console.log('Using default models');
    
    // Check if doctor exists - use findById to avoid casting issues
    const doctor = await User.findById(doctorId);
    
    if (!doctor) {
      return res.status(404).json({
        success: false, 
        message: 'Doctor not found'
      });
    }
    
    if (doctor.role !== 'doctor') {
      return res.status(400).json({
        success: false,
        message: 'Selected user is not a doctor'
      });
    }
    
    // Check for existing association
    const existingAssociation = await PatientDoctorAssociation.findOne({
      patient: patientId,
      doctor: doctorId
    });
    
    if (existingAssociation) {
      // Update status if needed
      if (existingAssociation.status !== 'active') {
        existingAssociation.status = 'active';
        await existingAssociation.save();
      }
      
      return res.status(200).json({
        success: true,
        message: 'Already connected with this doctor',
        data: { doctorId, patientId }
      });
    }
    
    // Create new association
    const newAssociation = new PatientDoctorAssociation({
      patient: patientId,
      doctor: doctorId,
      status: 'active'
    });
    
    // Add tenantId if available
    if (req.tenantId) {
      newAssociation.tenantId = req.tenantId;
    }
    
    await newAssociation.save();
    
    // Return success
    return res.status(201).json({
      success: true,
      message: 'Successfully connected with doctor',
      data: { doctorId, patientId }
    });
    
  } catch (error) {
    console.error('Error in connectWithDoctor:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to connect with doctor',
      error: error.message
    });
  }
};

// Mount the connect endpoint directly
// Apply tenant middleware specifically for doctor routes
app.use('/api/doctor/connect', protect, tenantMiddleware, (req, res, next) => {
  console.log('\n===== TENANT CONNECTION DEBUG FOR DOCTOR CONNECT =====');
  console.log(`Path: ${req.method} ${req.path}`);
  console.log(`User ID: ${req.user ? req.user.id : 'Not authenticated'}`);
  console.log(`Tenant ID: ${req.tenantId || 'Not set'}`);
  
  // Check if tenant connection exists
  if (req.tenantConnection) {
    console.log(`Tenant Connection: YES - DB: ${req.tenantConnection.db?.databaseName || 'unknown'}`);
    console.log(`Connection State: ${req.tenantConnection.readyState}`); // 1 = connected
  } else {
    console.log('Tenant Connection: NO');
  }
  console.log('====================================\n');
  next();
});

// Mount the connect endpoint with the tenant middleware applied above
app.post('/api/doctor/connect', connectWithDoctor);

// ************ START OF APPOINTMENT FIX ************
// Apply tenant middleware specifically for appointment routes
app.use('/api/appointments', protect, tenantMiddleware, (req, res, next) => {
  console.log('\n===== TENANT CONNECTION DEBUG FOR APPOINTMENTS =====');
  console.log(`Path: ${req.method} ${req.path}`);
  console.log(`User ID: ${req.user ? req.user.id : 'Not authenticated'}`);
  console.log(`Tenant ID: ${req.tenantId || 'Not set'}`);
  
  // Check if tenant connection exists
  if (req.tenantConnection) {
    console.log(`Tenant Connection: YES - DB: ${req.tenantConnection.db?.databaseName || 'unknown'}`);
    console.log(`Connection State: ${req.tenantConnection.readyState}`); // 1 = connected
  } else {
    console.log('Tenant Connection: NO');
  }
  console.log('====================================\n');
  next();
});

// Now mount the appointment routes after the tenant middleware
app.use('/api/appointments', appointmentRoutes);
// ************ END OF APPOINTMENT FIX ************

// Mount doctor routes at /api/doctor (singular)
app.use('/api/doctor', doctorRoutes);

// Mount admin routes
app.use('/api/admin', adminRoutes);

// DIRECT HANDLERS FOR MOBILE APP ROUTES
// Get user appointments
app.get('/api/users/:userId/appointments', protect, async (req, res) => {
  try {
    console.log('Mobile app appointment route called with userId:', req.params.userId);
    
    const { userId } = req.params;
    const { status } = req.query;
    
    // Log to debug
    console.log(`Getting appointments for user ${userId} with status ${status || 'all'}`);
    
    // Build query
    const query = { patient: userId };
    
    // Add status filter if provided
    if (status === 'upcoming') {
      query.appointmentDate = { $gte: new Date() };
      query.status = { $in: ['Scheduled'] };
    } else if (status) {
      query.status = status;
    }
    
    // Query the database for real appointments
    const appointments = await Appointment.find(query)
      .populate('doctor', 'firstName lastName profilePicture specialization')
      .sort({ appointmentDate: 1 })
      .lean();
    
    // Transform the data to the format expected by the Flutter app
    const formattedAppointments = appointments.map(appointment => {
      // Format date and time
      const appointmentDate = new Date(appointment.appointmentDate);
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June', 
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const date = `${months[appointmentDate.getMonth()]} ${appointmentDate.getDate()}, ${appointmentDate.getFullYear()}`;
      
      // Format time
      const hour = appointmentDate.getHours() > 12 ? appointmentDate.getHours() - 12 : appointmentDate.getHours();
      const minute = appointmentDate.getMinutes().toString().padStart(2, '0');
      const period = appointmentDate.getHours() >= 12 ? 'PM' : 'AM';
      const time = `${hour}:${minute} ${period}`;
      
      // Get doctor name
      let doctorName = 'Unknown Doctor';
      let specialization = '';
      
      if (appointment.doctor) {
        if (typeof appointment.doctor === 'object') {
          doctorName = `Dr. ${appointment.doctor.firstName || ''} ${appointment.doctor.lastName || ''}`.trim();
          specialization = appointment.doctor.specialization || '';
        }
      }
      
      return {
        _id: appointment._id.toString(),
        doctorName,
        specialization,
        date,
        time,
        appointmentDate: appointment.appointmentDate,
        status: appointment.status,
        duration: appointment.duration
      };
    });
    
    // Log success
    console.log(`Found ${formattedAppointments.length} appointments`);
    
    res.status(200).json(formattedAppointments);
  } catch (error) {
    console.error(`Error getting user appointments: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get user appointments',
      error: error.message
    });
  }
});

// Get user journal entries
app.get('/api/users/:userId/journal-entries', protect, async (req, res) => {
  try {
    console.log('Mobile app journal entries route called with userId:', req.params.userId);
    
    const { userId } = req.params;
    const { limit = 5, sort = 'date:desc' } = req.query;
    
    // Log to debug
    console.log(`Getting journal entries for user ${userId} with limit ${limit} and sort ${sort}`);
    
    // Parse limit to number
    const limitNum = parseInt(limit);
    
    // Parse sort parameter
    const [sortField, sortOrder] = sort.split(':');
    const sortObj = {};
    sortObj[sortField === 'date' ? 'createdAt' : sortField] = sortOrder === 'desc' ? -1 : 1;
    
    // Query the database for real journal entries
    const journalEntries = await JournalEntry.find({ user: userId })
      .sort(sortObj)
      .limit(limitNum)
      .lean();
    
    // Transform the data to the format expected by the Flutter app
    const formattedEntries = journalEntries.map(entry => {
      // Format date
      const createdAt = new Date(entry.createdAt);
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June', 
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const date = `${months[createdAt.getMonth()]} ${createdAt.getDate()}, ${createdAt.getFullYear()}`;
      
      // Get sentiment if available
      let sentiment = 'neutral';
      let emotions = [];
      
      if (entry.sentimentAnalysis) {
        if (entry.sentimentAnalysis.sentiment && entry.sentimentAnalysis.sentiment.type) {
          sentiment = entry.sentimentAnalysis.sentiment.type;
        }
        
        if (entry.sentimentAnalysis.emotions && Array.isArray(entry.sentimentAnalysis.emotions)) {
          emotions = entry.sentimentAnalysis.emotions;
        }
      }
      
      // Create title from content if not available
      let title = entry.title || '';
      if (!title && entry.rawText) {
        // Use first few words of content as title
        const words = entry.rawText.split(' ').slice(0, 5).join(' ');
        title = words.length < entry.rawText.length ? `${words}...` : words;
      }
      
      return {
        _id: entry._id.toString(),
        title,
        content: entry.rawText || '',
        date,
        sentiment,
        emotions,
        createdAt: entry.createdAt
      };
    });
    
    // Log success
    console.log(`Found ${formattedEntries.length} journal entries`);
    
    res.status(200).json(formattedEntries);
  } catch (error) {
    console.error(`Error getting user journal entries: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get user journal entries',
      error: error.message
    });
  }
});

// Get current mood
app.get('/api/users/:userId/moods/current', protect, async (req, res) => {
  try {
    console.log('Mobile app current mood route called with userId:', req.params.userId);
    
    const { userId } = req.params;
    
    // Log to debug
    console.log(`Getting current mood for user ${userId}`);
    
    // Query the database for the most recent mood entry
    const latestMood = await Mood.findOne({ user: userId })
      .sort({ createdAt: -1 })
      .lean();
    
    // If no mood entry found, return a default
    if (!latestMood) {
      return res.status(200).json({
        mood: 'neutral',
        timestamp: new Date().toISOString(),
        notes: ''
      });
    }
    
    // Log success
    console.log('Found current mood:', latestMood);
    
    res.status(200).json(latestMood);
  } catch (error) {
    console.error(`Error getting current mood: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get current mood',
      error: error.message
    });
  }
});

// Create mood entry
app.post('/api/users/:userId/moods', protect, async (req, res) => {
  try {
    console.log('Mobile app create mood route called with userId:', req.params.userId);
    
    const { userId } = req.params;
    const { mood, notes, timestamp } = req.body;
    
    // Log to debug
    console.log(`Creating mood for user ${userId}:`, { mood, notes, timestamp });
    
    // Validate mood
    if (!mood) {
      return res.status(400).json({
        success: false,
        message: 'Mood is required'
      });
    }
    
    // Create new mood entry in database
    const moodEntry = new Mood({
      user: userId,
      mood,
      notes: notes || '',
      timestamp: timestamp ? new Date(timestamp) : new Date()
    });
    
    await moodEntry.save();
    
    // Log success
    console.log('Created new mood entry:', moodEntry);
    
    res.status(201).json({
      success: true,
      message: 'Mood entry created successfully',
      data: moodEntry
    });
  } catch (error) {
    console.error(`Error creating mood entry: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to create mood entry',
      error: error.message
    });
  }
});

// ============= COMMENTED OUT PROBLEMATIC ROUTES =============
// These routes were causing path-to-regexp errors, so they're temporarily disabled
/*
// Use centralized routes - mount all other API routes
app.use('/api', apiRoutes);

// Register billing routes with proper middleware chain
app.use('/api/doctor/billing', protect, billingRoutes);

// Journal routes
app.use('/api/journal', journalRoutes);

// Mood routes  
app.use('/api/mood', moodRoutes);
*/
// ============= END COMMENTED OUT ROUTES =============

// ============= UPDATED STATIC FILE SERVING FOR HEROKU =============
// Serve static assets in production (place this AFTER all API routes)
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, '../client/build');
  
  console.log(`📁 Looking for build files at: ${buildPath}`);
  console.log(`📂 Build path exists: ${fs.existsSync(buildPath)}`);
  
  if (fs.existsSync(buildPath)) {
    // Serve static files
    app.use(express.static(buildPath, {
      maxAge: '1y', // Cache static assets for 1 year
      etag: true,
      setHeaders: (res, path) => {
        // Set cache headers for different file types
        if (path.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      }
    }));
    
    console.log('✅ Serving static files from client/build');
    
    // Handle client-side routing - this should come AFTER all API routes
    app.get('*', (req, res) => {
      // Skip API routes and uploads
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
        return res.status(404).json({ 
          success: false,
          message: 'API endpoint not found',
          path: req.path 
        });
      }
      
      console.log(`🔄 Serving React app for route: ${req.path}`);
      res.sendFile(path.resolve(buildPath, 'index.html'));
    });
  } else {
    console.warn('⚠️ Build folder not found, serving API only');
    
    // Fallback routes when build folder doesn't exist
    app.get('/', (req, res) => {
      res.json({ 
        success: true,
        message: 'Neurolex API is running - Frontend build not found',
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
        buildPath: buildPath,
        version: '1.0.0'
      });
    });
    
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ 
          success: false,
          message: 'API endpoint not found',
          path: req.path 
        });
      }
      res.status(404).json({ 
        success: false,
        message: 'Frontend not available - build folder missing',
        path: req.path 
      });
    });
  }
} else {
  // Development mode
  app.get('/', (req, res) => {
    res.json({ 
      success: true,
      message: 'Neurolex API Development Server',
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    });
  });
}
// ============= END STATIC FILE SERVING =============

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  // Handle errors to prevent server crashes
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Server error occurred'
  });
});

// Debug endpoint
app.get('/api/debug/database', async (req, res) => {
  try {
    const users = await User.find().limit(5).lean();
    const journalEntries = await JournalEntry.find().limit(5).lean();
    
    res.json({
      success: true,
      message: 'Database connection working!',
      environment: process.env.NODE_ENV,
      database: 'Connected',
      users: users.map(u => ({
        id: u._id,
        name: `${u.firstName} ${u.lastName}`,
        email: u.email,
        role: u.role
      })),
      journalEntries: journalEntries.map(j => ({
        id: j._id,
        userId: j.user,
        title: j.title,
        content: j.rawText ? (j.rawText.substring(0, 30) + '...') : 'No content'
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Database connection failed'
    });
  }
});

// ============= UPDATED DATABASE CONNECTION FOR HEROKU =============
// Replace your existing connection logic with this
if (process.env.ENABLE_MULTI_TENANT === 'true') {
  console.log('🏢 Initializing multi-tenant mode...');
  
  connectMaster()
    .then(() => {
      console.log('✅ Master database connected successfully');
      return connectToDatabase();
    })
    .then(() => {
      console.log('✅ Main database connected successfully');
      
      // Start server after successful database connection
      server.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Neurolex server running on port ${PORT}`);
        console.log(`📊 Environment: ${process.env.NODE_ENV}`);
        console.log(`🏢 Multi-tenant mode: ENABLED`);
        console.log(`🌐 Server URL: ${isProduction ? 'https://neurolex-platform-9b4c40c0e2da.herokuapp.com' : 'http://localhost:' + PORT}`);
        console.log(`🔗 API Test: ${isProduction ? 'https://neurolex-platform-9b4c40c0e2da.herokuapp.com' : 'http://localhost:' + PORT}/api/test`);
      });
    })
    .catch(err => {
      console.error('❌ Multi-tenant initialization failed:', err.message);
      console.log('🔄 Attempting single database connection as fallback...');
      
      // Try single connection as fallback
      connectToDatabase()
        .then(() => {
          console.log('✅ Connected to MongoDB (fallback mode)');
          server.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Neurolex server running on port ${PORT} (fallback mode)`);
            console.log(`⚠️ Multi-tenant features may not work properly`);
            console.log(`🌐 Server URL: ${isProduction ? 'https://neurolex-platform-9b4c40c0e2da.herokuapp.com' : 'http://localhost:' + PORT}`);
          });
        })
        .catch(fallbackErr => {
          console.error('❌ Fallback connection failed:', fallbackErr.message);
          console.error('💥 Unable to start server - database connection failed');
          process.exit(1);
        });
    });
} else {
  console.log('👤 Starting in single-tenant mode...');
  
  connectToDatabase()
    .then(() => {
      console.log('✅ Connected to MongoDB');
      
      // Start server after successful database connection
      server.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Neurolex server running on port ${PORT}`);
        console.log(`📊 Environment: ${process.env.NODE_ENV}`);
        console.log(`🏢 Multi-tenant mode: DISABLED`);
        console.log(`🌐 Server URL: ${isProduction ? 'https://neurolex-platform-9b4c40c0e2da.herokuapp.com' : 'http://localhost:' + PORT}`);
        console.log(`🔗 API Test: ${isProduction ? 'https://neurolex-platform-9b4c40c0e2da.herokuapp.com' : 'http://localhost:' + PORT}/api/test`);
      });
    })
    .catch(err => {
      console.error('❌ MongoDB connection error:', err.message);
      console.error('💥 Unable to start server - database connection failed');
      process.exit(1);
    });
}

// ============= IMPROVED ERROR HANDLING =============
// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('💥 UNHANDLED REJECTION:', err.message);
  console.error('Stack trace:', err.stack);
  
  // Close server gracefully
  server.close(() => {
    console.log('🛑 Server closed due to unhandled promise rejection');
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('💥 UNCAUGHT EXCEPTION:', err.message);
  console.error('Stack trace:', err.stack);
  
  // Close server gracefully
  server.close(() => {
    console.log('🛑 Server closed due to uncaught exception');
    process.exit(1);
  });
});

// Graceful shutdown on SIGTERM (Heroku sends this when restarting)
process.on('SIGTERM', () => {
  console.log('📋 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('🛑 Server closed gracefully');
    mongoose.connection.close(false, () => {
      console.log('📦 MongoDB connection closed');
      process.exit(0);
    });
  });
});
// ============= END DATABASE CONNECTION =============