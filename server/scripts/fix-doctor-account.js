// scripts/fix-doctor-account.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');
require('dotenv').config();

// Connect to MongoDB - Fix the certificate path
const path = require('path');
const certPath = process.env.CERT_PATH || path.join(__dirname, '../certificates/angeles_admin1.pem');

console.log('Using certificate path:', certPath);

mongoose.connect(process.env.MONGO_URI, {
    tls: true,
    tlsCertificateKeyFile: certPath,
    authMechanism: 'MONGODB-X509',
    authSource: '$external'
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
});

// Rest of the script remains the same
const fixDoctorAccount = async () => {
  try {
    console.log('Looking for doctor account...');
    const doctor = await User.findOne({ email: 'doctor@example.com' });
    
    if (!doctor) {
      console.log('ERROR: Doctor account not found!');
      return;
    }
    
    console.log('Doctor account found! Current status:');
    console.log('-------------------------------------');
    console.log('Doctor ID:', doctor._id);
    console.log('Email:', doctor.email);
    console.log('Role:', doctor.role);
    console.log('Account Status:', doctor.accountStatus);
    console.log('Is Verified:', doctor.isVerified);
    console.log('Is Email Verified:', doctor.isEmailVerified);
    console.log('Is Active:', doctor.isActive);
    console.log('Has Password:', !!doctor.password);
    console.log('-------------------------------------');
    
    // Generate new password hash
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Password123', salt);
    
    // Update doctor account with all necessary fields
    const updatedDoctor = await User.findOneAndUpdate(
      { email: 'doctor@example.com' },
      { 
        $set: { 
          password: hashedPassword,
          isVerified: true,
          isEmailVerified: true,
          isActive: true,
          accountStatus: 'active',
          onboardingCompleted: true
        } 
      },
      { new: true }
    );
    
    console.log('\nDoctor account updated successfully!');
    console.log('New status:');
    console.log('-------------------------------------');
    console.log('Doctor ID:', updatedDoctor._id);
    console.log('Email:', updatedDoctor.email);
    console.log('Role:', updatedDoctor.role);
    console.log('Account Status:', updatedDoctor.accountStatus);
    console.log('Is Verified:', updatedDoctor.isVerified);
    console.log('Is Email Verified:', updatedDoctor.isEmailVerified);
    console.log('Is Active:', updatedDoctor.isActive);
    console.log('Has Password:', !!updatedDoctor.password);
    console.log('-------------------------------------');
    
    console.log('\nThe doctor account should now work with email: doctor@example.com and password: Password123');
    
  } catch (error) {
    console.error('Error fixing doctor account:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run the function
fixDoctorAccount();