// server/src/controllers/userController.js - COMPLETE UPDATED FILE


// Models will be obtained from tenant connection, not directly imported
// const User = require('../models/User');
// const Appointment = require('../models/Appointment');
// const JournalEntry = require('../models/JournalEntry');

const { uploadToCloudinary, deleteCloudinaryImage, extractPublicId } = require('../services/cloudinary');

// Get current user's profile
exports.getProfile = async (req, res, next) => {
  try {
    // Check if tenantConnection exists, if not, use a fallback
    if (!req.tenantConnection) {
      console.error('No tenant connection found in request object');
      return res.status(500).json({
        success: false,
        message: 'Database connection error - please try again later'
      });
    }
   
    // Use tenant connection instead of direct model import
    const connection = req.tenantConnection;
    const User = connection.model('User');
   
    // Get user without password field
    const user = await User.findById(req.user.id).select('-password');
   
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
   
    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Error in getProfile:', error);
    next(error);
  }
};


// 🔧 NEW METHOD: Update user profile basic info (firstName, lastName, middleName, nickname)
exports.updateProfileBasic = async (req, res) => {
  try {
    console.log('=== UPDATE PROFILE BASIC ===');
    console.log('Request body:', req.body);
    console.log('User ID:', req.user?.id || req.user?._id);
    
    // Get user ID
    const userId = req.user?.id || req.user?._id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }


    // Extract and validate data
    const { firstName, lastName, middleName, nickname } = req.body;
    
    if (!firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'First name and last name are required'
      });
    }


    // Prepare update data
    const updateData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      middleName: middleName ? middleName.trim() : null,
      nickname: nickname ? nickname.trim() : null,
      updatedAt: new Date()
    };


    console.log('Update data:', updateData);


    let updatedUser = null;


    // Method 1: Try tenant connection first
    if (req.tenantConnection) {
      try {
        console.log('Using tenant connection for profile update');
        
        // Direct collection update (most reliable)
        if (req.tenantConnection.db) {
          const usersCollection = req.tenantConnection.db.collection('users');
          const mongoose = require('mongoose');
          
          const userObjectId = mongoose.Types.ObjectId.isValid(userId)
            ? new mongoose.Types.ObjectId(userId)
            : userId;


          const updateResult = await usersCollection.updateOne(
            { _id: userObjectId },
            { $set: updateData }
          );


          console.log('Direct update result:', updateResult);


          if (updateResult.modifiedCount > 0) {
            // Fetch updated user
            updatedUser = await usersCollection.findOne(
              { _id: userObjectId },
              { projection: { password: 0 } } // Exclude password
            );
            console.log('✅ Profile updated via direct collection');
          }
        }
        
        // Fallback to Mongoose model
        if (!updatedUser) {
          const User = req.tenantConnection.model('User');
          updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: updateData },
            { new: true, runValidators: true }
          ).select('-password').lean();
          
          if (updatedUser) {
            console.log('✅ Profile updated via tenant model');
          }
        }
      } catch (tenantError) {
        console.error('Tenant update failed:', tenantError.message);
      }
    }


    // Method 2: Fallback to default database
    if (!updatedUser) {
      try {
        console.log('Using default database for profile update');
        const User = require('../models/User');
        
        updatedUser = await User.findByIdAndUpdate(
          userId,
          { $set: updateData },
          { new: true, runValidators: true }
        ).select('-password').lean();
        
        if (updatedUser) {
          console.log('✅ Profile updated via default database');
        }
      } catch (defaultError) {
        console.error('Default database update failed:', defaultError.message);
      }
    }


    if (!updatedUser) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update profile'
      });
    }


    console.log('✅ Profile update successful');


    // Return success response with updated user
    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser,
      data: updatedUser // Include both for compatibility
    });


  } catch (error) {
    console.error('❌ Error in updateProfileBasic:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
};


// 🔧 NEW METHOD: Update user password
exports.updatePassword = async (req, res) => {
  try {
    console.log('=== UPDATE PASSWORD ===');
    console.log('User ID:', req.user?.id || req.user?._id);
    
    const userId = req.user?.id || req.user?._id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }


    const { currentPassword, newPassword, confirmPassword } = req.body;


    // Validate input
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'All password fields are required'
      });
    }


    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New passwords do not match'
      });
    }


    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long'
      });
    }


    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password'
      });
    }


    let user = null;


    // Get user with password field
    if (req.tenantConnection) {
      try {
        const User = req.tenantConnection.model('User');
        user = await User.findById(userId).select('+password');
      } catch (tenantError) {
        console.error('Tenant password update failed:', tenantError.message);
      }
    }


    if (!user) {
      const User = require('../models/User');
      user = await User.findById(userId).select('+password');
    }


    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }


    // Verify current password
    const bcrypt = require('bcryptjs');
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }


    // Hash new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);


    // Update password
    let updateResult = null;


    if (req.tenantConnection) {
      try {
        if (req.tenantConnection.db) {
          const usersCollection = req.tenantConnection.db.collection('users');
          const mongoose = require('mongoose');
          
          const userObjectId = mongoose.Types.ObjectId.isValid(userId)
            ? new mongoose.Types.ObjectId(userId)
            : userId;


          updateResult = await usersCollection.updateOne(
            { _id: userObjectId },
            { 
              $set: { 
                password: hashedNewPassword,
                updatedAt: new Date()
              } 
            }
          );


          console.log('Direct password update result:', updateResult);
        }
        
        if (!updateResult || updateResult.modifiedCount === 0) {
          const User = req.tenantConnection.model('User');
          user.password = hashedNewPassword;
          await user.save();
          updateResult = { modifiedCount: 1 };
        }
      } catch (tenantError) {
        console.error('Tenant password update failed:', tenantError.message);
      }
    }


    if (!updateResult || updateResult.modifiedCount === 0) {
      const User = require('../models/User');
      user.password = hashedNewPassword;
      await user.save();
    }


    console.log('✅ Password updated successfully');


    return res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });


  } catch (error) {
    console.error('❌ Error in updatePassword:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: error.message
    });
  }
};


// Get all doctors
exports.getDoctors = async (req, res) => {
  try {
    // Use tenant connection instead of direct model import
    const connection = req.tenantConnection;
    const User = connection.model('User');
   
    // Get all users with role 'doctor'
    const doctors = await User.find({ role: 'doctor', isEmailVerified: true, accountStatus: 'active' })
      .select('firstName lastName specialty profilePicture gender languages lgbtqAffirming description credentials title');
   
    return res.status(200).json({
      success: true,
      data: doctors
    });
  } catch (error) {
    console.error('Error fetching doctors:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching doctors',
      error: error.message
    });
  }
};


// Update onboarding information
// Enhanced updateOnboarding with comprehensive logging
exports.updateOnboarding = async (req, res, next) => {
  try {
    console.log('=== ENHANCED ONBOARDING SAVE ===');
    console.log('Request body keys:', Object.keys(req.body));
    console.log('Full request body:', JSON.stringify(req.body, null, 2));
   
    // Check tenant connection
    if (!req.tenantConnection) {
      console.error('❌ No tenant connection found');
      return res.status(500).json({
        success: false,
        message: 'Database connection error'
      });
    }
   
    const connection = req.tenantConnection;
    const User = connection.model('User');
   
    // Extract ALL onboarding fields from request body
    const onboardingData = {
      // Personal Information
      middleName: req.body.middleName,
      nickname: req.body.nickname,
      birthdate: req.body.birthdate,
      age: req.body.age,
      gender: req.body.gender,
      pronouns: req.body.pronouns,
      location: req.body.location,
     
      // Mental Health History
      diagnosis: req.body.diagnosis,
      treatmentHistory: req.body.treatmentHistory,
      symptomsFrequency: req.body.symptomsFrequency,
     
      // Doctor and Care Options
      hasMentalHealthDoctor: req.body.hasMentalHealthDoctor,
      primaryDoctor: req.body.primaryDoctor,
      doctorContact: req.body.doctorContact,
      therapistName: req.body.therapistName,
      therapistContact: req.body.therapistContact,
      psychiatristName: req.body.psychiatristName,
      psychiatristContact: req.body.psychiatristContact,
      doctorName: req.body.doctorName,
      clinicLocation: req.body.clinicLocation,
      doctorContactNumber: req.body.doctorContactNumber,
      doctorEmail: req.body.doctorEmail,
      needDoctorHelp: req.body.needDoctorHelp,
      preferredHospital: req.body.preferredHospital,
      insuranceProvider: req.body.insuranceProvider,
      insuranceNumber: req.body.insuranceNumber,
     
      // Daily Life and Lifestyle
      occupation: req.body.occupation,
      workStatus: req.body.workStatus,
      livingArrangement: req.body.livingArrangement,
      exerciseFrequency: req.body.exerciseFrequency,
      dietaryPatterns: req.body.dietaryPatterns,
      sleepPatterns: req.body.sleepPatterns,
      substanceUse: req.body.substanceUse,
      religiousBeliefs: req.body.religiousBeliefs,
      hobbies: req.body.hobbies,
     
      // Emergency Contact
      emergencyName: req.body.emergencyName,
      emergencyRelationship: req.body.emergencyRelationship,
      emergencyPhone: req.body.emergencyPhone,
      emergencyEmail: req.body.emergencyEmail,
      emergencyAddress: req.body.emergencyAddress,
      emergencyAware: req.body.emergencyAware,
     
      // Mark onboarding as completed
      onboardingCompleted: true
    };
   
    // Remove undefined values to avoid overwriting existing data with undefined
    const cleanedData = {};
    Object.keys(onboardingData).forEach(key => {
      if (onboardingData[key] !== undefined && onboardingData[key] !== null) {
        cleanedData[key] = onboardingData[key];
      }
    });
   
    console.log('🔍 Cleaned onboarding data to save:', cleanedData);
    console.log('🔍 User ID to update:', req.user.id);
   
    // CRITICAL: Use direct MongoDB update for maximum reliability
    const userId = req.user.id || req.user._id;
   
    // Method 1: Try direct collection update (most reliable)
    let updateResult = null;
    let updatedUser = null;
   
    try {
      console.log('🔧 Method 1: Direct collection update');
      const usersCollection = connection.db.collection('users');
      const mongoose = require('mongoose');
     
      // Convert user ID to ObjectId
      const userObjectId = new mongoose.Types.ObjectId(userId);
     
      // Perform direct update
      updateResult = await usersCollection.updateOne(
        { _id: userObjectId },
        { $set: cleanedData }
      );
     
      console.log('🔍 Direct update result:', updateResult);
     
      if (updateResult.modifiedCount > 0) {
        console.log('✅ Direct update successful');
       
        // Fetch the updated user
        updatedUser = await usersCollection.findOne({ _id: userObjectId });
        console.log('✅ Updated user retrieved via direct collection');
      } else {
        console.log('⚠️ Direct update didn\'t modify any documents');
      }
    } catch (directError) {
      console.error('❌ Direct collection update failed:', directError.message);
    }
   
    // Method 2: Fallback to Mongoose update if direct update failed
    if (!updatedUser) {
      try {
        console.log('🔧 Method 2: Mongoose findByIdAndUpdate');
       
        updatedUser = await User.findByIdAndUpdate(
          userId,
          { $set: cleanedData },
          {
            new: true,
            runValidators: false,
            strict: false
          }
        ).select('-password').lean();
       
        if (updatedUser) {
          console.log('✅ Mongoose update successful');
        } else {
          console.log('❌ Mongoose update failed - user not found');
        }
      } catch (mongooseError) {
        console.error('❌ Mongoose update failed:', mongooseError.message);
      }
    }
   
    // Method 3: Last resort - update using $set with strict: false
    if (!updatedUser) {
      try {
        console.log('🔧 Method 3: Mongoose with strict: false');
       
        const userDoc = await User.findById(userId);
        if (userDoc) {
          // Manually set each field
          Object.keys(cleanedData).forEach(key => {
            userDoc.set(key, cleanedData[key]);
          });
         
          // Save with validation disabled
          await userDoc.save({ validateBeforeSave: false });
         
          // Refetch the user
          updatedUser = await User.findById(userId).select('-password').lean();
          console.log('✅ Manual field setting successful');
        }
      } catch (manualError) {
        console.error('❌ Manual field setting failed:', manualError.message);
      }
    }
   
    // Verify the save worked
    if (updatedUser) {
      console.log('🔍 VERIFICATION - Saved onboarding fields:');
      console.log({
        age: updatedUser.age,
        gender: updatedUser.gender,
        location: updatedUser.location,
        middleName: updatedUser.middleName,
        nickname: updatedUser.nickname,
        birthdate: updatedUser.birthdate,
        clinicLocation: updatedUser.clinicLocation,
        diagnosis: updatedUser.diagnosis,
        occupation: updatedUser.occupation,
        emergencyName: updatedUser.emergencyName,
        onboardingCompleted: updatedUser.onboardingCompleted
      });
     
      // Success response
      res.status(200).json({
        success: true,
        message: 'Onboarding information saved successfully',
        user: updatedUser,
        debug: {
          fieldsUpdated: Object.keys(cleanedData),
          updateMethod: updateResult ? 'direct_collection' : 'mongoose',
          tenantDb: connection.db.databaseName
        }
      });
    } else {
      console.error('❌ All update methods failed');
      res.status(500).json({
        success: false,
        message: 'Failed to save onboarding information',
        error: 'Database update failed'
      });
    }
   
  } catch (error) {
    console.error('❌ Critical error in updateOnboarding:', error);
    res.status(500).json({
      success: false,
      message: 'Error saving onboarding information',
      error: error.message
    });
  }
};


// Skip onboarding
exports.skipOnboarding = async (req, res, next) => {
  try {
    // Use tenant connection instead of direct model import
    const connection = req.tenantConnection;
    const User = connection.model('User');
   
    // Simply mark onboarding as completed without additional data
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { onboardingCompleted: true },
      { new: true }
    ).select('-password');
   
    res.status(200).json({
      success: true,
      message: 'Onboarding skipped successfully',
      user
    });
  } catch (error) {
    next(error);
  }
};


// Get user appointments
exports.getUserAppointments = async (req, res) => {
  try {
    // Use tenant connection instead of direct model import
    const connection = req.tenantConnection;
    const Appointment = connection.model('Appointment');
   
    const { userId } = req.params;
    const { status } = req.query;
   
    // Check if the Appointment model exists - if not, return placeholder data
    try {
      // Try to find appointments using the model
      const query = { userId };
      if (status) {
        query.status = status;
      }
     
      const appointments = await Appointment.find(query)
        .sort({ appointmentDate: 1 })
        .populate('doctorId', 'firstName lastName specialty profilePicture');
       
      return res.status(200).json({
        success: true,
        data: appointments
      });
    } catch (modelError) {
      console.log('Using placeholder data for appointments:', modelError.message);
     
      // Return placeholder data for now
      const appointments = [
        {
          _id: '1',
          doctorName: 'Dr. Sarah Johnson',
          specialization: 'Psychiatrist',
          date: 'May 10, 2025',
          time: '10:00 AM',
          appointmentDate: new Date('2025-05-10T10:00:00'),
          status: 'Scheduled',
          duration: 30
        }
      ];
     
      return res.status(200).json({
        success: true,
        data: appointments,
        note: 'Using placeholder data'
      });
    }
  } catch (error) {
    console.error(`Error getting user appointments: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get user appointments',
      error: error.message
    });
  }
};


// Get user journal entries
exports.getUserJournalEntries = async (req, res) => {
  try {
    // Use tenant connection instead of direct model import
    const connection = req.tenantConnection;
    const JournalEntry = connection.model('JournalEntry');
   
    const { userId } = req.params;
    const { limit = 5, sort = 'date:desc' } = req.query;
   
    // Parse sort parameter
    const [sortField, sortOrder] = sort.split(':');
    const sortOptions = {};
    sortOptions[sortField === 'date' ? 'createdAt' : sortField] = sortOrder === 'desc' ? -1 : 1;
   
    // Check if the JournalEntry model exists - if not, return placeholder data
    try {
      // Try to find journal entries using the model
      const journalEntries = await JournalEntry.find({ userId })
        .sort(sortOptions)
        .limit(parseInt(limit));
     
      return res.status(200).json({
        success: true,
        data: journalEntries
      });
    } catch (modelError) {
      console.log('Using placeholder data for journal entries:', modelError.message);
     
      // Return placeholder data for now
      const journalEntries = [
        {
          _id: '1',
          title: 'Feeling hopeful today',
          content: 'I had a productive therapy session and feel more optimistic about the future.',
          date: 'May 05, 2025',
          sentiment: 'positive',
          createdAt: new Date('2025-05-05')
        },
        {
          _id: '2',
          title: 'Reflecting on challenges',
          content: 'Today was difficult but I managed to use some coping techniques I learned.',
          date: 'May 03, 2025',
          sentiment: 'neutral',
          createdAt: new Date('2025-05-03')
        }
      ];
     
      return res.status(200).json({
        success: true,
        data: journalEntries,
        note: 'Using placeholder data'
      });
    }
  } catch (error) {
    console.error(`Error getting user journal entries: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get user journal entries',
      error: error.message
    });
  }
};


// Get current mood
exports.getCurrentMood = async (req, res) => {
  try {
    // Use tenant connection instead of direct model import
    const connection = req.tenantConnection;
   
    const { userId } = req.params;
   
    // Check if the Mood model exists - if not, return placeholder data
    try {
      const Mood = connection.model('Mood');
     
      // Get the most recent mood entry
      const mood = await Mood.findOne({ userId })
        .sort({ timestamp: -1 })
        .limit(1);
     
      if (mood) {
        return res.status(200).json({
          success: true,
          data: mood
        });
      } else {
        // No mood entries found
        return res.status(200).json({
          success: true,
          data: null,
          message: 'No mood entries found'
        });
      }
    } catch (modelError) {
      console.log('Using placeholder data for mood:', modelError.message);
     
      // Return placeholder data
      const mood = {
        mood: 'neutral',
        timestamp: new Date().toISOString(),
        notes: ''
      };
     
      return res.status(200).json({
        success: true,
        data: mood,
        note: 'Using placeholder data'
      });
    }
  } catch (error) {
    console.error(`Error getting current mood: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get current mood',
      error: error.message
    });
  }
};


// Create mood entry
exports.createMood = async (req, res) => {
  try {
    // Use tenant connection instead of direct model import
    const connection = req.tenantConnection;
   
    const { userId } = req.params;
    const { mood, notes, timestamp } = req.body;
   
    // Validate mood
    if (!mood) {
      return res.status(400).json({
        success: false,
        message: 'Mood is required'
      });
    }
   
    // Check if the Mood model exists - if not, return success without saving
    try {
      const Mood = connection.model('Mood');
     
      // Create new mood entry
      const newMood = new Mood({
        userId,
        mood,
        notes: notes || '',
        timestamp: timestamp || new Date()
      });
     
      await newMood.save();
     
      return res.status(201).json({
        success: true,
        message: 'Mood entry created successfully',
        data: newMood
      });
    } catch (modelError) {
      console.log('Returning success without saving mood:', modelError.message);
     
      // Return success response without actually saving
      return res.status(201).json({
        success: true,
        message: 'Mood entry created successfully (placeholder)',
        data: {
          mood,
          notes: notes || '',
          timestamp: timestamp || new Date().toISOString()
        },
        note: 'Using placeholder data, not saved to database'
      });
    }
  } catch (error) {
    console.error(`Error creating mood entry: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to create mood entry',
      error: error.message
    });
  }
};


// Get all users for a tenant (admin function)
exports.getUsers = async (req, res) => {
  try {
    // Use tenant connection instead of direct model import
    const connection = req.tenantConnection;
    const User = connection.model('User');
   
    const users = await User.find().sort({ firstName: 1, lastName: 1 });
   
    res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    });
  }
};


// Create a new user for a tenant (admin function)
exports.createUser = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      role,
      // Include other fields from your User model as needed
      middleName,
      gender,
      pronouns,
      profilePicture,
      birthdate,
      // Any other fields you want to capture during user creation
    } = req.body;
   
    // Validate required fields
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }
   
    // Use tenant connection instead of direct model import
    const connection = req.tenantConnection;
    const User = connection.model('User');
   
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }
   
    // Create new user - using your existing schema fields
    const newUser = new User({
      firstName,
      lastName,
      email,
      password, // Password will be hashed by the pre-save hook in your User model
      role: role || 'patient', // Default to patient if not specified
      accountStatus: 'active',
      middleName,
      gender,
      pronouns,
      profilePicture,
      birthdate,
      termsAccepted: true, // Set this as appropriate for your application
      tenantId: req.tenantId // Store tenant ID for reference
      // Other fields can be set later through profile updates
    });
   
    await newUser.save();
   
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        _id: newUser._id,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating user',
      error: error.message
    });
  }
};


// Get a user by ID (admin function)
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
   
    // Use tenant connection instead of direct model import
    const connection = req.tenantConnection;
    const User = connection.model('User');
   
    const user = await User.findById(id);
   
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
   
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user',
      error: error.message
    });
  }
};


// Delete a user (admin function)
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
   
    // Use tenant connection instead of direct model import
    const connection = req.tenantConnection;
    const User = connection.model('User');
   
    const user = await User.findById(id);
   
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
   
    await User.findByIdAndDelete(id);
   
    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting user',
      error: error.message
    });
  }
};


exports.getCurrentUser = async (req, res) => {
  try {
    // Log for debugging
    console.log('getCurrentUser called', {
      userId: req.userId || req.user?.id || req.user?._id,
      tenantId: req.tenantId,
      userAgent: req.headers['user-agent']?.substring(0, 50)
    });
   
    // Get user ID from multiple possible sources
    const userId = req.userId || req.user?.id || req.user?._id;
   
    if (!userId) {
      console.log('❌ No user ID found in request');
      return res.status(401).json({
        success: false,
        message: 'Not authenticated - no user ID found'
      });
    }
   
    let user = null;
   
    // Case 1: Using tenant connection (preferred for multi-tenant)
    if (req.tenantConnection) {
      try {
        console.log('🔍 Attempting to find user in tenant database');
       
        // Method 1A: Direct collection access (most reliable)
        if (req.tenantConnection.db) {
          try {
            const usersCollection = req.tenantConnection.db.collection('users');
            const mongoose = require('mongoose');
           
            // Convert to ObjectId if needed
            const userObjectId = mongoose.Types.ObjectId.isValid(userId)
              ? new mongoose.Types.ObjectId(userId)
              : userId;
           
            user = await usersCollection.findOne({ _id: userObjectId });
           
            if (user) {
              console.log('✅ User found via direct tenant collection access');
            } else {
              console.log('❌ User not found via direct tenant collection access');
            }
          } catch (directError) {
            console.error('Direct collection access failed:', directError.message);
          }
        }
       
        // Method 1B: Tenant User model (if direct access failed)
        if (!user) {
          try {
            const UserModel = req.tenantConnection.model('User');
            user = await UserModel.findById(userId).lean();
           
            if (user) {
              console.log('✅ User found via tenant User model');
            } else {
              console.log('❌ User not found via tenant User model');
            }
          } catch (tenantModelError) {
            console.error('Tenant User model access failed:', tenantModelError.message);
          }
        }
      } catch (tenantError) {
        console.error('❌ Error accessing tenant database:', tenantError.message);
      }
    }
   
    // Case 2: Fallback - use default User model
    if (!user) {
      try {
        console.log('🔍 Falling back to default database to find user');
       
        // Dynamically import User model to avoid reference errors
        const User = require('../models/User');
       
        // Find user in default database
        user = await User.findById(userId).lean();
       
        if (user) {
          console.log('✅ User found in default database');
        } else {
          console.log('❌ User not found in default database');
         
          // Final attempt: create a temporary response for development
          if (process.env.NODE_ENV === 'development') {
            console.log('🔧 Creating temporary user response for development');
            user = {
              _id: userId,
              firstName: 'Development',
              lastName: 'User',
              email: 'dev@example.com',
              role: 'admin', // Default to admin for testing
              accountStatus: 'active'
            };
          } else {
            return res.status(404).json({
              success: false,
              message: 'User not found in any database'
            });
          }
        }
      } catch (defaultDbError) {
        console.error('❌ Error accessing default database:', defaultDbError.message);
       
        return res.status(500).json({
          success: false,
          message: 'Database error when accessing user data',
          error: defaultDbError.message
        });
      }
    }
   
    // Prepare user data for response
    const userData = user.toObject ? user.toObject() : {...user};
   
    // Remove sensitive fields
    delete userData.password;
    delete userData.passwordResetToken;
    delete userData.emailVerificationToken;
    delete userData.refreshToken;
    delete userData.resetPasswordToken;
    delete userData.resetPasswordExpires;
   
    console.log('✅ Returning user data:', {
      id: userData._id,
      email: userData.email,
      role: userData.role,
      firstName: userData.firstName,
      lastName: userData.lastName
    });
   
    // 🔧 CRITICAL FIX: Add cache-busting headers to prevent 304 responses
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Last-Modified': new Date().toUTCString(),
      'ETag': null // Remove ETag to prevent 304
    });
   
    // 🔧 CRITICAL FIX: Always return 200 with fresh data
    return res.status(200).json({
      success: true,
      data: userData,
      timestamp: new Date().toISOString(), // Add timestamp for cache busting
      source: req.tenantConnection ? 'tenant_db' : 'default_db'
    });
   
  } catch (error) {
    console.error('❌ Critical error in getCurrentUser:', error);
   
    // 🔧 CRITICAL FIX: Ensure no caching even for errors
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
   
    return res.status(500).json({
      success: false,
      message: 'Error retrieving user data',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

exports.uploadProfilePicture = async (req, res) => {
  try {
    console.log('=== UPLOAD PROFILE PICTURE ===');
    console.log('User ID:', req.user?.id || req.user?._id);
    console.log('File received:', !!req.file);
    console.log('File details:', req.file ? {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    } : 'No file');

    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.'
      });
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (req.file.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 5MB.'
      });
    }

    // Get current user to check for existing profile picture
    let currentUser = null;

    // Try to get user from tenant connection first
    if (req.tenantConnection) {
      try {
        const User = req.tenantConnection.model('User');
        currentUser = await User.findById(userId).select('profilePicture');
      } catch (tenantError) {
        console.error('Tenant user lookup failed:', tenantError.message);
      }
    }

    // Fallback to default database
    if (!currentUser) {
      try {
        const User = require('../models/User');
        currentUser = await User.findById(userId).select('profilePicture');
      } catch (defaultError) {
        console.error('Default database user lookup failed:', defaultError.message);
      }
    }

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Upload new image to Cloudinary
    console.log('📤 Uploading image to Cloudinary...');
    const uploadOptions = {
      folder: `${process.env.CLOUDINARY_FOLDER || 'neurolex'}/profile_pictures`,
      public_id: `user_${userId}_${Date.now()}`,
      overwrite: true,
      transformation: [
        { width: 400, height: 400, crop: 'fill', gravity: 'face' },
        { quality: 'auto:good' },
        { fetch_format: 'auto' }
      ]
    };

    const uploadResult = await uploadToCloudinary(req.file.buffer, uploadOptions);
    
    if (!uploadResult || !uploadResult.secure_url) {
      return res.status(500).json({
        success: false,
        message: 'Failed to upload image to cloud storage'
      });
    }

    console.log('✅ Image uploaded successfully:', uploadResult.secure_url);

    // Update user profile picture in database
    const updateData = {
      profilePicture: uploadResult.secure_url,
      updatedAt: new Date()
    };

    let updatedUser = null;

    // Try tenant connection first
    if (req.tenantConnection) {
      try {
        if (req.tenantConnection.db) {
          // Direct collection update
          const usersCollection = req.tenantConnection.db.collection('users');
          const mongoose = require('mongoose');
          
          const userObjectId = mongoose.Types.ObjectId.isValid(userId)
            ? new mongoose.Types.ObjectId(userId)
            : userId;

          const updateResult = await usersCollection.updateOne(
            { _id: userObjectId },
            { $set: updateData }
          );

          if (updateResult.modifiedCount > 0) {
            updatedUser = await usersCollection.findOne(
              { _id: userObjectId },
              { projection: { password: 0 } }
            );
            console.log('✅ Profile picture updated via tenant connection');
          }
        }

        if (!updatedUser) {
          const User = req.tenantConnection.model('User');
          updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: updateData },
            { new: true, runValidators: true }
          ).select('-password').lean();
        }
      } catch (tenantError) {
        console.error('Tenant update failed:', tenantError.message);
      }
    }

    // Fallback to default database
    if (!updatedUser) {
      try {
        const User = require('../models/User');
        updatedUser = await User.findByIdAndUpdate(
          userId,
          { $set: updateData },
          { new: true, runValidators: true }
        ).select('-password').lean();
        
        if (updatedUser) {
          console.log('✅ Profile picture updated via default database');
        }
      } catch (defaultError) {
        console.error('Default database update failed:', defaultError.message);
      }
    }

    if (!updatedUser) {
      // If database update failed, try to clean up uploaded image
      try {
        await deleteCloudinaryImage(uploadResult.public_id);
      } catch (cleanupError) {
        console.error('Failed to cleanup uploaded image:', cleanupError.message);
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to update profile picture in database'
      });
    }

    // Clean up old profile picture from Cloudinary (optional, run in background)
    if (currentUser.profilePicture && currentUser.profilePicture !== uploadResult.secure_url) {
      try {
        const oldPublicId = extractPublicId(currentUser.profilePicture);
        if (oldPublicId) {
          // Don't await this - run in background
          deleteCloudinaryImage(oldPublicId).catch(err => {
            console.error('Failed to delete old profile picture:', err.message);
          });
        }
      } catch (cleanupError) {
        console.error('Error extracting old image public ID:', cleanupError.message);
      }
    }

    console.log('✅ Profile picture upload completed successfully');

    return res.status(200).json({
      success: true,
      message: 'Profile picture updated successfully',
      data: {
        profilePicture: uploadResult.secure_url,
        user: updatedUser
      }
    });

  } catch (error) {
    console.error('❌ Error in uploadProfilePicture:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload profile picture',
      error: error.message
    });
  }
};

// Add this method to your userController.js exports (after the uploadProfilePicture method)

exports.deleteProfilePicture = async (req, res) => {
  try {
    console.log('=== DELETE PROFILE PICTURE ===');
    console.log('User ID:', req.user?.id || req.user?._id);

    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    // Get current user to find existing profile picture
    let currentUser = null;

    // Try to get user from tenant connection first
    if (req.tenantConnection) {
      try {
        const User = req.tenantConnection.model('User');
        currentUser = await User.findById(userId).select('profilePicture');
      } catch (tenantError) {
        console.error('Tenant user lookup failed:', tenantError.message);
      }
    }

    // Fallback to default database
    if (!currentUser) {
      try {
        const User = require('../models/User');
        currentUser = await User.findById(userId).select('profilePicture');
      } catch (defaultError) {
        console.error('Default database user lookup failed:', defaultError.message);
      }
    }

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user has a profile picture to delete
    if (!currentUser.profilePicture) {
      return res.status(400).json({
        success: false,
        message: 'No profile picture to delete'
      });
    }

    console.log('🗑️ Deleting profile picture:', currentUser.profilePicture);

    // Remove profile picture from database first
    const updateData = {
      profilePicture: null,
      updatedAt: new Date()
    };

    let updatedUser = null;

    // Try tenant connection first
    if (req.tenantConnection) {
      try {
        if (req.tenantConnection.db) {
          // Direct collection update
          const usersCollection = req.tenantConnection.db.collection('users');
          const mongoose = require('mongoose');
          
          const userObjectId = mongoose.Types.ObjectId.isValid(userId)
            ? new mongoose.Types.ObjectId(userId)
            : userId;

          const updateResult = await usersCollection.updateOne(
            { _id: userObjectId },
            { $set: updateData }
          );

          if (updateResult.modifiedCount > 0) {
            updatedUser = await usersCollection.findOne(
              { _id: userObjectId },
              { projection: { password: 0 } }
            );
            console.log('✅ Profile picture removed via tenant connection');
          }
        }

        if (!updatedUser) {
          const User = req.tenantConnection.model('User');
          updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: updateData },
            { new: true, runValidators: true }
          ).select('-password').lean();
        }
      } catch (tenantError) {
        console.error('Tenant update failed:', tenantError.message);
      }
    }

    // Fallback to default database
    if (!updatedUser) {
      try {
        const User = require('../models/User');
        updatedUser = await User.findByIdAndUpdate(
          userId,
          { $set: updateData },
          { new: true, runValidators: true }
        ).select('-password').lean();
        
        if (updatedUser) {
          console.log('✅ Profile picture removed via default database');
        }
      } catch (defaultError) {
        console.error('Default database update failed:', defaultError.message);
      }
    }

    if (!updatedUser) {
      return res.status(500).json({
        success: false,
        message: 'Failed to remove profile picture from database'
      });
    }

    // Delete image from Cloudinary (run in background, don't fail if this fails)
    try {
      const oldPublicId = extractPublicId(currentUser.profilePicture);
      if (oldPublicId) {
        // Run deletion in background - don't await
        deleteCloudinaryImage(oldPublicId).then(result => {
          console.log('✅ Old profile picture deleted from Cloudinary:', result);
        }).catch(error => {
          console.error('❌ Failed to delete image from Cloudinary:', error.message);
          // Don't fail the request if Cloudinary deletion fails
        });
      }
    } catch (cleanupError) {
      console.error('Error extracting public ID for deletion:', cleanupError.message);
      // Don't fail the request if we can't extract the public ID
    }

    console.log('✅ Profile picture deletion completed successfully');

    return res.status(200).json({
      success: true,
      message: 'Profile picture deleted successfully',
      data: {
        profilePicture: null,
        user: updatedUser
      }
    });

  } catch (error) {
    console.error('❌ Error in deleteProfilePicture:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete profile picture',
      error: error.message
    });
  }
};