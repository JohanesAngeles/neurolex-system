// server/scripts/createTestAdmin.js
const mongoose = require('mongoose');
const User = require('../src/models/User');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Connect to database
mongoose.connect(process.env.MONGO_URI, {
    tls: true,
    tlsCertificateKeyFile: require('path').join(__dirname, '../certificates/angeles_admin1.pem'),
    authMechanism: 'MONGODB-X509',
    authSource: '$external'
})
  .then(async () => {
    try {
      // Create password hash
      const salt = await bcrypt.genSalt(10);
      const plainPassword = 'TestAdmin123!';
      const passwordHash = await bcrypt.hash(plainPassword, salt);
      
      // Create test admin user with a different email
      const admin = new User({
        firstName: 'Test',
        lastName: 'Admin',
        email: 'testadmin@neurolex.com',
        password: passwordHash,
        role: 'admin',
        isVerified: true,
        isEmailVerified: true,
        isActive: true,
        accountStatus: 'active',
        termsAccepted: true
      });
      
      await admin.save();
      console.log('Test admin user created successfully');
      console.log('Email:', admin.email);
      console.log('Password:', plainPassword);
    } catch (error) {
      console.error('Error creating test admin user:', error);
    } finally {
      mongoose.disconnect();
    }
  })
  .catch(err => {
    console.error('Database connection error:', err);
  });