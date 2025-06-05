/**
 * User schema definition - YOUR EXISTING SCHEMA + FCM TOKEN SUPPORT
 */
const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');

/**
 * Creates a User schema
 * @returns {Schema} Mongoose schema for User model
 */
function createUserSchema() {
  const userSchema = new mongoose.Schema({
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
      default: 'patient'
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
    isVerified: {
      type: Boolean,
      default: false
    },
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
    
    // 🔥 NEW: MOBILE PUSH NOTIFICATION SUPPORT
    fcmToken: {
      type: String,
      default: null,
      select: false // Don't include in regular queries for security
    },
    
    // 🔥 NEW: Device information for notifications
    deviceInfo: {
      platform: {
        type: String,
        enum: ['ios', 'android', 'web', 'mobile'],
        default: null
      },
      deviceType: {
        type: String,
        default: null
      },
      appVersion: {
        type: String,
        default: null
      },
      lastActive: {
        type: Date,
        default: Date.now
      }
    },
    
    // 🔥 NEW: Notification preferences
    notificationSettings: {
      pushNotifications: {
        type: Boolean,
        default: true
      },
      emailNotifications: {
        type: Boolean,
        default: true
      },
      smsNotifications: {
        type: Boolean,
        default: false
      },
      messageNotifications: {
        type: Boolean,
        default: true
      },
      appointmentReminders: {
        type: Boolean,
        default: true
      },
      systemNotifications: {
        type: Boolean,
        default: true
      },
      quietHours: {
        enabled: {
          type: Boolean,
          default: false
        },
        startTime: {
          type: String,
          default: '22:00'
        },
        endTime: {
          type: String,
          default: '08:00'
        }
      }
    },
    
    // NEW: Contact Information
    personalContactNumber: {
      type: String,
      trim: true
    },
    clinicContactNumber: {
      type: String,
      trim: true
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
      sparse: true
    },
    specialty: {
      type: String,
      required: [function() { return this.role === 'doctor'; }, 'Specialty is required for doctors']
    },
    title: {
      type: String,
      enum: ['Dr.', 'Professor', 'Therapist', 'Counselor', 'Other', ''],
    },
    
    // NEW: Professional Information
    areasOfExpertise: {
      type: String,
      trim: true
    },
    experience: {
      type: String,
      trim: true,
      required: [function() { return this.role === 'doctor'; }, 'Experience is required for doctors']
    },
    
    // NEW: Availability
    availability: {
      monday: {
        available: { type: Boolean, default: false },
        slots: [{
          startTime: String,
          endTime: String
        }]
      },
      tuesday: {
        available: { type: Boolean, default: false },
        slots: [{
          startTime: String,
          endTime: String
        }]
      },
      wednesday: {
        available: { type: Boolean, default: false },
        slots: [{
          startTime: String,
          endTime: String
        }]
      },
      thursday: {
        available: { type: Boolean, default: false },
        slots: [{
          startTime: String,
          endTime: String
        }]
      },
      friday: {
        available: { type: Boolean, default: false },
        slots: [{
          startTime: String,
          endTime: String
        }]
      },
      saturday: {
        available: { type: Boolean, default: false },
        slots: [{
          startTime: String,
          endTime: String
        }]
      },
      sunday: {
        available: { type: Boolean, default: false },
        slots: [{
          startTime: String,
          endTime: String
        }]
      }
    },
    
    // NEW: Appointment Types
    appointmentTypes: {
      inPerson: { type: Boolean, default: false },
      telehealth: { type: Boolean, default: false }
    },
    
    // NEW: Structured Credentials
    education: [{
      id: String,
      degree: String,
      institution: String,
      year: String
    }],
    
    licenses: [{
      id: String,
      degree: String, // License type
      licenseNumber: String,
      expirationDate: String
    }],
    
    certifications: [{
      id: String,
      degree: String, // Certification name
      issuingAuthority: String,
      year: String
    }],
    
    // Existing fields
    licenseIssuingAuthority: {
      type: String
    },
    licenseDocumentUrl: {
      type: String
    },
    
    // NEW: Document URLs
    educationCertificateUrl: {
      type: String
    },
    additionalDocumentUrls: [{
      type: String
    }],
    
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
      type: String,
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

    // ============= PAYMENT METHODS FOR DOCTORS (MULTI-TENANT AWARE) - ADDED =============
    paymentMethods: {
      gcash: {
        enabled: {
          type: Boolean,
          default: false
        },
        qrCode: {
          type: String, // URL to QR code image
          default: null
        },
        accountNumber: {
          type: String,
          default: null
        },
        accountName: {
          type: String,
          default: null
        },
        tenantId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Tenant',
          default: null
        },
        uploadedAt: {
          type: Date,
          default: null
        }
      },
      paymaya: {
        enabled: {
          type: Boolean,
          default: false
        },
        qrCode: {
          type: String, // URL to QR code image
          default: null
        },
        accountNumber: {
          type: String,
          default: null
        },
        accountName: {
          type: String,
          default: null
        },
        tenantId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Tenant',
          default: null
        },
        uploadedAt: {
          type: Date,
          default: null
        }
      },
      bankAccounts: [{
        id: {
          type: String,
          required: true
        },
        bankName: {
          type: String,
          required: true,
          maxlength: 100
        },
        accountName: {
          type: String,
          required: true,
          maxlength: 100
        },
        accountNumber: {
          type: String,
          required: true,
          maxlength: 50
        },
        tenantId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Tenant',
          default: null
        },
        isActive: {
          type: Boolean,
          default: true
        },
        createdAt: {
          type: Date,
          default: Date.now
        }
      }]
    },
    // ============= END PAYMENT METHODS =============
    
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

  // Password hashing middleware
  userSchema.pre('save', async function(next) {
    // Only hash the password if it's been modified (or is new)
    if (!this.isModified('password')) {
      return next();
    }

    try {
      console.log(`Hashing password for user: ${this.email}`);
      // Generate salt
      const salt = await bcryptjs.genSalt(10);
      // Hash password
      this.password = await bcryptjs.hash(this.password, salt);
      console.log('Password hashed successfully');
      next();
    } catch (error) {
      console.error('Error hashing password:', error);
      next(error);
    }
  });

  // Method to compare passwords for login
  userSchema.methods.comparePassword = async function(candidatePassword) {
    try {
      console.log(`Comparing password for user: ${this.email}`);
      return await bcryptjs.compare(candidatePassword, this.password);
    } catch (error) {
      console.error('Error comparing passwords:', error);
      return false;
    }
  };

  // 🔥 NEW: FCM TOKEN METHODS

  /**
   * Update user's FCM token for push notifications
   */
  userSchema.methods.updateFCMToken = async function(token, deviceInfo = {}) {
    try {
      this.fcmToken = token;
      this.deviceInfo = {
        ...this.deviceInfo,
        ...deviceInfo,
        lastActive: new Date()
      };
      
      await this.save();
      console.log(`✅ FCM token updated for user: ${this._id}`);
      return true;
    } catch (error) {
      console.error(`❌ Error updating FCM token for user ${this._id}:`, error);
      return false;
    }
  };

  /**
   * Remove FCM token (when user logs out or token expires)
   */
  userSchema.methods.removeFCMToken = async function() {
    try {
      this.fcmToken = null;
      await this.save();
      console.log(`✅ FCM token removed for user: ${this._id}`);
      return true;
    } catch (error) {
      console.error(`❌ Error removing FCM token for user ${this._id}:`, error);
      return false;
    }
  };

  /**
   * Get FCM token for notifications
   */
  userSchema.methods.getFCMToken = function() {
    return this.fcmToken;
  };

  /**
   * Check if user can receive push notifications
   */
  userSchema.methods.canReceivePushNotifications = function() {
    return !!(
      this.fcmToken && 
      this.isActive && 
      this.notificationSettings?.pushNotifications !== false
    );
  };

  /**
   * Check if user is in quiet hours
   */
  userSchema.methods.isInQuietHours = function() {
    if (!this.notificationSettings?.quietHours?.enabled) {
      return false;
    }
    
    const now = new Date();
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + 
                       now.getMinutes().toString().padStart(2, '0');
    
    const startTime = this.notificationSettings.quietHours.startTime;
    const endTime = this.notificationSettings.quietHours.endTime;
    
    // Handle overnight quiet hours (e.g., 22:00 to 08:00)
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime <= endTime;
    }
    
    // Handle same-day quiet hours (e.g., 12:00 to 14:00)
    return currentTime >= startTime && currentTime <= endTime;
  };

  /**
   * Update notification settings
   */
  userSchema.methods.updateNotificationSettings = async function(settings) {
    try {
      this.notificationSettings = {
        ...this.notificationSettings,
        ...settings
      };
      
      await this.save();
      console.log(`✅ Notification settings updated for user: ${this._id}`);
      return true;
    } catch (error) {
      console.error(`❌ Error updating notification settings for user ${this._id}:`, error);
      return false;
    }
  };

  // 🔥 NEW: Virtual for full name
  userSchema.virtual('fullName').get(function() {
    return `${this.firstName} ${this.lastName}`;
  });

  // 🔥 NEW: Create indexes for better performance
  userSchema.index({ email: 1 });
  userSchema.index({ role: 1, isActive: 1 });
  userSchema.index({ fcmToken: 1 }); // 🔥 NEW: Index for FCM token queries
  userSchema.index({ 'deviceInfo.lastActive': -1 }); // 🔥 NEW: Index for device activity
  userSchema.index({ createdAt: -1 });

  return userSchema;
}

module.exports = createUserSchema;