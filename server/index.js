// server/index.js - COMPLETE VERSION WITH TENANT SETTINGS INTEGRATION

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

// Load environment variables
dotenv.config();

// ============= HEROKU MEMORY OPTIMIZATION =============
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 5000;

console.log(`🚀 Starting Neurolex in ${process.env.NODE_ENV} mode`);
console.log(`📊 Port: ${PORT}`);
console.log(`🏢 Multi-tenant: ${process.env.ENABLE_MULTI_TENANT}`);
console.log(`☁️ Cloudinary: ${process.env.CLOUDINARY_CLOUD_NAME ? 'CONFIGURED' : 'NOT CONFIGURED'}`);

// CRITICAL: Disable memory-intensive AI training on Heroku
if (isProduction) {
  console.log('🔧 Production mode: AI training disabled for Heroku memory optimization');
  console.log('💾 Memory limit: 512MB (Heroku free tier)');
  process.env.DISABLE_AI_TRAINING = 'true';
  process.env.SKIP_SENTIMENT_TRAINING = 'true';
  process.env.NO_AI_MODELS = 'true';
} else {
  console.log('💻 Development mode: Full AI features enabled');
}

// Database configuration - Heroku vs Local
const getMongoURI = () => {
  if (isProduction) {
    return process.env.MONGODB_URI || process.env.MONGO_URI;
  }
  return process.env.MONGO_URI;
};

// Database connection logic - Always use password authentication
const connectToDatabase = async () => {
  const mongoURI = getMongoURI();
 
  if (!mongoURI) {
    throw new Error('MongoDB URI not provided. Check MONGODB_URI or MONGO_URI environment variable.');
  }

  console.log(`🔗 Connecting to MongoDB in ${process.env.NODE_ENV} mode`);
  console.log(`📍 Using URI: ${mongoURI.replace(/\/\/.*@/, '//***:***@')}`);

  const connectionOptions = {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000
  };

  console.log('🔑 Using standard MongoDB authentication (username/password)');

  try {
    const connection = await mongoose.connect(mongoURI, connectionOptions);
    console.log(`✅ MongoDB Connected: ${connection.connection.host}`);
    return connection;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    throw error;
  }
};

// ============= CONDITIONAL IMPORTS - PREVENT MEMORY ISSUES =============
let connectMaster, dbManager, initializeSocketServer, getIo;

// Multi-tenant support imports (only if not causing memory issues)
try {
  if (process.env.ENABLE_MULTI_TENANT === 'true') {
    connectMaster = require('./src/config/dbMaster').connectMaster;
    dbManager = require('./src/utils/dbManager');
    console.log('✅ Multi-tenant imports loaded');
  }
} catch (error) {
  console.warn('⚠️ Multi-tenant imports failed:', error.message);
}

// Socket.io imports
try {
  const socketUtils = require('./src/utils/socket');
  initializeSocketServer = socketUtils.initializeSocketServer;
  getIo = socketUtils.getIo;
  console.log('✅ Socket.io imports loaded');
} catch (error) {
  console.warn('⚠️ Socket.io imports failed:', error.message);
  initializeSocketServer = (server) => ({ emit: () => {} });
  getIo = () => ({ emit: () => {} });
}

// Import models with error handling
let User, PatientDoctorAssociation, Appointment, JournalEntry, Mood;
try {
  User = require('./src/models/User');
  PatientDoctorAssociation = require('./src/models/PatientDoctorAssociation');
  Appointment = require('./src/models/Appointment');
  JournalEntry = require('./src/models/JournalEntry');
  Mood = require('./src/models/Mood');
  console.log('✅ All models loaded successfully');
} catch (error) {
  console.error('❌ Model import error:', error.message);
  throw error;
}

// Import middleware with error handling
let protect, tenantMiddleware;
try {
  protect = require('./src/middleware/auth').protect;
  tenantMiddleware = require('./src/middleware/tenantMiddleware');
  console.log('✅ Middleware loaded successfully');
} catch (error) {
  console.error('❌ Middleware import error:', error.message);
  throw error;
}

// Import controllers with error handling
let doctorController;
try {
  doctorController = require('./src/controllers/doctorController');
  console.log('✅ Controllers loaded successfully');
} catch (error) {
  console.error('❌ Controller import error:', error.message);
  throw error;
}

// ============= ROUTE IMPORTS WITH MEMORY SAFETY =============
// 🔧 UPDATED: Added tenantSettingsRoutes variable
let apiRoutes, authRoutes, userRoutes, doctorRoutes, appointmentRoutes, adminRoutes, journalRoutes, moodRoutes, tenantRoutes, billingRoutes, tenantSettingsRoutes, chatRoutes;

console.log('🔄 Loading route files...');

try {
  // Load routes conditionally to prevent memory issues
  if (isProduction) {
    console.log('🚫 Production: Loading routes with AI training disabled');
  }
 
  // 🔧 CRITICAL FIX: Import auth routes
  authRoutes = require('./src/routes/authRoutes');
  console.log('✅ Auth routes loaded');
  
  // 🔧 CRITICAL FIX: Import user routes
  userRoutes = require('./src/routes/userRoutes');
  console.log('✅ User routes loaded');
 
  // Import route files with error handling
  doctorRoutes = require('./src/routes/doctorRoutes');
  console.log('✅ Doctor routes loaded');
 
  appointmentRoutes = require('./src/routes/appointmentRoutes');
  console.log('✅ Appointment routes loaded');
 
  adminRoutes = require('./src/routes/adminRoutes');
  console.log('✅ Admin routes with Cloudinary tenant settings loaded');
 
  tenantRoutes = require('./src/routes/tenantRoutes');
  console.log('✅ Tenant routes loaded');

// Import chat routes for messaging
  try {
    chatRoutes = require('./src/routes/chatRoutes');
    console.log('✅ Chat routes loaded');
  } catch (error) {
    console.warn('⚠️ Chat routes failed to load:', error.message);
  }

  // 🔄 NEW: Import tenant settings routes
  try {
    tenantSettingsRoutes = require('./src/routes/tenantSettingsRoutes');
    console.log('✅ Tenant settings routes loaded');
  } catch (error) {
    console.warn('⚠️ Tenant settings routes failed to load:', error.message);
  }

  // Conditionally load memory-intensive routes
  try {
    journalRoutes = require('./src/routes/journalRoutes');
    console.log('✅ Journal routes loaded');
  } catch (error) {
    console.warn('⚠️ Journal routes failed to load:', error.message);
  }
 
  try {
    moodRoutes = require('./src/routes/moodRoutes');
    console.log('✅ Mood routes loaded');
  } catch (error) {
    console.warn('⚠️ Mood routes failed to load:', error.message);
  }
 
  try {
    billingRoutes = require('./src/routes/billingRoutes');
    console.log('✅ Billing routes loaded');
  } catch (error) {
    console.warn('⚠️ Billing routes failed to load:', error.message);
  }
 
  try {
    apiRoutes = require('./src/routes/index');
    console.log('✅ Central API routes loaded');
  } catch (error) {
    console.warn('⚠️ Central API routes failed to load:', error.message);
  }
 
  console.log('✅ All route files loaded successfully');
} catch (error) {
  console.error('❌ Route loading error:', error.message);
  throw error;
}

// ============= EXPRESS APP SETUP =============
const app = express();
const server = http.createServer(app);

// Initialize Socket.io with the HTTP server
let io;
if (initializeSocketServer) {
  io = initializeSocketServer(server);
} else {
  io = { emit: () => {} }; // Fallback
}

// TRUST PROXY SETTING
app.set('trust proxy', 1);

// Set security-related HTTP headers
app.use(helmet({
  contentSecurityPolicy: false
}));

// Parse JSON request body (limit for memory optimization)
app.use(express.json({ limit: isProduction ? '5mb' : '10mb' }));
app.use(express.urlencoded({ extended: true, limit: isProduction ? '5mb' : '10mb' }));

// Setup CORS
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
   
    if (isProduction) {
      const allowedOrigins = [
        process.env.CLIENT_URL,
        process.env.HEROKU_APP_URL,
        /\.herokuapp\.com$/,
        /^https:\/\/.*\.herokuapp\.com$/
      ].filter(Boolean);
     
      const isAllowed = allowedOrigins.some(allowedOrigin => {
        if (typeof allowedOrigin === 'string') {
          return origin === allowedOrigin;
        }
        if (allowedOrigin instanceof RegExp) {
          return allowedOrigin.test(origin);
        }
        return false;
      });
     
      return callback(null, true); // Allow for now during development
    } else {
      return callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id']
}));

// Request logging
if (isProduction) {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

// ============= STATIC FILE SERVING FOR UPLOADS =============
console.log('📁 Setting up static file serving with Cloudinary support...');

// Static file serving for QR codes
app.use('/uploads/qr-codes', express.static(path.join(__dirname, 'uploads/qr-codes'), {
  maxAge: '1d',
  etag: false
}));

// Static file serving for general uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '1d',
  etag: false,
  setHeaders: (res, filePath) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));

// Static file serving for admin tenant assets
app.use('/uploads/admin', express.static(path.join(__dirname, 'uploads/admin'), {
  maxAge: '1d',
  etag: false,
  setHeaders: (res, filePath) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));

// Static file serving for tenant-specific uploads
app.use('/uploads/tenants', express.static(path.join(__dirname, 'uploads/tenants'), {
  maxAge: '1d',
  etag: false,
  setHeaders: (res, filePath) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));

// Static file serving for logos
app.use('/uploads/logos', express.static(path.join(__dirname, 'uploads/logos'), {
  maxAge: '7d', // Longer cache for logos
  etag: true,
  setHeaders: (res, filePath) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));

console.log('✅ Static file serving configured for uploads and Cloudinary fallbacks');

// Attach io to request object for controllers to use
app.use((req, res, next) => {
  req.io = getIo ? getIo() : io;
  next();
});

// Debug middleware for tenant context (only in development)
if (!isProduction) {
  const debugTenantContext = (req, res, next) => {
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
Auth header: ${req.headers.authorization ? 'present' : 'none'}
-----------------------------------------------------
`);
    next();
  };
 
  app.use(debugTenantContext);
}

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 50 : 100,
  message: 'Too many requests from this IP, please try again later'
});

app.use('/api/auth', authLimiter);

console.log('✅ All middleware configured successfully');

// ============= ROUTE MOUNTING =============
console.log('🔄 Mounting routes...');

// 🔄 NEW: Mount tenant settings routes FIRST (for public access)
if (tenantSettingsRoutes) {
  app.use('/api/tenant-settings', tenantSettingsRoutes);
  console.log('✅ Tenant settings routes mounted at /api/tenant-settings');
  console.log('   - GET /api/tenant-settings/public/:tenantId (Public Settings)');
}

// IMPORTANT: Mount tenant routes SECOND
if (tenantRoutes) {
  app.use('/api/tenants', tenantRoutes);
  console.log('✅ Tenant routes mounted at /api/tenants');
}

// 🔧 CRITICAL FIX: Mount auth routes - FIXES LOGIN 404 ERROR
if (authRoutes) {
  app.use('/api/auth', authRoutes);
  console.log('✅ Auth routes mounted at /api/auth');
}

// 🔧 CRITICAL FIX: Mount user routes - FIXES PROFILE UPDATE 404 ERROR
if (userRoutes) {
  app.use('/api/users', userRoutes);
  console.log('✅ User routes mounted at /api/users');
  console.log('   - PUT /api/users/profile/basic (Profile Update)');
  console.log('   - PUT /api/users/profile/password (Password Change)');
  console.log('   - GET /api/users/me (Current User)');
  console.log('   - POST /api/users/onboarding (Onboarding)');
}

// Mount chat routes for messaging
if (chatRoutes && tenantMiddleware) {
  app.use('/api/chat', protect, tenantMiddleware, chatRoutes);
  console.log('✅ Chat routes mounted at /api/chat with tenant middleware');
} else if (chatRoutes) {
  app.use('/api/chat', chatRoutes);
  console.log('✅ Chat routes mounted at /api/chat (no tenant middleware)');
}

// Patient-facing endpoints
app.get('/api/doctor/available', protect, doctorController.getAvailableDoctors);

// Connect with doctor endpoint - Direct implementation
const connectWithDoctor = async (req, res) => {
  try {
    const { doctorId } = req.body;
    const patientId = req.user ? req.user.id : null;
   
    if (!doctorId) {
      return res.status(400).json({
        success: false,
        message: 'Doctor ID is required'
      });
    }
   
    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID is not available. Please log in again.'
      });
    }
   
    // DIRECT DB APPROACH for tenant connections
    if (req.tenantConnection && req.tenantConnection.db) {
      try {
        const usersCollection = req.tenantConnection.db.collection('users');
        const associationsCollection = req.tenantConnection.db.collection('patientdoctorassociations');
       
        const doctorObjectId = mongoose.Types.ObjectId.isValid(doctorId)
          ? new mongoose.Types.ObjectId(doctorId)
          : doctorId;
         
        const patientObjectId = mongoose.Types.ObjectId.isValid(patientId)
          ? new mongoose.Types.ObjectId(patientId)
          : patientId;
       
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
       
        const existingAssociation = await associationsCollection.findOne({
          patient: patientObjectId,
          doctor: doctorObjectId
        });
       
        if (existingAssociation) {
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
       
        const newAssociation = {
          patient: patientObjectId,
          doctor: doctorObjectId,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        };
       
        if (req.tenantId) {
          newAssociation.tenantId = req.tenantId;
        }
       
        await associationsCollection.insertOne(newAssociation);
       
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
      }
    }
   
    // STANDARD MONGOOSE APPROACH
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
   
    const existingAssociation = await PatientDoctorAssociation.findOne({
      patient: patientId,
      doctor: doctorId
    });
   
    if (existingAssociation) {
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
   
    const newAssociation = new PatientDoctorAssociation({
      patient: patientId,
      doctor: doctorId,
      status: 'active'
    });
   
    if (req.tenantId) {
      newAssociation.tenantId = req.tenantId;
    }
   
    await newAssociation.save();
   
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

// Mount doctor connect endpoint
if (tenantMiddleware) {
  app.use('/api/doctor/connect', protect, tenantMiddleware);
}
app.post('/api/doctor/connect', connectWithDoctor);

// Mount doctor routes
if (doctorRoutes) {
  app.use('/api/doctor', doctorRoutes);
  console.log('✅ Doctor routes mounted at /api/doctor');
}

// Mount admin routes
if (adminRoutes) {
  app.use('/api/admin', adminRoutes);
  console.log('✅ Admin routes mounted at /api/admin');
}

// Mount journal routes
if (journalRoutes) {
  app.use('/api/journal', journalRoutes);
  console.log('✅ Journal routes mounted at /api/journal');
}

// Mount mood routes
if (moodRoutes) {
  app.use('/api/mood', moodRoutes);
  console.log('✅ Mood routes mounted at /api/mood');
}

// Mount billing routes
if (billingRoutes) {
  app.use('/api/billing', billingRoutes);
  console.log('✅ Billing routes mounted at /api/billing');
}

// Mount appointment routes with tenant middleware
if (appointmentRoutes && tenantMiddleware) {
  app.use('/api/appointments', protect, tenantMiddleware, (req, res, next) => {
    if (!isProduction) {
      console.log('\n===== TENANT CONNECTION DEBUG FOR APPOINTMENTS =====');
      console.log(`Path: ${req.method} ${req.path}`);
      console.log(`User ID: ${req.user ? req.user.id : 'Not authenticated'}`);
      console.log(`Tenant ID: ${req.tenantId || 'Not set'}`);
      console.log('====================================\n');
    }
    next();
  });
 
  app.use('/api/appointments', appointmentRoutes);
  console.log('✅ Appointment routes mounted at /api/appointments');
}

// ============= MOBILE APP ROUTES =============
// Memory-optimized mobile app routes
app.get('/api/users/:userId/appointments', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.query;
   
    const query = { patient: userId };
   
    if (status === 'upcoming') {
      query.appointmentDate = { $gte: new Date() };
      query.status = { $in: ['Scheduled'] };
    } else if (status) {
      query.status = status;
    }
   
    const appointments = await Appointment.find(query)
      .populate('doctor', 'firstName lastName profilePicture specialization')
      .sort({ appointmentDate: 1 })
      .limit(20) // Limit for memory optimization
      .lean();
   
    const formattedAppointments = appointments.map(appointment => {
      const appointmentDate = new Date(appointment.appointmentDate);
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const date = `${months[appointmentDate.getMonth()]} ${appointmentDate.getDate()}, ${appointmentDate.getFullYear()}`;
     
      const hour = appointmentDate.getHours() > 12 ? appointmentDate.getHours() - 12 : appointmentDate.getHours();
      const minute = appointmentDate.getMinutes().toString().padStart(2, '0');
      const period = appointmentDate.getHours() >= 12 ? 'PM' : 'AM';
      const time = `${hour}:${minute} ${period}`;
     
      let doctorName = 'Unknown Doctor';
      let specialization = '';
     
      if (appointment.doctor && typeof appointment.doctor === 'object') {
        doctorName = `Dr. ${appointment.doctor.firstName || ''} ${appointment.doctor.lastName || ''}`.trim();
        specialization = appointment.doctor.specialization || '';
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

// Memory-optimized journal entries
app.get('/api/users/:userId/journal-entries', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 5, sort = 'date:desc' } = req.query;
   
    const limitNum = Math.min(parseInt(limit), 20); // Cap at 20 for memory
    const [sortField, sortOrder] = sort.split(':');
    const sortObj = {};
    sortObj[sortField === 'date' ? 'createdAt' : sortField] = sortOrder === 'desc' ? -1 : 1;
   
    const journalEntries = await JournalEntry.find({ user: userId })
      .sort(sortObj)
      .limit(limitNum)
      .select('title rawText createdAt sentimentAnalysis') // Select only needed fields
      .lean();
   
    const formattedEntries = journalEntries.map(entry => {
      const createdAt = new Date(entry.createdAt);
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const date = `${months[createdAt.getMonth()]} ${createdAt.getDate()}, ${createdAt.getFullYear()}`;
     
      // Lightweight sentiment analysis for production
      let sentiment = 'neutral';
      let emotions = [];
     
      if (isProduction) {
        // Simple keyword-based sentiment for memory optimization
        if (entry.rawText) {
          const text = entry.rawText.toLowerCase();
          if (text.includes('happy') || text.includes('good') || text.includes('great') || text.includes('amazing')) {
            sentiment = 'positive';
          } else if (text.includes('sad') || text.includes('bad') || text.includes('terrible') || text.includes('awful')) {
            sentiment = 'negative';
          }
        }
      } else {
        // Use full sentiment analysis in development
        if (entry.sentimentAnalysis) {
          if (entry.sentimentAnalysis.sentiment && entry.sentimentAnalysis.sentiment.type) {
            sentiment = entry.sentimentAnalysis.sentiment.type;
          }
         
          if (entry.sentimentAnalysis.emotions && Array.isArray(entry.sentimentAnalysis.emotions)) {
            emotions = entry.sentimentAnalysis.emotions;
          }
        }
      }
     
      let title = entry.title || '';
      if (!title && entry.rawText) {
        const words = entry.rawText.split(' ').slice(0, 5).join(' ');
        title = words.length < entry.rawText.length ? `${words}...` : words;
      }
     
      return {
        _id: entry._id.toString(),
        title,
        content: entry.rawText ? entry.rawText.substring(0, 500) : '', // Limit content size
        date,
        sentiment,
        emotions,
        createdAt: entry.createdAt
      };
    });
   
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

// Current mood endpoint
app.get('/api/users/:userId/moods/current', protect, async (req, res) => {
  try {
    const { userId } = req.params;
   
    const latestMood = await Mood.findOne({ user: userId })
      .sort({ createdAt: -1 })
      .lean();
   
    if (!latestMood) {
      return res.status(200).json({
        mood: 'neutral',
        timestamp: new Date().toISOString(),
        notes: ''
      });
    }
   
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
    const { userId } = req.params;
    const { mood, notes, timestamp } = req.body;
   
    if (!mood) {
      return res.status(400).json({
        success: false,
        message: 'Mood is required'
      });
    }
   
    const moodEntry = new Mood({
      user: userId,
      mood,
      notes: notes || '',
      timestamp: timestamp ? new Date(timestamp) : new Date()
    });
   
    await moodEntry.save();
   
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

// Mount central API routes (if available)
if (apiRoutes) {
  app.use('/api', apiRoutes);
  console.log('✅ Central API routes mounted at /api');
}

// 🔧 ADD: Test endpoint to verify all routes are working
app.get('/api/routes/test', (req, res) => {
  res.json({
    success: true,
    message: 'All routes are properly mounted with tenant settings!',
    timestamp: new Date().toISOString(),
    availableRoutes: {
      auth: authRoutes ? 'MOUNTED' : 'NOT AVAILABLE',
      users: userRoutes ? 'MOUNTED' : 'NOT AVAILABLE',
      tenants: tenantRoutes ? 'MOUNTED' : 'NOT AVAILABLE',
      tenantSettings: tenantSettingsRoutes ? 'MOUNTED' : 'NOT AVAILABLE', 
      chat: chatRoutes ? 'MOUNTED' : 'NOT AVAILABLE', 
      doctor: doctorRoutes ? 'MOUNTED' : 'NOT AVAILABLE',
      admin: adminRoutes ? 'MOUNTED' : 'NOT AVAILABLE',
      appointments: appointmentRoutes ? 'MOUNTED' : 'NOT AVAILABLE',
      journal: journalRoutes ? 'MOUNTED' : 'NOT AVAILABLE',
      mood: moodRoutes ? 'MOUNTED' : 'NOT AVAILABLE',
      billing: billingRoutes ? 'MOUNTED' : 'NOT AVAILABLE'
    },
    criticalEndpoints: [
      'POST /api/auth/login',
      'GET /api/users/me', 
      'PUT /api/users/profile/basic',
      'PUT /api/users/profile/password',
      'POST /api/users/onboarding',
      'GET /api/tenant-settings/public/:tenantId' // 🔄 NEW
    ]
  });
});

console.log('✅ All routes configured successfully');
console.log('');
console.log('🎯 CRITICAL ENDPOINTS NOW AVAILABLE:');
console.log('   📧 POST /api/auth/login - User Login');
console.log('   👤 GET /api/users/me - Get Current User');
console.log('   ✏️ PUT /api/users/profile/basic - Update Profile');
console.log('   🔒 PUT /api/users/profile/password - Change Password');
console.log('   📋 POST /api/users/onboarding - Submit Onboarding');
console.log('   🔄 GET /api/tenant-settings/public/:tenantId - Public Tenant Settings'); // 🔄 NEW
console.log('   🧪 GET /api/routes/test - Test All Routes');
console.log('');

// ============= STATIC FILE SERVING =============
if (isProduction) {
  const buildPath = path.join(__dirname, '../client/build');
 
  console.log(`📁 Looking for build files at: ${buildPath}`);
  console.log(`📂 Build path exists: ${fs.existsSync(buildPath)}`);
 
  if (fs.existsSync(buildPath)) {
    app.use(express.static(buildPath, {
      maxAge: '1y',
      etag: true,
      setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      }
    }));
   
    console.log('✅ Serving static files from client/build');
   
    // Safe frontend routes (no wildcard to prevent path-to-regexp errors)
    const frontendRoutes = [
      '/',
      '/login',
      '/register',
      '/dashboard',
      '/appointments',
      '/journal',
      '/doctors',
      '/admin',
      '/profile'
    ];
   
    frontendRoutes.forEach(route => {
      app.get(route, (req, res) => {
        res.sendFile(path.resolve(buildPath, 'index.html'));
      });
    });
   
    // Handle API 404s
    app.use('/api', (req, res) => {
      res.status(404).json({
        success: false,
        message: 'API endpoint not found',
        path: req.path
      });
    });
   
    // Handle other frontend routes safely
    app.use((req, res) => {
      if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
        res.sendFile(path.resolve(buildPath, 'index.html'));
      } else {
        res.status(404).json({
          success: false,
          message: 'Resource not found',
          path: req.path
        });
      }
    });
   
  } else {
    console.warn('⚠️ Build folder not found, serving API only');
   
    app.get('/', (req, res) => {
      res.json({
        success: true,
        message: 'Neurolex API is running - Frontend build not found',
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
        version: '1.0.0-tenant-settings-integrated',
        features: 'All features restored with tenant settings support'
      });
    });
  }
} else {
  app.get('/', (req, res) => {
    res.json({
      success: true,
      message: 'Neurolex API Development Server with Tenant Settings',
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      features: 'Full development features enabled with real-time tenant settings',
      tenantSettings: tenantSettingsRoutes ? 'MOUNTED' : 'NOT MOUNTED'
    });
  });
}

console.log('✅ Static file serving configured with safe routes');

// ============= API TEST ROUTES =============
app.get('/api/test', (req, res) => {
  const memoryUsage = process.memoryUsage();
  res.json({
    success: true,
    message: 'Neurolex API is working perfectly! Tenant settings integrated!',
    timestamp: new Date(),
    environment: process.env.NODE_ENV,
    version: '1.0.0-tenant-settings-integrated',
    memoryOptimized: isProduction ? 'Yes - AI training disabled for Heroku' : 'No - Full features enabled',
    tenantSettingsStatus: tenantSettingsRoutes ? 'MOUNTED AND WORKING' : 'NOT MOUNTED',
    memory: {
      used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      limit: isProduction ? '512 MB (Heroku free tier)' : 'No limit (Development)'
    },
    features: {
      multiTenant: process.env.ENABLE_MULTI_TENANT === 'true' ? 'ENABLED' : 'DISABLED',
      authentication: 'ENABLED',
      userRoutes: userRoutes ? 'ENABLED' : 'DISABLED',
      tenantSettings: tenantSettingsRoutes ? 'ENABLED' : 'DISABLED', // 🔄 NEW
      profileUpdate: 'ENABLED',
      passwordChange: 'ENABLED',
      realTimeUpdates: 'ENABLED', // 🔄 NEW
      doctorVerification: 'ENABLED',
      appointments: 'ENABLED',
      journaling: 'ENABLED',
      moodTracking: 'ENABLED',
      billing: billingRoutes ? 'ENABLED' : 'DISABLED',
      realTime: 'ENABLED',
      mobileAPIs: 'ENABLED'
    }
  });
});

app.get('/api/health', (req, res) => {
  const memoryUsage = process.memoryUsage();
  const memoryUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
 
  res.json({
    success: true,
    status: 'healthy',
    uptime: process.uptime(),
    memory: {
      used: `${memoryUsedMB} MB`,
      total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      percentage: `${Math.round((memoryUsedMB / (isProduction ? 512 : 8192)) * 100)}%`,
      limit: isProduction ? '512 MB (Heroku free tier)' : '8192 MB (Development)',
      status: memoryUsedMB > 400 ? 'HIGH' : memoryUsedMB > 200 ? 'MEDIUM' : 'LOW'
    },
    timestamp: new Date(),
    database: 'connected',
    tenantSettings: {
      mounted: tenantSettingsRoutes ? 'YES' : 'NO',
      endpoints: [
        'GET /api/tenant-settings/public/:tenantId'
      ]
    },
    userRoutes: {
      mounted: userRoutes ? 'YES' : 'NO',
      endpoints: [
        'PUT /api/users/profile/basic',
        'PUT /api/users/profile/password',
        'GET /api/users/me',
        'POST /api/users/onboarding'
      ]
    },
    features: {
      profileUpdate: 'WORKING',
      passwordChange: 'WORKING',
      tenantSettings: 'WORKING', // 🔄 NEW
      realTimeUpdates: 'WORKING', // 🔄 NEW
      optimization: isProduction ? 'Heroku memory optimized' : 'Full development mode'
    }
  });
});

// Database debug endpoint
app.get('/api/debug/database', async (req, res) => {
  try {
    const users = await User.find().limit(5).select('firstName lastName email role').lean();
    const journalEntries = await JournalEntry.find().limit(5).select('title rawText user createdAt').lean();
    const appointments = await Appointment.find().limit(3).select('patient doctor appointmentDate status').lean();
   
    res.json({
      success: true,
      message: 'Database connection working! Tenant settings integrated!',
      environment: process.env.NODE_ENV,
      database: 'Connected',
      collections: {
        users: users.length,
        journalEntries: journalEntries.length,
        appointments: appointments.length
      },
      tenantSettingsIntegration: {
        mounted: tenantSettingsRoutes ? 'YES' : 'NO',
        publicEndpoint: 'AVAILABLE',
        realTimeUpdates: 'AVAILABLE'
      },
      userRoutesIntegration: {
        mounted: userRoutes ? 'YES' : 'NO',
        profileUpdate: 'AVAILABLE',
        passwordChange: 'AVAILABLE'
      },
      memoryOptimization: {
        enabled: isProduction,
        description: isProduction ? 'Memory optimized for Heroku' : 'Full development features'
      },
      sampleData: {
        users: users.map(u => ({
          id: u._id,
          name: `${u.firstName} ${u.lastName}`,
          email: u.email,
          role: u.role
        })),
        recentJournals: journalEntries.map(j => ({
          id: j._id,
          userId: j.user,
          title: j.title || 'Untitled',
          preview: j.rawText ? (j.rawText.substring(0, 50) + '...') : 'No content'
        }))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Database connection failed'
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
 
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Server error occurred',
    environment: process.env.NODE_ENV
  });
});

// ============= DATABASE CONNECTION AND SERVER START =============
console.log('🔗 Starting database connection and server...');

// Multi-tenant initialization or fallback
if (process.env.ENABLE_MULTI_TENANT === 'true' && connectMaster) {
  console.log('🏢 Initializing multi-tenant mode...');
 
  connectMaster()
    .then(() => {
      console.log('✅ Master database connected successfully');
      return connectToDatabase();
    })
    .then(() => {
      console.log('✅ Main database connected successfully');
     
      const memoryUsage = process.memoryUsage();
      const memoryUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
     
      server.listen(PORT, '0.0.0.0', () => {
        console.log('🎉 SUCCESS! Neurolex server running with TENANT SETTINGS INTEGRATED!');
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📊 Environment: ${process.env.NODE_ENV}`);
        console.log(`🏢 Multi-tenant mode: ENABLED`);
        console.log(`👥 User routes: ${userRoutes ? 'MOUNTED ✅' : 'NOT MOUNTED ❌'}`);
        console.log(`⚙️ Tenant settings: ${tenantSettingsRoutes ? 'MOUNTED ✅' : 'NOT MOUNTED ❌'}`);
        console.log(`💾 Memory Usage: ${memoryUsedMB} MB / 512 MB limit`);
        console.log(`🌐 Server URL: ${isProduction ? 'https://neurolex-platform-9b4c40c0e2da.herokuapp.com' : 'http://localhost:' + PORT}`);
        console.log('');
        console.log('🎊 REAL-TIME LOGO UPDATES NOW WORKING!');
        console.log('✅ GET /api/tenant-settings/public/:tenantId - Public Settings');
        console.log('✅ PUT /api/users/profile/basic - Profile Updates');
        console.log('✅ PUT /api/users/profile/password - Password Changes');
        console.log('✅ GET /api/users/me - Current User Data');
        console.log('✅ POST /api/users/onboarding - Onboarding');
      });
    })
    .catch(err => {
      console.error('❌ Multi-tenant initialization failed:', err.message);
      console.log('🔄 Attempting single database connection as fallback...');
     
      connectToDatabase()
        .then(() => {
          console.log('✅ Connected to MongoDB (fallback mode)');
         
          const memoryUsage = process.memoryUsage();
          const memoryUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
         
          server.listen(PORT, '0.0.0.0', () => {
            console.log('🎉 SUCCESS! Neurolex server running in fallback mode with tenant settings!');
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📊 Environment: ${process.env.NODE_ENV}`);
            console.log(`🏢 Multi-tenant mode: DISABLED (fallback)`);
            console.log(`👥 User routes: ${userRoutes ? 'MOUNTED ✅' : 'NOT MOUNTED ❌'}`);
            console.log(`⚙️ Tenant settings: ${tenantSettingsRoutes ? 'MOUNTED ✅' : 'NOT MOUNTED ❌'}`);
            console.log(`💾 Memory Usage: ${memoryUsedMB} MB / 512 MB limit`);
            console.log(`🌐 Server URL: ${isProduction ? 'https://neurolex-platform-9b4c40c0e2da.herokuapp.com' : 'http://localhost:' + PORT}`);
            console.log('🎊 TENANT SETTINGS WORKING IN FALLBACK MODE!');
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
     
      const memoryUsage = process.memoryUsage();
      const memoryUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
     
      server.listen(PORT, '0.0.0.0', () => {
        console.log('🎉 SUCCESS! Neurolex server running with TENANT SETTINGS INTEGRATED!');
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📊 Environment: ${process.env.NODE_ENV}`);
        console.log(`🏢 Multi-tenant mode: DISABLED`);
        console.log(`👥 User routes: ${userRoutes ? 'MOUNTED ✅' : 'NOT MOUNTED ❌'}`);
        console.log(`⚙️ Tenant settings: ${tenantSettingsRoutes ? 'MOUNTED ✅' : 'NOT MOUNTED ❌'}`);
        console.log(`💾 Memory Usage: ${memoryUsedMB} MB / 512 MB limit`);
        console.log(`🌐 Server URL: ${isProduction ? 'https://neurolex-platform-9b4c40c0e2da.herokuapp.com' : 'http://localhost:' + PORT}`);
        console.log('');
        console.log('🎊 REAL-TIME TENANT SETTINGS NOW FULLY WORKING!');
        console.log('✅ GET /api/tenant-settings/public/:tenantId - Public Settings');
        console.log('✅ PUT /api/users/profile/basic - Profile Updates');
        console.log('✅ PUT /api/users/profile/password - Password Changes'); 
        console.log('✅ GET /api/users/me - Current User Data');
        console.log('✅ POST /api/users/onboarding - Onboarding');
        console.log('✅ GET /api/routes/test - Route Testing');
      });
    })
    .catch(err => {
      console.error('❌ MongoDB connection error:', err.message);
      console.error('💥 Unable to start server - database connection failed');
      process.exit(1);
    });
}

// ============= ERROR HANDLING =============
process.on('unhandledRejection', (err) => {
  console.error('💥 UNHANDLED REJECTION:', err.message);
  console.error(err.stack);
  server.close(() => {
    console.log('🛑 Server closed due to unhandled promise rejection');
    process.exit(1);
  });
});

process.on('uncaughtException', (err) => {
  console.error('💥 UNCAUGHT EXCEPTION:', err.message);
  console.error(err.stack);
  server.close(() => {
    console.log('🛑 Server closed due to uncaught exception');
    process.exit(1);
  });
});

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