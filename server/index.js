// server/index.js - MINIMAL VERSION TO FIX PATH-TO-REGEXP ERROR

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

// Import models
const User = require('./src/models/User');
const JournalEntry = require('./src/models/JournalEntry');

// Import middleware
const { protect } = require('./src/middleware/auth');

// ============= COMMENTED OUT ALL ROUTE IMPORTS TO ISOLATE THE ISSUE =============
// const doctorRoutes = require('./src/routes/doctorRoutes');
// const appointmentRoutes = require('./src/routes/appointmentRoutes');
// const adminRoutes = require('./src/routes/adminRoutes');
// const tenantRoutes = require('./src/routes/tenantRoutes');

console.log('✅ Minimal routes setup - no external route files loaded');

// Initialize express app
const app = express();

// Create HTTP server from Express app
const server = http.createServer(app);

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
      
      return callback(null, true); // Allow all for now
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

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later'
});

app.use('/api/auth', authLimiter);

// ============= MINIMAL TEST ROUTES ONLY =============
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

// ============= STATIC FILE SERVING =============
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
    
    // Handle client-side routing
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api')) {
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
  app.get('/', (req, res) => {
    res.json({ 
      success: true,
      message: 'Neurolex API Development Server',
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    });
  });
}

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

// ============= ERROR HANDLING =============
process.on('unhandledRejection', (err) => {
  console.error('💥 UNHANDLED REJECTION:', err.message);
  console.error('Stack trace:', err.stack);
  
  server.close(() => {
    console.log('🛑 Server closed due to unhandled promise rejection');
    process.exit(1);
  });
});

process.on('uncaughtException', (err) => {
  console.error('💥 UNCAUGHT EXCEPTION:', err.message);
  console.error('Stack trace:', err.stack);
  
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