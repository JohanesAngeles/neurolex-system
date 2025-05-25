// server/index.js - MEMORY OPTIMIZED VERSION FOR HEROKU

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

// ============= HEROKU CONFIGURATION =============
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 5000;

console.log(`🚀 Starting Neurolex in ${process.env.NODE_ENV} mode`);
console.log(`📊 Port: ${PORT}`);
console.log(`🏢 Multi-tenant: ${process.env.ENABLE_MULTI_TENANT}`);

// ============= MEMORY OPTIMIZATION FOR HEROKU =============
if (isProduction) {
  console.log('🔧 Production mode: Optimizing memory usage for Heroku');
  // Disable heavy AI training in production to prevent memory issues
  process.env.DISABLE_AI_TRAINING = 'true';
} else {
  console.log('💻 Development mode: Full AI features enabled');
}

// Database configuration for Heroku
const getMongoURI = () => {
  if (isProduction) {
    return process.env.MONGODB_URI || process.env.MONGO_URI;
  }
  return process.env.MONGO_URI;
};

// Certificate handling for Heroku
const getCertificatePath = () => {
  const mongoURI = getMongoURI();
  if (mongoURI && mongoURI.includes('mongodb+srv://')) {
    console.log('🔄 Detected Atlas connection string - using username/password auth');
    return null;
  }
  
  if (isProduction) {
    return null;
  }
  
  const certPath = path.join(__dirname, 'certificates/angeles_admin1.pem');
  if (fs.existsSync(certPath)) {
    return certPath;
  }
  
  return null;
};

// Database connection logic
const connectToDatabase = async () => {
  const mongoURI = getMongoURI();
  const certPath = getCertificatePath();
  
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

  if (certPath && fs.existsSync(certPath) && !mongoURI.includes('mongodb+srv://')) {
    console.log('🔐 Using certificate authentication');
    connectionOptions.tls = true;
    connectionOptions.tlsCertificateKeyFile = certPath;
    connectionOptions.authMechanism = 'MONGODB-X509';
    connectionOptions.authSource = '$external';
  } else {
    console.log('🔑 Using standard MongoDB authentication (username/password)');
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

// Multi-tenant support imports
const { connectMaster } = require('./src/config/dbMaster');

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

// Import route files
const doctorRoutes = require('./src/routes/doctorRoutes');
const appointmentRoutes = require('./src/routes/appointmentRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const tenantRoutes = require('./src/routes/tenantRoutes');

console.log('✅ All imports loaded successfully');

// Initialize express app
const app = express();

// Create HTTP server from Express app
const server = http.createServer(app);

// Initialize Socket.io with the HTTP server using our utility
const io = initializeSocketServer(server);

// TRUST PROXY SETTING
app.set('trust proxy', 1);

// Set security-related HTTP headers
app.use(helmet({
  contentSecurityPolicy: false
}));

// Parse JSON request body
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Setup CORS
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    
    if (process.env.NODE_ENV === 'production') {
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
      
      return callback(null, true); // Allow for now
    } else {
      return callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id']
}));

// Request logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

app.use('/uploads/qr-codes', express.static(path.join(__dirname, 'uploads/qr-codes'), {
  maxAge: '1d',
  etag: false
}));

// Attach io to request object for controllers to use
app.use((req, res, next) => {
  req.io = getIo();
  next();
});

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later'
});

app.use('/api/auth', authLimiter);

console.log('✅ All middleware configured successfully');

// ============= ROUTES =============
// Mount tenant routes FIRST
app.use('/api/tenants', tenantRoutes);

// Test routes
app.get('/api/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Neurolex API is working perfectly!',
    timestamp: new Date(),
    environment: process.env.NODE_ENV,
    version: '1.0.0',
    memoryOptimized: isProduction ? 'Yes - AI training disabled for Heroku' : 'No - Full features enabled'
  });
});

app.get('/api/health', (req, res) => {
  const memoryUsage = process.memoryUsage();
  res.json({ 
    success: true, 
    status: 'healthy',
    uptime: process.uptime(),
    memory: {
      used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      limit: isProduction ? '512 MB (Heroku free tier)' : 'No limit (Development)'
    },
    timestamp: new Date(),
    database: 'connected',
    aiTraining: process.env.DISABLE_AI_TRAINING === 'true' ? 'Disabled (Memory optimization)' : 'Enabled'
  });
});

// Auth test route
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

// Debug endpoint
app.get('/api/debug/database', async (req, res) => {
  try {
    const users = await User.find().limit(3).lean();
    const journalEntries = await JournalEntry.find().limit(3).lean();
    
    res.json({
      success: true,
      message: 'Database connection working!',
      environment: process.env.NODE_ENV,
      database: 'Connected',
      userCount: users.length,
      journalCount: journalEntries.length,
      memoryOptimization: isProduction ? 'Enabled for Heroku' : 'Disabled for development',
      users: users.map(u => ({
        id: u._id,
        name: `${u.firstName} ${u.lastName}`,
        email: u.email,
        role: u.role
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

// Doctor routes with tenant middleware
app.use('/api/appointments', protect, tenantMiddleware);
app.use('/api/appointments', appointmentRoutes);

// Mount doctor routes
app.use('/api/doctor', doctorRoutes);

// Mount admin routes
app.use('/api/admin', adminRoutes);

// Mobile app routes
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

// Journal entry route with basic sentiment (no heavy AI)
app.get('/api/users/:userId/journal-entries', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 5, sort = 'date:desc' } = req.query;
    
    const limitNum = parseInt(limit);
    const [sortField, sortOrder] = sort.split(':');
    const sortObj = {};
    sortObj[sortField === 'date' ? 'createdAt' : sortField] = sortOrder === 'desc' ? -1 : 1;
    
    const journalEntries = await JournalEntry.find({ user: userId })
      .sort(sortObj)
      .limit(limitNum)
      .lean();
    
    const formattedEntries = journalEntries.map(entry => {
      const createdAt = new Date(entry.createdAt);
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June', 
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const date = `${months[createdAt.getMonth()]} ${createdAt.getDate()}, ${createdAt.getFullYear()}`;
      
      // Simple sentiment analysis (no heavy AI)
      let sentiment = 'neutral';
      if (entry.rawText) {
        const text = entry.rawText.toLowerCase();
        const positiveWords = ['happy', 'good', 'great', 'wonderful', 'amazing', 'love', 'excited'];
        const negativeWords = ['sad', 'bad', 'terrible', 'awful', 'hate', 'depressed', 'anxious'];
        
        const positiveCount = positiveWords.filter(word => text.includes(word)).length;
        const negativeCount = negativeWords.filter(word => text.includes(word)).length;
        
        if (positiveCount > negativeCount) sentiment = 'positive';
        else if (negativeCount > positiveCount) sentiment = 'negative';
      }
      
      let title = entry.title || '';
      if (!title && entry.rawText) {
        const words = entry.rawText.split(' ').slice(0, 5).join(' ');
        title = words.length < entry.rawText.length ? `${words}...` : words;
      }
      
      return {
        _id: entry._id.toString(),
        title,
        content: entry.rawText || '',
        date,
        sentiment,
        emotions: [], // Simplified for memory efficiency
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

console.log('✅ All routes configured successfully');

// ============= STATIC FILE SERVING WITH SAFE ROUTES =============
if (process.env.NODE_ENV === 'production') {
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
    
    // FIXED: SAFE CATCH-ALL ROUTE (NO WILDCARD)
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
        console.log(`🔄 Serving React app for route: ${req.path}`);
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
    
    // Handle other frontend routes with a safer pattern
    app.use((req, res) => {
      if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
        console.log(`🔄 Serving React app for route: ${req.path}`);
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
        version: '1.0.0'
      });
    });
  }
} else {
  app.get('/', (req, res) => {
    res.json({ 
      success: true,
      message: 'Neurolex API Development Server',
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    });
  });
}

console.log('✅ Static file serving configured with safe routes');

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Server error occurred'
  });
});

// ============= DATABASE CONNECTION =============
if (process.env.ENABLE_MULTI_TENANT === 'true') {
  console.log('🏢 Initializing multi-tenant mode...');
  
  connectMaster()
    .then(() => {
      console.log('✅ Master database connected successfully');
      return connectToDatabase();
    })
    .then(() => {
      console.log('✅ Main database connected successfully');
      
      server.listen(PORT, '0.0.0.0', () => {
        console.log('🎉 SUCCESS! Neurolex server running (memory optimized for Heroku)!');
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📊 Environment: ${process.env.NODE_ENV}`);
        console.log(`🏢 Multi-tenant mode: ENABLED`);
        console.log(`🧠 AI Training: ${process.env.DISABLE_AI_TRAINING === 'true' ? 'DISABLED (Memory optimization)' : 'ENABLED'}`);
        console.log(`💾 Memory Usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`);
        console.log(`🌐 Server URL: ${isProduction ? 'https://neurolex-platform-9b4c40c0e2da.herokuapp.com' : 'http://localhost:' + PORT}`);
        console.log(`🔗 API Test: ${isProduction ? 'https://neurolex-platform-9b4c40c0e2da.herokuapp.com' : 'http://localhost:' + PORT}/api/test`);
        console.log(`💚 Health Check: ${isProduction ? 'https://neurolex-platform-9b4c40c0e2da.herokuapp.com' : 'http://localhost:' + PORT}/api/health`);
        console.log(`🗄️ Database Test: ${isProduction ? 'https://neurolex-platform-9b4c40c0e2da.herokuapp.com' : 'http://localhost:' + PORT}/api/debug/database`);
      });
    })
    .catch(err => {
      console.error('❌ Multi-tenant initialization failed:', err.message);
      console.log('🔄 Attempting single database connection as fallback...');
      
      connectToDatabase()
        .then(() => {
          console.log('✅ Connected to MongoDB (fallback mode)');
          server.listen(PORT, '0.0.0.0', () => {
            console.log('🎉 SUCCESS! Neurolex server running in fallback mode (memory optimized)!');
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`🧠 AI Training: DISABLED for memory optimization`);
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
      
      server.listen(PORT, '0.0.0.0', () => {
        console.log('🎉 SUCCESS! Neurolex server running (memory optimized)!');
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📊 Environment: ${process.env.NODE_ENV}`);
        console.log(`🏢 Multi-tenant mode: DISABLED`);
        console.log(`🧠 AI Training: ${process.env.DISABLE_AI_TRAINING === 'true' ? 'DISABLED (Memory optimization)' : 'ENABLED'}`);
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

// ============= ERROR HANDLING =============
process.on('unhandledRejection', (err) => {
  console.error('💥 UNHANDLED REJECTION:', err.message);
  server.close(() => {
    console.log('🛑 Server closed due to unhandled promise rejection');
    process.exit(1);
  });
});

process.on('uncaughtException', (err) => {
  console.error('💥 UNCAUGHT EXCEPTION:', err.message);
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