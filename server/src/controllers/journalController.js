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

    // ✅ IMPROVED: Better query construction
    const query = {
      $and: [
        {
          $or: [
            { assignedDoctor: doctorId },
            { 
              isSharedWithDoctor: true,
              assignedDoctor: null // Unassigned but shared entries
            }
          ]
        },
        { isPrivate: { $ne: true } } // Exclude private entries
      ]
    };
    
    if (patient) {
      query.user = patient;
      console.log(`📋 Filtering by patient: ${patient}`);
    }
    
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
      console.log(`📅 Date filter applied: ${dateFrom} to ${dateTo}`);
    }
    
    if (sentiment) {
      query['sentimentAnalysis.sentiment.type'] = sentiment;
      console.log(`😊 Sentiment filter: ${sentiment}`);
    }
    
    if (analyzed === 'analyzed') {
      query['sentimentAnalysis.sentiment'] = { $exists: true };
    } else if (analyzed === 'unanalyzed') {
      query['sentimentAnalysis.sentiment'] = { $exists: false };
    }

    const skip = (page - 1) * limit;
    
    console.log('🔍 Final query:', JSON.stringify(query, null, 2));
    
    // Get the correct model
    let JournalEntry;
    if (req.tenantConnection) {
      JournalEntry = req.tenantConnection.model('JournalEntry');
      console.log('Using tenant connection for doctor journal entries');
    } else {
      JournalEntry = require('../models/JournalEntry');
      console.log('Using default database for doctor journal entries');
    }
    
    // Fetch entries
    const entries = await JournalEntry.find(query)
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

    const total = await JournalEntry.countDocuments(query);
    
    console.log(`📊 Found ${entries.length} journal entries out of ${total} total for doctor ${doctorId}`);
    
    // Enhanced debugging: Log each entry details
    entries.forEach((entry, index) => {
      console.log(`Entry ${index + 1}:`, {
        id: entry._id,
        patient: entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : 'Unknown',
        assignedDoctor: entry.assignedDoctor || 'Unassigned',
        isShared: entry.isSharedWithDoctor,
        isPrivate: entry.isPrivate,
        date: entry.createdAt
      });
    });

    // Transform entries for doctor view
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
      },
      debug: {
        doctorId,
        queryUsed: query,
        totalFound: total
      }
    });
  } catch (error) {
    console.error('❌ Error fetching doctor journal entries:', error);
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

exports.analyzeJournalEntry = async (req, res) => {
  try {
    const doctorId = req.user._id;
    const { id } = req.params;
    const { sentiment, notes, useAI, applyChanges = true } = req.body;
    
    console.log(`🩺 Doctor ${doctorId} attempting to analyze journal entry ${id}`);
    
    // Get the correct model
    let JournalEntry;
    if (req.tenantConnection) {
      JournalEntry = req.tenantConnection.model('JournalEntry');
      console.log('Using tenant connection for journal analysis');
    } else {
      JournalEntry = require('../models/JournalEntry');
      console.log('Using default database for journal analysis');
    }
    
    // ✅ FIXED: Use the same permission logic as getDoctorJournalEntry
    const entry = await JournalEntry.findOne({
      _id: id,
      $and: [
        {
          $or: [
            { assignedDoctor: doctorId },              // Assigned to this doctor
            { 
              isSharedWithDoctor: true,
              assignedDoctor: null                     // Unassigned but shared entries
            }
          ]
        },
        { isPrivate: { $ne: true } }                  // Exclude private entries
      ]
    });
    
    if (!entry) {
      console.log(`❌ Journal entry ${id} not found or not accessible by doctor ${doctorId}`);
      
      // ✅ Enhanced debugging: Check what the actual entry looks like
      const debugEntry = await JournalEntry.findById(id);
      if (debugEntry) {
        console.log(`📋 Entry exists but access denied:`, {
          id: debugEntry._id,
          assignedDoctor: debugEntry.assignedDoctor,
          isSharedWithDoctor: debugEntry.isSharedWithDoctor,
          isPrivate: debugEntry.isPrivate,
          requestingDoctor: doctorId
        });
      } else {
        console.log(`📋 Entry ${id} does not exist in database`);
      }
      
      return res.status(404).json({
        success: false,
        message: 'Journal entry not found or you do not have permission to analyze it'
      });
    }
    
    console.log(`✅ Found journal entry for analysis:`, {
      id: entry._id,
      assignedDoctor: entry.assignedDoctor || 'Unassigned',
      isShared: entry.isSharedWithDoctor,
      isPrivate: entry.isPrivate
    });
    
    let aiAnalysis = null;
    if (useAI) {
      console.log('Running AI analysis for journal entry:', id);
      
      try {
        const textToAnalyze = entry.rawText || '';
        
        if (textToAnalyze) {
          console.log('Analyzing text with NLP service:', textToAnalyze.substring(0, 100) + '...');
          aiAnalysis = await nlpService.analyzeJournalEntry({ text: textToAnalyze });
          console.log('NLP analysis result:', JSON.stringify(aiAnalysis));
          
          if (applyChanges && aiAnalysis && !aiAnalysis.error) {
            if (!entry.sentimentAnalysis) {
              entry.sentimentAnalysis = {};
            }
            
            entry.sentimentAnalysis = {
              sentiment: aiAnalysis.sentiment,
              emotions: aiAnalysis.emotions,
              highlights: aiAnalysis.highlights,
              flags: aiAnalysis.flags,
              summary: aiAnalysis.summary,
              analyzed: true,
              analyzedAt: new Date(),
              analyzedBy: doctorId,
              source: aiAnalysis.source || 'ai'
            };
            
            await entry.save();
          }
        }
      } catch (nlpError) {
        console.error('Error running NLP analysis:', nlpError);
        
        // ✅ Provide mock analysis in development mode
        if (process.env.NODE_ENV === 'development') {
          console.log('Using mock AI analysis for development');
          aiAnalysis = {
            sentiment: { type: 'neutral', score: 65 },
            emotions: [
              { name: 'calm', score: 0.7 },
              { name: 'thoughtful', score: 0.5 }
            ],
            highlights: [
              {
                text: "Sample highlighted text from journal",
                keyword: "emotion",
                type: "neutral"
              }
            ],
            flags: [],
            summary: "Mock analysis summary for development",
            source: 'mock'
          };
        }
      }
    }
    
    if (sentiment && applyChanges) {
      if (!entry.sentimentAnalysis) {
        entry.sentimentAnalysis = {};
      }
      
      entry.sentimentAnalysis.sentiment = sentiment;
      entry.sentimentAnalysis.analyzedAt = new Date();
      entry.sentimentAnalysis.analyzedBy = doctorId;
      entry.sentimentAnalysis.source = 'doctor';
    }
    
    if (notes && applyChanges) {
      entry.doctorNotes = notes;
    }
    
    if (applyChanges) {
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
    console.error('❌ Error analyzing journal entry:', error);
    return res.status(500).json({
      success: false,
      message: 'Error analyzing journal entry',
      error: error.message
    });
  }
};

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