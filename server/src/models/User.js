// server/src/models/User.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Define User Schema
const UserSchema = new mongoose.Schema({
  // Basic Account Info
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+.\S+$/, 'Please enter a valid email address']
  },
  role: {
    type: String,
    enum: ['patient', 'doctor', 'admin'],
    default: 'patient'  // Default role for new users
  },
  // Account status for approval workflow
  accountStatus: {
    type: String,
    enum: ['pending', 'active', 'suspended'],
    default: 'active'
  },
  password: {
    type: String,
    required: [function() { return !this.googleId; }, 'Password is required if not using Google authentication'],
    minlength: 8,
    select: false
  },
  googleId: {
    type: String,
    sparse: true,
    unique: true
  },
  profilePicture: {
    type: String,
    default: 'default-profile.png'
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  // Added these two new fields
  isVerified: {
    type: Boolean,
    default: false
  },
  // Added verification status field
  verificationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  isActive: {
    type: Boolean,
    default: false
  },
  
  // Onboarding Status
  onboardingCompleted: {
    type: Boolean,
    default: false
  },
  
  // Personal Information
  middleName: {
    type: String,
    trim: true
  },
  nickname: {
    type: String,
    trim: true
  },
  birthdate: {
    type: Date
  },
  age: {
    type: Number,
    min: 18
  },
  gender: {
    type: String,
    enum: ['', 'Male', 'Female', 'Bisexual', 'Non-Binary', 'Genderqueer', 'Other', 'Prefer not to say'],
    required: false
  },
  pronouns: {
    type: String,
    enum: ['', 'He/Him', 'She/Her', 'They/Them', 'Other', 'Prefer not to say'],
    required: false
  },
  location: {
    type: String,
    trim: true
  },
  
  // Mental Health History
  diagnosis: {
    type: String
  },
  treatmentHistory: {
    type: String
  },
  symptomsFrequency: {
    type: String
  },
  
  // Doctor and Care Options
  hasMentalHealthDoctor: {
    type: String
  },
  primaryDoctor: {
    type: String,
    trim: true
  },
  doctorContact: {
    type: String,
    trim: true
  },
  therapistName: {
    type: String,
    trim: true
  },
  therapistContact: {
    type: String,
    trim: true
  },
  psychiatristName: {
    type: String,
    trim: true
  },
  psychiatristContact: {
    type: String,
    trim: true
  },
  doctorName: {
    type: String,
    trim: true
  },
  clinicLocation: {
    type: String,
    trim: true
  },
  doctorContactNumber: {
    type: String,
    trim: true
  },
  doctorEmail: {
    type: String,
    trim: true
  },
  needDoctorHelp: {
    type: String
  },
  preferredHospital: {
    type: String,
    trim: true
  },
  insuranceProvider: {
    type: String,
    trim: true
  },
  insuranceNumber: {
    type: String,
    trim: true
  },
  
  // Doctor-specific professional fields
  licenseNumber: {
    type: String,
    sparse: true,
    // Only required if user is a doctor
    required: [function() { return this.role === 'doctor'; }, 'License number is required for doctors']
  },
  specialty: {
    type: String,
    // Only required if user is a doctor
    required: [function() { return this.role === 'doctor'; }, 'Specialty is required for doctors']
  },
  // Additional doctor fields
  title: {
    type: String,
    enum: ['Dr.', 'Professor', 'Therapist', 'Counselor', 'Other', ''],
  },
  licenseIssuingAuthority: {
    type: String
  },
  licenseDocumentUrl: {
    type: String
  },
  consultationFee: {
    type: Number,
    default: 0
  },
  telehealth: {
    type: Boolean,
    default: false
  },
  inPerson: {
    type: Boolean,
    default: false
  },
  clinicName: {
    type: String
  },
  clinicAddress: {
    type: String
  },
  yearsOfPractice: {
    type: Number,
    min: 0
  },
  // Fields for verification process
  verificationDocuments: [{
    type: String, // Could be file paths or URLs to uploaded documents
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  verificationNotes: [{
    content: String,
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  verificationDate: {
    type: Date
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Daily Life and Lifestyle
  occupation: {
    type: String,
    trim: true
  },
  workStatus: {
    type: String,
    enum: ['Full-time', 'Part-time', 'Student', 'Retired', 'Unemployed', 'Unable to work', 'Other', '']
  },
  livingArrangement: {
    type: String,
    trim: true
  },
  exerciseFrequency: {
    type: String,
    enum: ['Daily', '4-6 times per week', '1-3 times per week', 'Rarely', 'Never', 'Yes', 'No', '']
  },
  dietaryPatterns: {
    type: String
  },
  sleepPatterns: {
    type: String
  },
  substanceUse: {
    type: String
  },
  religiousBeliefs: {
    type: String,
    trim: true
  },
  hobbies: {
    type: String
  },
  
  // Emergency Contact
  emergencyName: {
    type: String,
    trim: true
  },
  emergencyRelationship: {
    type: String,
    trim: true
  },
  emergencyPhone: {
    type: String,
    trim: true
  },
  emergencyEmail: {
    type: String,
    trim: true
  },
  emergencyAddress: {
    type: String,
    trim: true
  },
  emergencyAware: {
    type: Boolean,
    default: false
  },
  patients: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  doctors: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Authentication & Security
  hasVerificationToken: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  termsAccepted: {
    type: Boolean,
    default: false,
    required: [true, 'Must accept terms and conditions']
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date
  }
}, {
  timestamps: true
});

// Method to hash password before saving to database
UserSchema.pre('save', async function(next) {
  // If password not modified, skip to next middleware
  if (!this.isModified('password')) return next();

  try {
    // Generate salt for hashing (10 rounds)
    const salt = await bcrypt.genSalt(10);
    // Hash password using salt
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare plaintext password with hashed password
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to create 6-digit verification code for email verification
UserSchema.methods.createEmailVerificationToken = function() {
  // Generate 6-digit code
  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

  // Hash code before saving to database for security
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationCode)
    .digest('hex');

  // Set expiration time (24 hours)
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;
  
  // Set hasVerificationToken to true
  this.hasVerificationToken = true;

  // Return unhashed code (for email)
  return verificationCode;
};

// Method to create password reset token
UserSchema.methods.createPasswordResetToken = function() {
  // Generate random token
  const resetToken = crypto.randomBytes(32).toString('hex');

  // Hash token before saving to database
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Set expiration time (10 minutes)
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  // Return unhashed token (for email)
  return resetToken;
};

const User = mongoose.model('User', UserSchema);

module.exports = User;