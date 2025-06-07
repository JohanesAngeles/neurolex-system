// server/src/controllers/journalController.js - FIXED VERSION WITH AUTO-DOCTOR ASSIGNMENT

const JournalEntry = require('../models/JournalEntry');
const PatientDoctorAssociation = require('../models/PatientDoctorAssociation');
const FormTemplate = require('../models/FormTemplate');
const Appointment = require('../models/Appointment');
const nlpService = require('../services/nlpService');
const dbManager = require('../utils/dbManager');

// ✅ FIXED: Helper function to find patient's assigned doctor
async function findPatientAssignedDoctor(userId, tenantConnection = null) {
  try {
    console.log(`Finding assigned doctor for patient: ${userId}`);
    
    let Appointment, PatientDoctorAssociation;
    
    // Get the correct models based on tenant connection
    if (tenantConnection) {
      Appointment = tenantConnection.model('Appointment');
      PatientDoctorAssociation = tenantConnection.model('PatientDoctorAssociation');
    } else {
      Appointment = require('../models/Appointment');
      PatientDoctorAssociation = require('../models/PatientDoctorAssociation');
    }
    
    // Strategy 1: Find from active/scheduled appointments (most reliable)
    const activeAppointment = await Appointment.findOne({
      patient: userId,
      status: { $in: ['Scheduled', 'Completed'] }
    }).sort({ appointmentDate: -1 }); // Get most recent appointment
    
    if (activeAppointment && activeAppointment.doctor) {
      console.log(`Found doctor from appointment: ${activeAppointment.doctor}`);
      return activeAppointment.doctor;
    }
    
    // Strategy 2: Find from patient-doctor associations (fallback)
    const association = await PatientDoctorAssociation.findOne({
      patient: userId,
      status: 'active'
    });
    
    if (association && association.doctor) {
      console.log(`Found doctor from association: ${association.doctor}`);
      return association.doctor;
    }
    
    console.log(`No assigned doctor found for patient: ${userId}`);
    return null;
    
  } catch (error) {
    console.error('Error finding assigned doctor:', error);
    return null;
  }
}

// ✅ FIXED: Submit a new journal entry with auto-doctor assignment
exports.submitJournalEntry = async (req, res) => {
  try {
    console.log('Request received for journal submission');
    
    // Enhanced debug logging for tenant connections
    console.log('Current request details:', {
      tenantId: req.tenantId,
      bodyTenantId: req.body._tenantId,
      userId: req.userId || req.user?.id,
      hasConnection: !!req.tenantConnection,
      connectionDbName: req.tenantConnection ? req.tenantConnection.db.databaseName : 'none',
      path: req.path,
      headers: {
        tenantId: req.headers['x-tenant-id'] || 'none'
      }
    });
    
    // If tenantId is missing from req but present in body or headers, use it
    if (!req.tenantId) {
      const fallbackTenantId = req.body._tenantId || req.headers['x-tenant-id'];
      
      if (fallbackTenantId) {
        req.tenantId = fallbackTenantId;
        console.log(`Using tenant ID from request or headers: ${req.tenantId}`);
        
        try {
          console.log(`Manually connecting to tenant database with ID: ${req.tenantId}`);
          const connection = await dbManager.connectTenant(req.tenantId);
          
          if (connection) {
            req.tenantConnection = connection;
            console.log(`Manually connected to tenant database: ${connection.db.databaseName}`);
          } else {
            console.error('Failed to manually connect to tenant database');
          }
        } catch (connErr) {
          console.error('Error manually connecting to tenant database:', connErr);
        }
      }
    }
    
    const userId = req.user.id;
    
    if (!userId) {
      console.error('User ID not available in request');
      return res.status(401).json({
        success: false,
        message: 'Authentication required - user ID not found'
      });
    }
    
    console.log(`Processing journal entry for user ID: ${userId}`);
    
    // Extract journal data
    const { rawText, isSharedWithDoctor, isPrivate } = req.body;
    
    console.log('Journal data received:', {
      rawText: rawText ? 'Present' : 'Not present',
      isSharedWithDoctor: isSharedWithDoctor
    });
    
    // Validate required fields
    if (!rawText || rawText.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Journal content (rawText) is required'
      });
    }
    
    // Get the correct model
    let JournalEntry;
    let databaseUsed = 'default';
    
    if (req.tenantConnection) {
      try {
        console.log('Using tenant connection for JournalEntry model');
        JournalEntry = req.tenantConnection.model('JournalEntry');
        databaseUsed = req.tenantConnection.db.databaseName;
        console.log(`JournalEntry model will save to database: ${databaseUsed}`);
      } catch (modelError) {
        console.error('Error getting JournalEntry model from tenant connection:', modelError);
      }
    }
    
    if (!JournalEntry) {
      console.log('Using default database model');
      JournalEntry = require('../models/JournalEntry');
      databaseUsed = 'default (required)';
    }
    
    // ✅ NEW: Find and assign the patient's doctor
    console.log('Finding assigned doctor for patient...');
    const assignedDoctorId = await findPatientAssignedDoctor(userId, req.tenantConnection);
    
    if (assignedDoctorId) {
      console.log(`✅ Found assigned doctor: ${assignedDoctorId}`);
    } else {
      console.log('⚠️ No assigned doctor found - journal will be unassigned');
    }
    
    // ✅ FIXED: Create journal entry with assigned doctor
    const journalEntry = new JournalEntry({
      user: userId,
      rawText: rawText.trim(),
      assignedDoctor: assignedDoctorId, // ✅ NOW PROPERLY ASSIGNED!
      isSharedWithDoctor: isSharedWithDoctor !== false,
      isPrivate: isPrivate || false,
      tenantId: req.tenantId
    });
    
    console.log('Saving journal entry to database...');
    console.log('Journal entry data:', {
      user: userId,
      assignedDoctor: assignedDoctorId,
      isSharedWithDoctor: journalEntry.isSharedWithDoctor,
      isPrivate: journalEntry.isPrivate
    });
    
    const savedEntry = await journalEntry.save();
    
    console.log(`✅ Journal entry saved successfully with ID: ${savedEntry._id} to database: ${databaseUsed}`);
    console.log(`✅ Assigned to doctor: ${savedEntry.assignedDoctor || 'None'}`);
    
    return res.status(201).json({
      success: true,
      data: savedEntry,
      message: 'Journal entry created successfully',
      assignedDoctor: assignedDoctorId,
      databaseInfo: {
        name: databaseUsed
      }
    });
  } catch (error) {
    console.error('Error submitting journal entry:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Error submitting journal entry',
      error: error.message
    });
  }
};

// ✅ IMPROVED: Get doctor journal entries with better debugging
exports.getDoctorJournalEntries = async (req, res) => {
  try {
    const { 
      patient, 
      dateFrom, 
      dateTo, 
      sentiment, 
      analyzed, 
      page = 1, 
      limit = 10 
    } = req.query;

    const doctorId = req.user._id;
    console.log(`🩺 Doctor ${doctorId} requesting journal entries`);

    // Get the correct model first
    let JournalEntry;
    if (req.tenantConnection) {
      JournalEntry = req.tenantConnection.model('JournalEntry');
      console.log('Using tenant connection for doctor journal entries');
    } else {
      JournalEntry = require('../models/JournalEntry');
      console.log('Using default database for doctor journal entries');
    }

    // ✅ SIMPLE QUERY - Let MongoDB handle the ObjectId comparison naturally
    const baseQuery = {
      $or: [
        { assignedDoctor: doctorId }, // MongoDB will handle ObjectId comparison
        { 
          isSharedWithDoctor: true,
          assignedDoctor: null
        }
      ],
      $and: [
        {
          $or: [
            { isPrivate: { $ne: true } },
            { isPrivate: { $exists: false } }
          ]
        }
      ]
    };
    
    // Add additional filters
    if (patient) {
      baseQuery.user = patient;
      console.log(`📋 Filtering by patient: ${patient}`);
    }
    
    if (dateFrom || dateTo) {
      baseQuery.createdAt = {};
      if (dateFrom) baseQuery.createdAt.$gte = new Date(dateFrom);
      if (dateTo) baseQuery.createdAt.$lte = new Date(dateTo);
      console.log(`📅 Date filter applied: ${dateFrom} to ${dateTo}`);
    }
    
    if (sentiment) {
      baseQuery['sentimentAnalysis.sentiment.type'] = sentiment;
      console.log(`😊 Sentiment filter: ${sentiment}`);
    }
    
    if (analyzed === 'analyzed') {
      baseQuery['sentimentAnalysis.sentiment'] = { $exists: true };
    } else if (analyzed === 'unanalyzed') {
      baseQuery['sentimentAnalysis.sentiment'] = { $exists: false };
    }

    const skip = (page - 1) * limit;
    
    console.log('🔍 Final query:', JSON.stringify(baseQuery, null, 2));
    
    // ✅ SIMPLE DEBUG - Safe operations only
    try {
      const totalEntries = await JournalEntry.countDocuments({});
      console.log(`🔍 Total entries in database: ${totalEntries}`);
      
      const doctorEntries = await JournalEntry.countDocuments({ assignedDoctor: doctorId });
      console.log(`🔍 Entries assigned to this doctor: ${doctorEntries}`);
      
      const sharedEntries = await JournalEntry.countDocuments({ isSharedWithDoctor: true });
      console.log(`🔍 Entries shared with doctors: ${sharedEntries}`);
      
    } catch (debugError) {
      console.log('⚠️ Debug failed:', debugError.message);
    }
    
    // Fetch entries
    const entries = await JournalEntry.find(baseQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate({
        path: 'user',
        select: 'firstName lastName'
      })
      .populate({
        path: 'assignedDoctor',
        select: 'firstName lastName'
      });

    const total = await JournalEntry.countDocuments(baseQuery);
    
    console.log(`📊 Query returned ${entries.length} entries, total count: ${total}`);
    
    // Log entry details if found
    if (entries.length > 0) {
      console.log('✅ Found entries:');
      entries.forEach((entry, index) => {
        console.log(`Entry ${index + 1}: ID ${entry._id}, Patient: ${entry.user?.firstName || 'Unknown'}, Doctor: ${entry.assignedDoctor?.firstName || 'Unassigned'}, Shared: ${entry.isSharedWithDoctor}`);
      });
    } else {
      console.log('❌ No entries matched the query');
    }

    // Transform entries for frontend
    const transformedEntries = entries.map(entry => ({
      _id: entry._id,
      date: entry.createdAt,
      patientName: entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : 'Unknown',
      content: entry.rawText ? entry.rawText.substring(0, 100) + '...' : 'No content',
      sentiment: entry.sentimentAnalysis?.sentiment,
      isAnalyzed: !!entry.sentimentAnalysis?.sentiment,
      isShared: entry.isSharedWithDoctor,
      isPrivate: entry.isPrivate,
      assignedDoctor: entry.assignedDoctor
    }));

    return res.status(200).json({
      success: true,
      data: transformedEntries,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      }
    });
    
  } catch (error) {
    console.error('❌ Error in getDoctorJournalEntries:', error);
    console.error('❌ Error stack:', error.stack);
    
    return res.status(500).json({
      success: false,
      message: 'Error fetching journal entries',
      error: error.message
    });
  }
};

// ✅ IMPROVED: Get specific doctor journal entry
exports.getDoctorJournalEntry = async (req, res) => {
  try {
    const doctorId = req.user._id;
    const { id } = req.params;
    
    console.log(`🩺 Doctor ${doctorId} requesting journal entry ${id}`);
    
    // Get the correct model
    let JournalEntry;
    if (req.tenantConnection) {
      JournalEntry = req.tenantConnection.model('JournalEntry');
    } else {
      JournalEntry = require('../models/JournalEntry');
    }
    
    // ✅ IMPROVED: Better query for single entry
    const entry = await JournalEntry.findOne({
      _id: id,
      $and: [
        {
          $or: [
            { assignedDoctor: doctorId },
            { 
              isSharedWithDoctor: true,
              assignedDoctor: null
            }
          ]
        },
        { isPrivate: { $ne: true } }
      ]
    })
    .populate({
      path: 'user',
      select: 'firstName lastName'
    })
    .populate({
      path: 'assignedDoctor',
      select: 'firstName lastName'
    });
    
    if (!entry) {
      console.log(`❌ Journal entry ${id} not found or not accessible by doctor ${doctorId}`);
      return res.status(404).json({
        success: false,
        message: 'Journal entry not found or you do not have permission to view it'
      });
    }
    
    console.log(`✅ Found journal entry for doctor:`, {
      id: entry._id,
      patient: entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : 'Unknown',
      assignedDoctor: entry.assignedDoctor || 'Unassigned',
      isShared: entry.isSharedWithDoctor
    });
    
    // Transform entry
    const transformedEntry = {
      ...entry.toObject(),
      patientName: entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : 'Unknown',
      date: entry.createdAt,
      sentiment: entry.sentimentAnalysis?.sentiment,
      isAnalyzed: !!entry.sentimentAnalysis?.sentiment
    };
    
    return res.status(200).json({
      success: true,
      data: transformedEntry
    });
  } catch (error) {
    console.error('❌ Error fetching doctor journal entry:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching journal entry',
      error: error.message
    });
  }
};

// Keep all other existing methods unchanged...
exports.getUserJournalEntries = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id || req.userId;
    
    console.log('Getting journal entries for user with extracted ID:', userId);
    
    if (!userId) {
      console.error('No user ID found in request:', { 
        reqUserId: req.user?.id, 
        reqUser_id: req.user?._id, 
        reqUserId_direct: req.userId 
      });
      return res.status(400).json({
        success: false,
        message: 'User ID not found in request'
      });
    }
    
    const { limit = 10, page = 1, startDate, endDate } = req.query;
    
    // Get the correct JournalEntry model based on tenant connection
    let JournalEntry;
    let databaseUsed = 'default';
    
    if (req.tenantConnection) {
      try {
        console.log('Using tenant connection for fetching journal entries');
        JournalEntry = req.tenantConnection.model('JournalEntry');
        databaseUsed = req.tenantConnection.db.databaseName;
        console.log(`JournalEntry model will fetch from database: ${databaseUsed}`);
      } catch (modelError) {
        console.error('Error getting JournalEntry model from tenant connection:', modelError);
      }
    }
    
    if (!JournalEntry) {
      console.log('Using default database model for journal entries');
      JournalEntry = require('../models/JournalEntry');
      databaseUsed = 'default (required)';
    }
    
    // Build query
    const query = { user: userId };
    
    // Add date range if provided
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    console.log(`Querying journal entries with:`, query);
    
    // Get entries
    const entries = await JournalEntry.find(query)
      .sort({ createdAt: -1 }) // Most recent first
      .skip(skip)
      .limit(parseInt(limit))
      .populate({
        path: 'assignedDoctor',
        select: 'firstName lastName'
      });
    
    // Get total count for pagination
    const total = await JournalEntry.countDocuments(query);
    
    console.log(`Found ${entries.length} journal entries for user ${userId} in database ${databaseUsed}`);
    
    // Add cache-busting headers
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Expires', '-1');
    res.setHeader('Pragma', 'no-cache');
    
    return res.status(200).json({
      success: true,
      data: entries,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      },
      dbInfo: databaseUsed
    });
  } catch (error) {
    console.error('Error fetching journal entries:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching journal entries',
      error: error.message
    });
  }
};

// Keep all other existing methods unchanged...
exports.getJournalEntry = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    
    const entry = await JournalEntry.findOne({
      _id: id,
      $or: [
        { user: userId },
        { assignedDoctor: userId },
        { isSharedWithDoctor: true }
      ]
    }).populate({
      path: 'assignedDoctor',
      select: 'firstName lastName'
    }).populate({
      path: 'user',
      select: 'firstName lastName'
    });
    
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Journal entry not found or you do not have permission to view it'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: entry
    });
  } catch (error) {
    console.error('Error fetching journal entry:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching journal entry',
      error: error.message
    });
  }
};

exports.updateJournalEntry = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { rawText, isPrivate, isSharedWithDoctor } = req.body;
    
    const entry = await JournalEntry.findOne({
      _id: id,
      user: userId
    });
    
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Journal entry not found'
      });
    }
    
    if (rawText !== undefined) entry.rawText = rawText;
    if (isPrivate !== undefined) entry.isPrivate = isPrivate;
    if (isSharedWithDoctor !== undefined) entry.isSharedWithDoctor = isSharedWithDoctor;
    
    await entry.save();
    
    return res.status(200).json({
      success: true,
      data: entry
    });
  } catch (error) {
    console.error('Error updating journal entry:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating journal entry',
      error: error.message
    });
  }
};

exports.deleteJournalEntry = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    
    const entry = await JournalEntry.findOneAndDelete({
      _id: id,
      user: userId
    });
    
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Journal entry not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Journal entry deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting journal entry:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting journal entry',
      error: error.message
    });
  }
};

// Keep all other methods the same (templates, analysis, notes, etc.)
exports.getDefaultTemplates = async (req, res) => {
  try {
    const templates = await FormTemplate.find({ 
      isActive: true,
      category: { $in: ['daily_reflection', 'mood_tracking', 'general'] }
    }).sort({ createdAt: -1 });
    
    return res.status(200).json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('Error fetching default templates:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching default templates',
      error: error.message
    });
  }
};

exports.getAssignedTemplates = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const associations = await PatientDoctorAssociation.find({
      patient: userId,
      status: 'active'
    }).populate({
      path: 'assignedTemplates.template',
      select: 'name description fields createdAt'
    });
    
    const templates = [];
    associations.forEach(assoc => {
      assoc.assignedTemplates.forEach(assignment => {
        if (assignment.active && assignment.template) {
          templates.push(assignment.template);
        }
      });
    });
    
    if (templates.length === 0) {
      const defaultTemplates = await FormTemplate.find({ 
        isActive: true,
        category: { $in: ['daily_reflection', 'mood_tracking', 'general'] }
      }).sort({ createdAt: -1 });
      
      return res.status(200).json({
        success: true,
        data: defaultTemplates
      });
    }
    
    return res.status(200).json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('Error fetching assigned templates:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching assigned templates',
      error: error.message
    });
  }
};

// Fix for analyzeJournalEntry function in server/src/controllers/journalController.js
// Replace lines 835-868 with this corrected version:


exports.analyzeJournalEntry = async (req, res) => {
  try {
    const doctorId = req.user._id;
    const { id } = req.params;
    const { sentiment, notes, useAI, applyChanges = true } = req.body;
    
    console.log(`🩺 Doctor ${doctorId} attempting to analyze journal entry ${id}`);
    console.log('🚨 USING NEW ANALYZE FUNCTION WITH DEBUGGING!');
    
    // Get the correct model
    let JournalEntry;
    if (req.tenantConnection) {
      JournalEntry = req.tenantConnection.model('JournalEntry');
      console.log('Using tenant connection for journal analysis');
    } else {
      JournalEntry = require('../models/JournalEntry');
      console.log('Using default database for journal analysis');
    }
    
    // Find the journal entry with proper permissions
    const entry = await JournalEntry.findOne({
      _id: id,
      $and: [
        {
          $or: [
            { assignedDoctor: doctorId },
            { 
              isSharedWithDoctor: true,
              assignedDoctor: null
            }
          ]
        },
        { isPrivate: { $ne: true } }
      ]
    });
    
    if (!entry) {
      console.log(`❌ Journal entry ${id} not found or not accessible by doctor ${doctorId}`);
      return res.status(404).json({
        success: false,
        message: 'Journal entry not found or you do not have permission to analyze it'
      });
    }
    
    console.log(`✅ Found journal entry for analysis`);
    
    // ✅ FUNCTION TO MAP AI FLAGS TO VALID SCHEMA VALUES
    function mapFlagsToValidEnums(flags) {
      if (!Array.isArray(flags)) return [];
      
      const flagMapping = {
        // Depression risk flags → 'attention_needed'
        'moderate_depression_risk': 'attention_needed',
        'severe_depression_risk': 'attention_needed', 
        'mild_depression_risk': 'attention_needed',
        'depression_indicator': 'attention_needed',
        'depression_emotion_pattern': 'attention_needed',
        
        // Risk flags → 'attention_needed' 
        'self_harm_risk': 'attention_needed',
        'suicide_risk': 'attention_needed',
        'crisis_indicator': 'attention_needed',
        'severe_concern': 'attention_needed',
        'moderate_concern': 'attention_needed',
        'professional_review': 'attention_needed',
        'review_needed': 'attention_needed',
        
        // Positive flags → 'positive_content'
        'positive_indicator': 'positive_content',
        'recovery_sign': 'positive_content',
        'coping_strategy': 'positive_content',
        'improvement': 'positive_content',
        'progress': 'positive_content'
      };
      
      // Map flags and remove duplicates
      const mappedFlags = flags.map(flag => flagMapping[flag] || 'attention_needed');
      return [...new Set(mappedFlags)]; // Remove duplicates
    }
    
    let aiAnalysis = null;
    
    if (useAI) {
      console.log('🤖 Starting optimized Hugging Face AI analysis...');
      
      try {
        const textToAnalyze = entry.rawText || '';
        
        if (textToAnalyze) {
          const MAX_TEXT_LENGTH = 1000;
          const truncatedText = textToAnalyze.length > MAX_TEXT_LENGTH 
            ? textToAnalyze.substring(0, MAX_TEXT_LENGTH) + '...'
            : textToAnalyze;
            
          console.log(`📝 Analyzing text (${truncatedText.length} chars):`, truncatedText.substring(0, 100) + '...');
          
          const FAST_TIMEOUT = 15000;
          
          const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => {
              console.log('⏰ AI analysis timeout reached, using intelligent fallback');
              resolve(createIntelligentFallback(truncatedText));
            }, FAST_TIMEOUT);
          });
          
          const analysisPromise = (async () => {
            try {
              console.log('🚀 Calling optimized NLP service...');
              const result = await nlpService.analyzeJournalEntry({ 
                text: truncatedText,
                timeout: 12000
              });
              console.log('✅ NLP service completed successfully');
              return result;
            } catch (nlpError) {
              console.log('⚠️ NLP service failed, creating intelligent fallback');
              return createIntelligentFallback(truncatedText);
            }
          })();
          
          aiAnalysis = await Promise.race([analysisPromise, timeoutPromise]);
          
          console.log('🎉 AI analysis completed:', aiAnalysis ? 'Success' : 'Fallback used');
          
          // ✅ DEBUGGING: Let's see what the NLP service actually returns
          console.log('🔍 RAW AI Analysis Response:', JSON.stringify(aiAnalysis, null, 2));
          
          // ✅ SAVE AI ANALYSIS RESULTS
          if (applyChanges && aiAnalysis) {
            if (!entry.sentimentAnalysis) {
              entry.sentimentAnalysis = {};
            }
            
            // ✅ DEBUGGING: Check what emotions we have
            console.log('🔍 Emotions from AI:', aiAnalysis.emotions);
            console.log('🔍 Emotions type:', typeof aiAnalysis.emotions);
            console.log('🔍 Is emotions array?', Array.isArray(aiAnalysis.emotions));
            
            // ✅ Map flags to valid enum values before saving
            const mappedSentimentFlags = mapFlagsToValidEnums(aiAnalysis.sentiment?.flags || []);
            const mappedGlobalFlags = mapFlagsToValidEnums(aiAnalysis.flags || []);
            
            console.log('🏷️ Original sentiment flags:', aiAnalysis.sentiment?.flags || []);
            console.log('🏷️ Mapped sentiment flags:', mappedSentimentFlags);
            console.log('🏷️ Original global flags:', aiAnalysis.flags || []);
            console.log('🏷️ Mapped global flags:', mappedGlobalFlags);
            
            // ✅ FIXED: Save sentiment according to schema structure
            entry.sentimentAnalysis.sentiment = {
              type: aiAnalysis.sentiment?.type || aiAnalysis.sentiment || 'neutral',
              score: aiAnalysis.sentiment?.score || 50,
              confidence: aiAnalysis.sentiment?.confidence || 0.5,
              flags: mappedSentimentFlags // ✅ Use mapped flags
            };
            
            // ✅ FIXED: Save emotions, highlights, etc. at ROOT level of sentimentAnalysis
            entry.sentimentAnalysis.emotions = Array.isArray(aiAnalysis.emotions) ? aiAnalysis.emotions : [];
            entry.sentimentAnalysis.summary = aiAnalysis.summary || '';
            entry.sentimentAnalysis.flags = mappedGlobalFlags; // ✅ Use mapped flags
            entry.sentimentAnalysis.timestamp = new Date();
            entry.sentimentAnalysis.source = 'ai';
            
            // ✅ FINAL DEBUG: What are we actually saving?
            console.log('💾 SAVING emotions:', JSON.stringify(entry.sentimentAnalysis.emotions, null, 2));
            console.log('💾 SAVING sentiment:', JSON.stringify(entry.sentimentAnalysis.sentiment, null, 2));
            
            try {
              await entry.save();
              console.log('💾 Analysis results saved to database successfully');
            } catch (saveError) {
              console.error('❌ Error saving analysis:', saveError);
              // Create intelligent fallback and try again
              console.log('🧠 Creating intelligent fallback due to save error...');
              aiAnalysis = createIntelligentFallback(truncatedText);
              
              // Try saving with fallback data
              entry.sentimentAnalysis.sentiment = {
                type: aiAnalysis.sentiment?.type || 'neutral',
                score: aiAnalysis.sentiment?.score || 50,
                confidence: aiAnalysis.sentiment?.confidence || 0.5,
                flags: mapFlagsToValidEnums(aiAnalysis.sentiment?.flags || [])
              };
              
              entry.sentimentAnalysis.emotions = aiAnalysis.emotions || [];
              entry.sentimentAnalysis.summary = aiAnalysis.summary || '';
              entry.sentimentAnalysis.flags = mapFlagsToValidEnums(aiAnalysis.flags || []);
              entry.sentimentAnalysis.timestamp = new Date();
              entry.sentimentAnalysis.source = 'ai';
              
              await entry.save();
              console.log('✅ Intelligent fallback saved successfully');
            }
          }
        }
      } catch (error) {
        console.error('❌ Error in AI analysis:', error);
        console.log('🧠 Creating intelligent fallback analysis...');
        aiAnalysis = createIntelligentFallback(entry.rawText || '');
        console.log('✅ Intelligent fallback created: ' + aiAnalysis.sentiment?.type + ' sentiment, ' + (aiAnalysis.emotions?.length || 0) + ' emotions');
      }
    }
    
    // ✅ Handle manual sentiment with correct structure
    if (sentiment && applyChanges) {
      if (!entry.sentimentAnalysis) {
        entry.sentimentAnalysis = {};
      }
      
      // ✅ Map manual flags too
      const mappedManualFlags = mapFlagsToValidEnums(sentiment.flags || []);
      
      // ✅ FIXED: Structure sentiment as object (not string)
      entry.sentimentAnalysis.sentiment = {
        type: sentiment.type || sentiment || 'neutral',
        score: sentiment.score || 50,
        confidence: sentiment.confidence || 0.8,
        flags: mappedManualFlags // ✅ Use mapped flags
      };
      
      // ✅ FIX: Also save emotions at root level
      if (sentiment.emotions) {
        entry.sentimentAnalysis.emotions = sentiment.emotions;
      }
      
      entry.sentimentAnalysis.timestamp = new Date();
      entry.sentimentAnalysis.source = 'manual'; // ✅ Use 'manual' instead of 'doctor'
    }
    
    // ✅ Handle doctor notes correctly
    if (notes && applyChanges) {
      let noteContent = '';
      
      if (Array.isArray(notes)) {
        noteContent = notes.length > 0 ? notes.join(' ') : '';
      } else if (typeof notes === 'string') {
        noteContent = notes.trim();
      }
      
      if (noteContent && noteContent.length > 0) {
        if (!entry.doctorNotes) {
          entry.doctorNotes = [];
        }
        
        entry.doctorNotes.push({
          content: noteContent,
          createdBy: doctorId,
          createdAt: new Date()
        });
        
        console.log(`📝 Added doctor note: "${noteContent.substring(0, 50)}..."`);
      } else {
        console.log('⚠️ Notes parameter received but was empty, skipping note creation');
      }
    }
    
    if (applyChanges && (sentiment || notes)) {
      await entry.save();
    }
    
    const responseData = {
      success: true,
      message: 'Journal entry analyzed successfully'
    };
    
    if (aiAnalysis) {
      responseData.aiAnalysis = aiAnalysis;
    }
    
    if (applyChanges) {
      responseData.data = entry;
    }
    
    console.log(`✅ Analysis completed successfully for entry ${id}`);
    
    return res.status(200).json(responseData);
    
  } catch (error) {
    console.error('❌ Fatal error in analyzeJournalEntry:', error);
    return res.status(500).json({
      success: false,
      message: 'Error analyzing journal entry',
      error: error.message
    });
  }
};

// ✅ FIXED: Update intelligent fallback to return correct structure and valid flags
function createIntelligentFallback(text) {
  console.log('🧠 Creating intelligent fallback analysis...');
  
  if (!text || text.trim() === '') {
    return {
      sentiment: { 
        type: 'neutral', 
        score: 50, 
        confidence: 0.3,
        flags: []
      },
      emotions: [{ name: 'neutral', score: 0.5 }],
      highlights: [],
      flags: [],
      summary: 'No content to analyze',
      source: 'ai'
    };
  }
  
  const lowerText = text.toLowerCase();
  
  const positiveWords = ['happy', 'good', 'great', 'wonderful', 'amazing', 'love', 'joy', 'excited', 'grateful', 'blessed', 'hope', 'better', 'progress', 'success', 'smile', 'laugh'];
  const negativeWords = ['sad', 'bad', 'terrible', 'awful', 'hate', 'angry', 'depressed', 'anxious', 'worried', 'fear', 'pain', 'hurt', 'difficult', 'struggle', 'problem', 'stress'];
  const emotionWords = {
    sadness: ['sad', 'cry', 'tear', 'grief', 'sorrow', 'down', 'blue'],
    anxiety: ['anxious', 'worry', 'nervous', 'panic', 'stress', 'overwhelm'],
    anger: ['angry', 'mad', 'furious', 'irritated', 'frustrated'],
    joy: ['happy', 'joy', 'excited', 'thrilled', 'elated'],
    fear: ['scared', 'afraid', 'terrified', 'fearful'],
    hope: ['hope', 'optimistic', 'positive', 'bright', 'future']
  };
  
  let positiveScore = 0;
  let negativeScore = 0;
  const detectedEmotions = [];
  const highlights = [];
  
  positiveWords.forEach(word => {
    if (lowerText.includes(word)) {
      positiveScore++;
      if (highlights.length < 3) {
        highlights.push({
          text: `Found positive indicator: "${word}"`,
          keyword: word,
          type: 'positive'
        });
      }
    }
  });
  
  negativeWords.forEach(word => {
    if (lowerText.includes(word)) {
      negativeScore++;
      if (highlights.length < 3) {
        highlights.push({
          text: `Found emotional indicator: "${word}"`,
          keyword: word,
          type: 'negative'
        });
      }
    }
  });
  
  Object.entries(emotionWords).forEach(([emotion, words]) => {
    let emotionScore = 0;
    words.forEach(word => {
      if (lowerText.includes(word)) emotionScore++;
    });
    if (emotionScore > 0) {
      detectedEmotions.push({
        name: emotion,
        score: Math.min(emotionScore * 0.3, 1.0)
      });
    }
  });
  
  let sentimentType = 'neutral';
  let sentimentScore = 50;
  let validFlags = []; // ✅ Use valid flags only
  
  if (positiveScore > negativeScore) {
    sentimentType = 'positive';
    sentimentScore = Math.min(50 + (positiveScore * 10), 90);
    validFlags = ['positive_content'];
  } else if (negativeScore > positiveScore) {
    sentimentType = 'negative';
    sentimentScore = Math.max(50 - (negativeScore * 10), 10);
    validFlags = negativeScore > 2 ? ['attention_needed'] : [];
  }
  
  if (detectedEmotions.length === 0) {
    detectedEmotions.push(
      { name: 'neutral', score: 0.6 },
      { name: 'thoughtful', score: 0.4 }
    );
  }
  
  const wordCount = text.split(' ').length;
  const summary = `Fallback analysis of ${wordCount} words. Detected ${sentimentType} sentiment with ${detectedEmotions.length} primary emotions. ${positiveScore > 0 ? 'Contains positive elements. ' : ''}${negativeScore > 0 ? 'Contains areas of concern. ' : ''}Recommended for professional review.`;
  
  console.log(`✅ Intelligent fallback created: ${sentimentType} sentiment, ${detectedEmotions.length} emotions`);
  
  return {
    sentiment: {
      type: sentimentType,
      score: sentimentScore,
      confidence: 0.7,
      flags: validFlags // ✅ Only valid enum values
    },
    emotions: detectedEmotions.slice(0, 5),
    highlights: highlights,
    flags: validFlags, // ✅ Only valid enum values
    summary: summary,
    source: 'ai'
  };
}

exports.addDoctorNoteToJournalEntry = async (req, res) => {
  try {
    const doctorId = req.user._id;
    const { id } = req.params;
    const { note } = req.body;
    
    if (!note || note.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Note content is required'
      });
    }
    
    const entry = await JournalEntry.findOne({
      _id: id,
      $or: [
        { assignedDoctor: doctorId },
        { isSharedWithDoctor: true }
      ]
    });
    
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Journal entry not found or you do not have permission to add notes'
      });
    }
    
    if (!entry.doctorNotes) {
      entry.doctorNotes = [];
    }
    
    entry.doctorNotes.push({
      doctor: doctorId,
      note: note.trim(),
      createdAt: new Date()
    });
    
    await entry.save();
    
    return res.status(200).json({
      success: true,
      data: entry.doctorNotes,
      message: 'Note added successfully'
    });
  } catch (error) {
    console.error('Error adding note to journal entry:', error);
    return res.status(500).json({
      success: false,
      message: 'Error adding note to journal entry',
      error: error.message
    });
  }
};

exports.getUserJournalCount = async (req, res) => {
  try {
    console.log('Getting journal count for user');
    const userId = req.user._id;
    
    let JournalEntry;
    let databaseUsed = 'default';
    
    if (req.tenantConnection) {
      try {
        console.log('Using tenant connection for journal count');
        JournalEntry = req.tenantConnection.model('JournalEntry');
        databaseUsed = req.tenantConnection.db.databaseName;
        console.log(`JournalEntry model will count from database: ${databaseUsed}`);
      } catch (modelError) {
        console.error('Error getting JournalEntry model from tenant connection for count:', modelError);
      }
    }
    
    if (!JournalEntry) {
      console.log('Using default database model for journal count');
      JournalEntry = require('../models/JournalEntry');
      databaseUsed = 'default (required)';
    }
    
    const count = await JournalEntry.countDocuments({ user: userId });
    console.log(`Found ${count} journal entries for user ${userId} in database ${databaseUsed}`);
    
    return res.status(200).json({
      success: true,
      count,
      databaseInfo: {
        name: databaseUsed
      }
    });
  } catch (error) {
    console.error('Error getting journal count:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get journal count',
      error: error.message
    });
  }
};