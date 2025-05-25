/**
 * Doctor schema definition matching the existing model
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * Creates a Doctor schema
 * @returns {Schema} Mongoose schema for Doctor model
 */
function createDoctorSchema() {
  const schema = new mongoose.Schema({
    // Basic user information
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    lastName: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    password: {
      type: String,
      required: true
    },
    
    // Professional details
    title: {
      type: String,
      required: true,
      enum: ['Dr.', 'Professor', 'Therapist', 'Counselor', 'Other']
    },
    specialization: {
      type: String,
      required: true,
      enum: ['Psychiatrist', 'Psychologist', 'Therapist', 'Counselor', 'Social Worker', 'Psychiatric Nurse', 'Other']
    },
    licenseNumber: {
      type: String,
      required: true,
      unique: true
    },
    licenseIssuingAuthority: {
      type: String,
      required: true
    },
    licenseExpiryDate: {
      type: Date,
      required: true
    },
    licenseDocumentUrl: {
      type: String,
      required: true
    },
    
    // Practice information
    yearsOfExperience: {
      type: Number,
      required: true
    },
    practiceAddress: {
      type: String
    },
    bio: {
      type: String,
      required: true
    },
    profilePhotoUrl: {
      type: String
    },
    languages: [{
      type: String
    }],
    availableForEmergency: {
      type: Boolean,
      default: false
    },
    consultationFee: {
      type: Number
    },
    telehealth: {
      type: Boolean,
      default: false
    },
    inPerson: {
      type: Boolean,
      default: false
    },
    
    // Verification status
    isVerified: {
      type: Boolean,
      default: false
    },
    verificationStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    verificationNotes: {
      type: String
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    verificationDate: {
      type: Date
    },
    rejectionReason: {
      type: String
    },
    
    // System fields
    role: {
      type: String,
      default: 'doctor'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    },
    lastLogin: {
      type: Date
    }
  }, {
    timestamps: true
  });

  // Pre-save hook to hash password
  schema.pre('save', async function(next) {
    // Only hash the password if it's modified or new
    if (!this.isModified('password')) return next();
    
    try {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
      next();
    } catch (error) {
      next(error);
    }
  });

  // Method to compare passwords
  schema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
  };

  // Method to get public profile (without sensitive info)
  schema.methods.getPublicProfile = function() {
    const doctorObject = this.toObject();
    
    // Remove sensitive information
    delete doctorObject.password;
    delete doctorObject.licenseDocumentUrl;
    
    return doctorObject;
  };
  
  return schema;
}

module.exports = createDoctorSchema;