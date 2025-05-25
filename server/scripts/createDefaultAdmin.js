// server/scripts/createDefaultAdmin.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// Admin credentials from environment variables
const ADMIN_EMAIL = process.env.DEFAULT_ADMIN_EMAIL || 'admin@neurolex.com';
const ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || 'AdminPassword123!';
const ADMIN_FIRST_NAME = 'Admin';
const ADMIN_LAST_NAME = 'Administrator';

// MongoDB Atlas connection string from environment variables
const MONGODB_URI = process.env.MASTER_MONGO_URI;

// Path to the certificate file
const CERT_PATH = path.join(__dirname, '../certificates/angeles_admin1.pem');

async function createAdminUser() {
  let connection;
  
  try {
    console.log('Verifying certificate exists...');
    if (!fs.existsSync(CERT_PATH)) {
      throw new Error(`Certificate file not found at: ${CERT_PATH}`);
    }
    
    console.log('Certificate found, connecting to MongoDB Atlas...');
    console.log(`Certificate path: ${CERT_PATH}`);
    
    // Updated MongoDB connection options for X.509 authentication
    const mongoOptions = {
      tls: true, // Changed from ssl
      tlsAllowInvalidCertificates: false, // Changed from sslValidate
      tlsCertificateKeyFile: CERT_PATH, // Changed from sslKey and sslCert
      authMechanism: 'MONGODB-X509',
      authSource: '$external',
      retryWrites: true,
      w: 'majority'
    };
    
    // Connect directly to MongoDB
    connection = await mongoose.createConnection(MONGODB_URI, mongoOptions);
    
    console.log('Connected to MongoDB Atlas successfully!');
    
    // Define User schema
    const userSchema = new mongoose.Schema({
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      email: { type: String, required: true, unique: true },
      password: { type: String, required: true },
      role: { 
        type: String, 
        enum: ['patient', 'doctor', 'admin'], 
        default: 'patient', 
        required: true 
      },
      isEmailVerified: { type: Boolean, default: true },
      isVerified: { type: Boolean, default: true },
      accountStatus: { 
        type: String, 
        enum: ['pending', 'active', 'suspended'], 
        default: 'active' 
      },
      termsAccepted: { type: Boolean, default: true },
      createdAt: { type: Date, default: Date.now }
    });
    
    // Register model with this connection
    const User = connection.model('User', userSchema);
    
    // Check if admin exists
    console.log(`Checking if admin user ${ADMIN_EMAIL} already exists...`);
    const existingAdmin = await User.findOne({ email: ADMIN_EMAIL });
    
    if (existingAdmin) {
      console.log(`Admin user with email ${ADMIN_EMAIL} already exists`);
      await connection.close();
      process.exit(0);
    }
    
    // Hash password
    console.log('Hashing password...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, salt);
    
    // Create admin user
    console.log('Creating admin user...');
    const adminUser = await User.create({
      firstName: ADMIN_FIRST_NAME,
      lastName: ADMIN_LAST_NAME,
      email: ADMIN_EMAIL,
      password: hashedPassword,
      role: 'admin',
      isEmailVerified: true,
      isVerified: true,
      accountStatus: 'active',
      termsAccepted: true
    });
    
    console.log(`Admin user created successfully:`, {
      id: adminUser._id,
      email: adminUser.email,
      role: adminUser.role
    });
    
    console.log(`You can now log in with email: ${ADMIN_EMAIL}`);
    console.log(`Password: ${ADMIN_PASSWORD}`);
    
    await connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin user:', error);
    console.error(error.stack);
    if (connection) await connection.close();
    process.exit(1);
  }
}

createAdminUser();