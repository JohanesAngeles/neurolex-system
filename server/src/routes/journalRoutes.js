// server/src/routes/journalRoutes.js - COMPLETE FILE WITH DIRECT ROUTES
const express = require('express');
const router = express.Router();
const journalController = require('../controllers/journalController');
const { protect } = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenantMiddleware');

// Apply auth protection first
router.use(protect);

// Apply tenant middleware
router.use(tenantMiddleware);

// Patient journal routes
router.post('/', journalController.submitJournalEntry);
router.get('/', journalController.getUserJournalEntries);
router.get('/templates', journalController.getAssignedTemplates);
router.get('/templates/default', journalController.getDefaultTemplates);
router.get('/count', journalController.getUserJournalCount);

// Doctor-specific routes
router.get('/doctor', journalController.getDoctorJournalEntries);

// ✅ AI Analysis and Notes routes (multiple endpoint variations for compatibility)
router.post('/:id/analyze', journalController.analyzeJournalEntry);
router.post('/analyze/:id', journalController.analyzeJournalEntry); // Alternative endpoint
router.post('/entry/:id/analyze', journalController.analyzeJournalEntry); // Alternative endpoint

// Doctor notes routes
router.post('/:id/notes', journalController.addDoctorNoteToJournalEntry);
router.post('/notes/:id', journalController.addDoctorNoteToJournalEntry); // Alternative endpoint
router.post('/entry/:id/notes', journalController.addDoctorNoteToJournalEntry); // Alternative endpoint

// User journal entries route
router.get('/users/:userId/entries', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 5, sort = 'date:desc' } = req.query;
    
    const limitNum = parseInt(limit);
    
    const [sortField, sortOrder] = sort.split(':');
    const sortObj = {};
    sortObj[sortField === 'date' ? 'createdAt' : sortField] = sortOrder === 'desc' ? -1 : 1;
    
    let JournalEntry;
    
    if (req.tenantConnection) {
      console.log(`Using tenant connection for journal entries: ${req.tenantDbName}`);
      JournalEntry = req.tenantConnection.model('JournalEntry');
    } else {
      console.log('Using default database for journal entries');
      JournalEntry = require('../models/JournalEntry');
    }
    
    const journalEntries = await JournalEntry.find({ user: userId })
      .sort(sortObj)
      .limit(limitNum)
      .lean();
    
    res.status(200).json({
      success: true,
      data: journalEntries,
      database: req.tenantDbName || 'default'
    });
  } catch (error) {
    console.error(`Error getting user journal entries: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get user journal entries',
      error: error.message
    });
  }
});

// ✅ NEW: Direct routes for individual journal entries (CRITICAL - PLACE THESE BEFORE /entry/:id routes)
// These routes handle the direct /journal/{id} pattern that Flutter expects

// GET individual journal entry
router.get('/:id([0-9a-fA-F]{24})', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const tenantId = req.headers['x-tenant-id'];
    
    console.log(`📖 GET individual journal entry: ${id}`);
    console.log(`👤 User ID: ${userId}`);
    console.log(`🏢 Tenant ID: ${tenantId}`);
    
    let JournalEntry;
    
    if (req.tenantConnection) {
      console.log(`Using tenant connection: ${req.tenantDbName}`);
      JournalEntry = req.tenantConnection.model('JournalEntry');
    } else {
      console.log('Using default database');
      JournalEntry = require('../models/JournalEntry');
    }
    
    // Find the journal entry
    const journalEntry = await JournalEntry.findOne({
      _id: id,
      user: userId,
      tenantId: tenantId
    }).lean();
    
    if (!journalEntry) {
      return res.status(404).json({
        success: false,
        message: 'Journal entry not found or you do not have permission to view it'
      });
    }
    
    console.log(`✅ Found journal entry: ${id}`);
    
    res.status(200).json({
      success: true,
      data: journalEntry
    });
    
  } catch (error) {
    console.error(`❌ Error getting journal entry: ${error.message}`);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid journal entry ID format'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error while getting journal entry',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// DELETE individual journal entry
router.delete('/:id([0-9a-fA-F]{24})', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const tenantId = req.headers['x-tenant-id'];
    
    console.log(`🗑️ DELETE journal entry: ${id}`);
    console.log(`👤 User ID: ${userId}`);
    console.log(`🏢 Tenant ID: ${tenantId}`);
    
    let JournalEntry;
    
    if (req.tenantConnection) {
      console.log(`Using tenant connection: ${req.tenantDbName}`);
      JournalEntry = req.tenantConnection.model('JournalEntry');
    } else {
      console.log('Using default database');
      JournalEntry = require('../models/JournalEntry');
    }
    
    // Find and delete the journal entry
    const deletedEntry = await JournalEntry.findOneAndDelete({
      _id: id,
      user: userId,
      tenantId: tenantId
    });
    
    if (!deletedEntry) {
      return res.status(404).json({
        success: false,
        message: 'Journal entry not found'
      });
    }
    
    console.log(`✅ Successfully deleted journal entry: ${id}`);
    
    res.status(200).json({
      success: true,
      message: 'Journal entry deleted successfully',
      data: {
        id: id,
        deletedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error(`❌ Error deleting journal entry: ${error.message}`);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid journal entry ID format'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error while deleting journal entry',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// PUT individual journal entry
router.put('/:id([0-9a-fA-F]{24})', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const tenantId = req.headers['x-tenant-id'];
    const updateData = req.body;
    
    console.log(`✏️ UPDATE journal entry: ${id}`);
    
    let JournalEntry;
    
    if (req.tenantConnection) {
      JournalEntry = req.tenantConnection.model('JournalEntry');
    } else {
      JournalEntry = require('../models/JournalEntry');
    }
    
    // Update the journal entry
    const updatedEntry = await JournalEntry.findOneAndUpdate(
      {
        _id: id,
        user: userId,
        tenantId: tenantId
      },
      {
        ...updateData,
        updatedAt: new Date()
      },
      { new: true }
    );
    
    if (!updatedEntry) {
      return res.status(404).json({
        success: false,
        message: 'Journal entry not found'
      });
    }
    
    console.log(`✅ Successfully updated journal entry: ${id}`);
    
    res.status(200).json({
      success: true,
      data: updatedEntry
    });
    
  } catch (error) {
    console.error(`❌ Error updating journal entry: ${error.message}`);
    
    res.status(500).json({
      success: false,
      message: 'Internal server error while updating journal entry',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ✅ Keep existing /entry/:id routes for backward compatibility
router.get('/entry/:id', journalController.getJournalEntry);
router.put('/entry/:id', journalController.updateJournalEntry);
router.delete('/entry/:id', journalController.deleteJournalEntry);
router.get('/doctor/:id', journalController.getDoctorJournalEntry);

module.exports = router;