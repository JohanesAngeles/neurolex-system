// server/scripts/createTestDoctor.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');
require('dotenv').config();

// Connect to MongoDB
const certPath = process.env.CERT_PATH || require('path').join(__dirname, '../certificates/angeles_admin1.pem');

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

// Create test doctor
const createTestDoctor = async () => {
  try {
    // Check if test doctor already exists
    const existingUser = await User.findOne({ email: 'doctor@example.com' });
    
    if (existingUser) {
      console.log('Test doctor already exists! Updating necessary fields...');
      
      // Update the doctor with necessary fields
      await User.updateOne(
        { email: 'doctor@example.com' },
        { 
          $set: { 
            isVerified: true, 
            isActive: true 
          } 
        }
      );
      
      console.log('Test doctor updated successfully!');
      mongoose.connection.close();
      return;
    }
    
    // Generate password hash
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Password123!', salt);
    
    // Create doctor object
    const doctorData = {
      firstName: 'Sofia',
      lastName: 'Mendoza',
      email: 'doctor@example.com',
      password: hashedPassword,
      role: 'doctor',
      accountStatus: 'active',
      isEmailVerified: true,
      isVerified: true,
      isActive: true,
      specialty: 'Psychiatrist',
      licenseNumber: 'MD12345',
      gender: 'Female',
      languages: ['English', 'Filipino'],
      lgbtqAffirming: true,
      profilePicture: 'default-profile.png',
      description: 'Specializing in anxiety and depression treatment with 10+ years of experience.',
      onboardingCompleted: true,
      termsAccepted: true,
      title: 'Dr.',
      credentials: 'MD',
      education: [
        { institution: 'University of the Philippines', degree: 'Doctor of Medicine', year: '2010' }
      ],
      experience: [
        { institution: 'Philippine General Hospital', position: 'Resident Psychiatrist', startYear: '2010', endYear: '2015' },
        { institution: 'Mental Health Center of Manila', position: 'Chief Psychiatrist', startYear: '2015', endYear: 'present' }
      ],
      availability: {
        monday: [{ start: '09:00', end: '17:00' }],
        tuesday: [{ start: '09:00', end: '17:00' }],
        wednesday: [{ start: '09:00', end: '17:00' }],
        thursday: [{ start: '09:00', end: '17:00' }],
        friday: [{ start: '09:00', end: '17:00' }]
      }
    };
    
    // Save doctor to database
    const doctor = new User(doctorData);
    await doctor.save();
    
    console.log('Test doctor created successfully!');
  } catch (error) {
    console.error('Error creating test doctor:', error);
  } finally {
    // Close database connection
    mongoose.connection.close();
  }
};

// Run the function
createTestDoctor();