// server/index.js - NUCLEAR OPTION: STRIP EVERYTHING FOR HEROKU DEPLOYMENT

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');
const http = require('http');

// Load environment variables
dotenv.config();

// ============= HEROKU CONFIGURATION =============
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 5000;

console.log(`🚀 Starting Neurolex in ${process.env.NODE_ENV} mode`);
console.log(`📊 Port: ${PORT}`);

// ============= NUCLEAR OPTION: NO ROUTE FILES IN PRODUCTION =============
if (isProduction) {
  console.log('🚨 NUCLEAR OPTION: All route files disabled for Heroku memory optimization');
  console.log('💾 Memory limit: 512MB (Heroku free tier)');
}

// Database configuration for Heroku
const getMongoURI = () => {
  if (isProduction) {
    return process.env.MONGODB_URI || process.env.MONGO_URI;
  }
  return process.env.MONGO_URI;
};

// Database connection logic
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

// ============= MINIMAL IMPORTS ONLY =============
// Only import what's absolutely necessary
const User = require('./src/models/User');

console.log('✅ Core models loaded (no route files loaded)');

// Initialize express app
const app = express();
const server = http.createServer(app);

// TRUST PROXY SETTING
app.set('trust proxy', 1);

// Set security-related HTTP headers (minimal config)
app.use(helmet({
  contentSecurityPolicy: false
}));

// Parse JSON request body (small limit)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Setup CORS (simple config)
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
}));

// Request logging (only in development)
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

console.log('✅ Minimal middleware configured');

// ============= MINIMAL ROUTES ONLY =============
// Test routes
app.get('/api/test', (req, res) => {
  const memoryUsage = process.memoryUsage();
  res.json({ 
    success: true, 
    message: 'Neurolex API is working - NUCLEAR OPTION DEPLOYED!',
    timestamp: new Date(),
    environment: process.env.NODE_ENV,
    version: '1.0.0-nuclear',
    status: 'All route files disabled to prevent memory issues',
    memory: {
      used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      limit: isProduction ? '512 MB (Heroku free tier)' : 'No limit (Development)'
    },
    message2: 'Once this works, we will add features back gradually'
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
      percentage: `${Math.round((memoryUsedMB / (isProduction ? 512 : 8192)) * 100)}%`,
      status: memoryUsedMB > 400 ? 'HIGH' : memoryUsedMB > 200 ? 'MEDIUM' : 'LOW'
    },
    timestamp: new Date(),
    database: 'connected',
    deployment: 'Nuclear option - all features disabled for memory optimization'
  });
});

// Database test route
app.get('/api/debug/database', async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    
    res.json({
      success: true,
      message: 'Database connection working!',
      environment: process.env.NODE_ENV,
      database: 'Connected',
      userCount: userCount,
      status: 'Nuclear option deployed - AI training completely removed'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Database connection failed'
    });
  }
});

console.log('✅ Minimal routes configured');

// ============= STATIC FILE SERVING (PRODUCTION ONLY) =============
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, '../client/build');
  
  console.log(`📁 Looking for build files at: ${buildPath}`);
  console.log(`📂 Build path exists: ${fs.existsSync(buildPath)}`);
  
  if (fs.existsSync(buildPath)) {
    app.use(express.static(buildPath, {
      maxAge: '1y',
      etag: true
    }));
    
    console.log('✅ Serving static files from client/build');
    
    // Simple frontend routes
    app.get('/', (req, res) => {
      res.sendFile(path.resolve(buildPath, 'index.html'));
    });
    
    app.get('/login', (req, res) => {
      res.sendFile(path.resolve(buildPath, 'index.html'));
    });
    
    app.get('/register', (req, res) => {
      res.sendFile(path.resolve(buildPath, 'index.html'));
    });
    
    app.get('/dashboard', (req, res) => {
      res.sendFile(path.resolve(buildPath, 'index.html'));
    });
    
    // Handle other routes
    app.use((req, res) => {
      if (!req.path.startsWith('/api')) {
        res.sendFile(path.resolve(buildPath, 'index.html'));
      } else {
        res.status(404).json({ 
          success: false,
          message: 'API endpoint not found - Nuclear option deployed',
          note: 'Most routes disabled for memory optimization'
        });
      }
    });
    
  } else {
    console.warn('⚠️ Build folder not found, serving API only');
    
    app.get('/', (req, res) => {
      res.json({ 
        success: true,
        message: 'Neurolex API Nuclear Option - Frontend build not found',
        environment: process.env.NODE_ENV,
        status: 'All route files disabled for Heroku memory optimization'
      });
    });
  }
} else {
  app.get('/', (req, res) => {
    res.json({ 
      success: true,
      message: 'Neurolex API Development Server',
      environment: process.env.NODE_ENV
    });
  });
}

console.log('✅ Static file serving configured');

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Server error occurred'
  });
});

// ============= SIMPLE DATABASE CONNECTION =============
console.log('🔗 Starting database connection...');

connectToDatabase()
  .then(() => {
    console.log('✅ Connected to MongoDB');
    
    const memoryUsage = process.memoryUsage();
    const memoryUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log('🎉 SUCCESS! Nuclear option deployed - Neurolex server running!');
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV}`);
      console.log(`💾 Memory Usage: ${memoryUsedMB} MB / 512 MB limit`);
      console.log(`🚨 Status: All route files disabled for memory optimization`);
      console.log(`🌐 Server URL: ${isProduction ? 'https://neurolex-platform-9b4c40c0e2da.herokuapp.com' : 'http://localhost:' + PORT}`);
      console.log(`🔗 API Test: ${isProduction ? 'https://neurolex-platform-9b4c40c0e2da.herokuapp.com' : 'http://localhost:' + PORT}/api/test`);
      console.log(`💚 Health Check: ${isProduction ? 'https://neurolex-platform-9b4c40c0e2da.herokuapp.com' : 'http://localhost:' + PORT}/api/health`);
      console.log(`🗄️ Database Test: ${isProduction ? 'https://neurolex-platform-9b4c40c0e2da.herokuapp.com' : 'http://localhost:' + PORT}/api/debug/database`);
      console.log('');
      console.log('🔥 NUCLEAR OPTION SUCCESSFUL!');
      console.log('📝 Next step: Add features back gradually once this is stable');
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    console.error('💥 Unable to start server - database connection failed');
    process.exit(1);
  });

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