// server/src/controllers/journalController.js

const JournalEntry = require('../models/JournalEntry');
const PatientDoctorAssociation = require('../models/PatientDoctorAssociation');
const FormTemplate = require('../models/FormTemplate');
const Appointment = require('../models/Appointment');
const nlpService = require('../services/nlpService');
const dbManager = require('../utils/dbManager');

// Submit a new journal entry
// Update the submitJournalEntry function in journalController.js

exports.submitJournalEntry = async (req, res) => {
  try {
    console.log('Request received for journal submission');
    
    // Enhanced debug logging for tenant connections
    console.log('Current request details:', {
      tenantId: req.tenantId,
      bodyTenantId: req.body._tenantId, // Check if tenant ID was sent in the body
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
        
        // Try to connect manually to the tenant database
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
    
    // Get the user ID from the request (set by auth middleware)
    const userId = req.user.id;
    
    if (!userId) {
      console.error('User ID not available in request');
      return res.status(401).json({
        success: false,
        message: 'Authentication required - user ID not found'
      });
    }
    
    console.log(`Processing journal entry for user ID: ${userId}`);
    
    // Extract data from request body
    const { templateId, responses, journalFields, isSharedWithDoctor, title } = req.body;
    
    // Log the journal data being received
    console.log('Journal data received:', {
      journalFields: journalFields ? 'Present' : 'Not present',
      responses: responses ? 'Present' : 'Not present',
      isSharedWithDoctor: isSharedWithDoctor
    });
    
    // Very important - ensure you use the tenant connection when available
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
    
    // If we couldn't get a model from the tenant connection, fallback to default
    if (!JournalEntry) {
      console.log('Using default database model');
      JournalEntry = require('../models/JournalEntry');
      databaseUsed = 'default (required)';
    }
    
    // Prepare rawText for sentiment analysis if needed
    let rawText = '';
    if (journalFields) {
      Object.entries(journalFields).forEach(([key, value]) => {
        if (typeof value === 'string' && value.trim()) {
          rawText += `${value.trim()} `;
        } else if (Array.isArray(value) && value.length > 0) {
          rawText += `${value.join(', ')} `;
        }
      });
    }
    
    // Create journal entry with tenantId included
    const journalEntry = new JournalEntry({
        user: userId,
        template: templateId || null,
        title: title || '', // Add this line to include the title
        responses: responses || {},
        journalFields: journalFields || {},
        rawText: rawText.trim() || null,
        isSharedWithDoctor: isSharedWithDoctor !== false,
        tenantId: req.tenantId
      });
    
    console.log('Saving journal entry to database...');
    
    // Save the entry
    const savedEntry = await journalEntry.save();
    
    console.log(`Journal entry saved successfully with ID: ${savedEntry._id} to database: ${databaseUsed}`);
    
    // Return successful response
    return res.status(201).json({
      success: true,
      data: savedEntry,
      message: 'Journal entry created successfully',
      databaseInfo: {
        name: databaseUsed
      }
    });
  } catch (error) {
    console.error('Error submitting journal entry:', error);
    
    // Determine error type and return appropriate response
    if (error.name === 'ValidationError') {
      // Handle Mongoose validation errors
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    
    // General error handling
    return res.status(500).json({
      success: false,
      message: 'Error submitting journal entry',
      error: error.message
    });
  }
};


// Get journal entries for the logged-in user
exports.getUserJournalEntries = async (req, res) => {
  try {
    // More robust user ID extraction
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
    
    // If we couldn't get a model from the tenant connection, fallback to default
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
        path: 'template',
        select: 'name description'
      })
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

// Get a specific journal entry
// Update getJournalEntry method in journalController.js
exports.getJournalEntry = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    
    // Find the entry with more flexible conditions
    const entry = await JournalEntry.findOne({
      _id: id,
      $or: [
        { user: userId },  // Allow user to see their own entry
        { assignedDoctor: userId },  // Allow assigned doctor to see entry
        { isSharedWithDoctor: true }  // Allow doctors to see shared entries
      ]
    }).populate({
      path: 'template',
      select: 'name description fields'
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

// Update a journal entry
exports.updateJournalEntry = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { responses, isPrivate, isSharedWithDoctor, journalFields } = req.body;
    
    // Find the entry
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
    
    // Update fields
    if (responses) entry.responses = responses;
    if (journalFields) entry.journalFields = journalFields;
    if (isPrivate !== undefined) entry.isPrivate = isPrivate;
    if (isSharedWithDoctor !== undefined) entry.isSharedWithDoctor = isSharedWithDoctor;
    
    // Save changes
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

// Delete a journal entry
exports.deleteJournalEntry = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    
    // Find and delete the entry
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

exports.getDefaultTemplates = async (req, res) => {
  try {
    // Find all active templates that are not assigned to specific users
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

// Get assigned templates for the current user
exports.getAssignedTemplates = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Find active associations with doctors
    const associations = await PatientDoctorAssociation.find({
      patient: userId,
      status: 'active'
    }).populate({
      path: 'assignedTemplates.template',
      select: 'name description fields createdAt'
    });
    
    // Extract templates from associations
    const templates = [];
    associations.forEach(assoc => {
      assoc.assignedTemplates.forEach(assignment => {
        if (assignment.active && assignment.template) {
          templates.push(assignment.template);
        }
      });
    });
    
    // If no templates were found through associations, return default templates
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

// Add this method to the bottom of the journalController.js file
// Add this method to the bottom of the journalController.js file
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

    // Ensure the logged-in user is a doctor
    const doctorId = req.user._id;

    // Build query with OR condition to show entries
    const query = {
      $or: [
        { assignedDoctor: doctorId },
        { isSharedWithDoctor: true }
      ]
    };
    
    // Add patient filter
    if (patient) {
      query.user = patient;
    }
    
    // Add date range filter
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }
    
    // Add sentiment filter
    if (sentiment) {
      query['sentimentAnalysis.sentiment.type'] = sentiment;
    }
    
    // Add analysis status filter
    if (analyzed === 'analyzed') {
      query['sentimentAnalysis.sentiment'] = { $exists: true };
    } else if (analyzed === 'unanalyzed') {
      query['sentimentAnalysis.sentiment'] = { $exists: false };
    }

    // Pagination
    const skip = (page - 1) * limit;
    
    // Fetch entries with populated data
    const entries = await JournalEntry.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate({
        path: 'user',
        select: 'firstName lastName'
      })
      .populate('template');

    // Count total entries
    const total = await JournalEntry.countDocuments(query);

    // Transform entries to include patient name
    const transformedEntries = entries.map(entry => ({
      _id: entry._id,
      date: entry.createdAt,
      patientName: entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : 'Unknown',
      templateName: entry.template ? entry.template.name : 'Custom Entry',
      sentiment: entry.sentimentAnalysis?.sentiment,
      isAnalyzed: !!entry.sentimentAnalysis?.sentiment,
      mood: {
        label: entry.journalFields?.quickMood || 'Neutral'
      }
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
    console.error('Error fetching journal entries:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching journal entries',
      error: error.message
    });
  }
};

exports.getDoctorJournalEntry = async (req, res) => {
  try {
    const doctorId = req.user._id;
    const { id } = req.params;
    
    // Find the entry with flexible conditions for doctors
    const entry = await JournalEntry.findOne({
      _id: id,
      $or: [
        { assignedDoctor: doctorId },
        { isSharedWithDoctor: true }
      ]
    })
    .populate({
      path: 'user',
      select: 'firstName lastName'
    })
    .populate({
      path: 'template',
      select: 'name description fields'
    })
    .populate({
      path: 'assignedDoctor',
      select: 'firstName lastName'
    });
    
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Journal entry not found or you do not have permission to view it'
      });
    }
    
    // Transform entry to include additional details
    const transformedEntry = {
      ...entry.toObject(),
      patientName: entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : 'Unknown',
      templateName: entry.template ? entry.template.name : 'Custom Entry',
      date: entry.createdAt,
      sentiment: entry.sentimentAnalysis?.sentiment,
      isAnalyzed: !!entry.sentimentAnalysis?.sentiment,
      mood: {
        label: entry.journalFields?.quickMood || 'Neutral'
      }
    };
    
    return res.status(200).json({
      success: true,
      data: transformedEntry
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


// Analyze a journal entry's sentiment
// Update the analyzeJournalEntry function in journalController.js to include highlights
exports.analyzeJournalEntry = async (req, res) => {
  try {
    const doctorId = req.user._id;
    const { id } = req.params;
    const { sentiment, notes, useAI, applyChanges = true } = req.body;
    
    // Find the entry with flexible conditions for doctors
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
        message: 'Journal entry not found or you do not have permission to analyze it'
      });
    }
    
    // If AI analysis is requested, use the NLP service
    let aiAnalysis = null;
    if (useAI) {
      console.log('Running AI analysis for journal entry:', id);
      
      try {
        // Extract text to analyze - prefer rawText if available, 
        // or extract from responses or journalFields
        let textToAnalyze = '';
        
        if (entry.rawText) {
          textToAnalyze = entry.rawText;
        } else if (entry.journalFields) {
          // Extract text from journalFields
          for (const key in entry.journalFields) {
            if (typeof entry.journalFields[key] === 'string') {
              textToAnalyze += entry.journalFields[key] + ' ';
            }
          }
        } else if (entry.responses) {
          // Extract text from responses
          for (const key in entry.responses) {
            if (typeof entry.responses[key] === 'string') {
              textToAnalyze += entry.responses[key] + ' ';
            }
          }
        }
        
        textToAnalyze = textToAnalyze.trim();
        
        if (textToAnalyze) {
          // Run the NLP analysis
          console.log('Analyzing text with NLP service:', textToAnalyze.substring(0, 100) + '...');
          aiAnalysis = await nlpService.analyzeJournalEntry({ text: textToAnalyze });
          console.log('NLP analysis result:', JSON.stringify(aiAnalysis));
          
          // If requested, apply the AI analysis to the entry
          if (applyChanges && aiAnalysis && !aiAnalysis.error) {
            if (!entry.sentimentAnalysis) {
              entry.sentimentAnalysis = {};
            }
            
            // Include ALL properties from aiAnalysis, including highlights
            entry.sentimentAnalysis = {
              sentiment: aiAnalysis.sentiment,
              emotions: aiAnalysis.emotions,
              highlights: aiAnalysis.highlights, // Add this to include highlights
              flags: aiAnalysis.flags,
              summary: aiAnalysis.summary,
              analyzed: true,
              analyzedAt: new Date(),
              analyzedBy: doctorId,
              source: aiAnalysis.source || 'ai'
            };
            
            // Log highlights for debugging
            console.log('Saving highlights to database:', 
                        aiAnalysis.highlights ? aiAnalysis.highlights.length : 0);
            
            // Save the entry with AI analysis
            await entry.save();
          }
        } else {
          console.warn('No text content found to analyze');
        }
      } catch (nlpError) {
        console.error('Error running NLP analysis:', nlpError);
        // Continue without AI analysis - we'll still process manual input if provided
      }
    }
    
    // Update manual sentiment analysis if provided
    if (sentiment && applyChanges) {
      if (!entry.sentimentAnalysis) {
        entry.sentimentAnalysis = {};
      }
      
      entry.sentimentAnalysis.sentiment = sentiment;
      entry.sentimentAnalysis.analyzedAt = new Date();
      entry.sentimentAnalysis.analyzedBy = doctorId;
      entry.sentimentAnalysis.source = 'doctor';
    }
    
    // Add doctor notes if provided
    if (notes && applyChanges) {
      entry.doctorNotes = notes;
    }
    
    // Save changes if we're applying them
    if (applyChanges) {
      await entry.save();
    }
    
    // Prepare response data
    const responseData = {
      success: true,
      message: 'Journal entry analyzed successfully'
    };
    
    // If we have AI analysis results, include them
    if (aiAnalysis) {
      responseData.aiAnalysis = aiAnalysis;
    }
    
    // Include the updated entry if changes were applied
    if (applyChanges) {
      responseData.data = entry;
    }
    
    return res.status(200).json(responseData);
  } catch (error) {
    console.error('Error analyzing journal entry:', error);
    return res.status(500).json({
      success: false,
      message: 'Error analyzing journal entry',
      error: error.message
    });
  }
};
// Add a note to a journal entry
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
    
    // Find the entry with flexible conditions for doctors
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
    
    // Add doctor note
    if (!entry.doctorNotes) {
      entry.doctorNotes = [];
    }
    
    entry.doctorNotes.push({
      doctor: doctorId,
      note: note.trim(),
      createdAt: new Date()
    });
    
    // Save changes
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

// Get count of journal entries for the logged-in user
exports.getUserJournalCount = async (req, res) => {
  try {
    console.log('Getting journal count for user');
    const userId = req.user._id;
    
    // Get the correct JournalEntry model based on tenant connection
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
    
    // If we couldn't get a model from the tenant connection, fallback to default
    if (!JournalEntry) {
      console.log('Using default database model for journal count');
      JournalEntry = require('../models/JournalEntry');
      databaseUsed = 'default (required)';
    }
    
    // Count journal entries for the current user
    const count = await JournalEntry.countDocuments({ user: userId });
    console.log(`Found ${count} journal entries for user ${userId} in database ${databaseUsed}`);
    
    // Return count
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