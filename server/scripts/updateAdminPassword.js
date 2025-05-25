// server/scripts/updateAdminPassword.js
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
      
      // Find and update the admin user
      const admin = await User.findOneAndUpdate(
        { email: 'testadmin@neurolex.com' },
        { 
          $set: { password: passwordHash }
        },
        { new: true }
      );
      
      if (admin) {
        console.log('Admin password updated successfully');
        console.log('Email:', admin.email);
        console.log('New Password:', plainPassword);
      } else {
        console.log('Admin user not found');
      }
    } catch (error) {
      console.error('Error updating admin password:', error);
    } finally {
      mongoose.disconnect();
    }
  })
  .catch(err => {
    console.error('Database connection error:', err);
  });