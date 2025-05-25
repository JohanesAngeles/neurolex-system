// server/src/routes/journalRoutes.js
const express = require('express');
const router = express.Router();
const journalController = require('../controllers/journalController');
const { protect } = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenantMiddleware');

// Apply auth protection first
router.use(protect);

// Apply tenant middleware
router.use(tenantMiddleware);

// Fixed routes - removing problematic patterns
router.post('/', journalController.submitJournalEntry);
router.get('/', journalController.getUserJournalEntries);
router.get('/templates', journalController.getAssignedTemplates);
router.get('/templates/default', journalController.getDefaultTemplates);
router.get('/count', journalController.getUserJournalCount);

// Doctor-specific routes
router.get('/doctor', journalController.getDoctorJournalEntries);

// Fixed: Simplified user journal entries route
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

// Individual journal entry routes - keep these simple
router.get('/entry/:id', journalController.getJournalEntry);
router.put('/entry/:id', journalController.updateJournalEntry);
router.delete('/entry/:id', journalController.deleteJournalEntry);
router.get('/doctor/:id', journalController.getDoctorJournalEntry);

module.exports = router;