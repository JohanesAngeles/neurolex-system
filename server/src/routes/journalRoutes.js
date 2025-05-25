// server/src/routes/journalRoutes.js

const express = require('express');
const router = express.Router();
const journalController = require('../controllers/journalController');
const { protect } = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenantMiddleware');

// IMPORTANT: First apply auth protection to set user info
router.use(protect);

// THEN apply tenant middleware which depends on user info (from auth)
router.use(tenantMiddleware);

// Journal entry routes
router.post('/', journalController.submitJournalEntry);
router.get('/', journalController.getUserJournalEntries);
router.get('/templates', journalController.getAssignedTemplates);
router.get('/templates/default', journalController.getDefaultTemplates);
router.get('/count', journalController.getUserJournalCount);  // MOVED UP before /:id

// Doctor-specific journal entries routes
router.get('/doctor', journalController.getDoctorJournalEntries);
router.get('/doctor/:id', journalController.getDoctorJournalEntry);

// Individual journal entry routes
router.get('/:id', journalController.getJournalEntry);
router.put('/:id', journalController.updateJournalEntry);
router.delete('/:id', journalController.deleteJournalEntry);


// Custom user journal entries route
router.get('/users/:userId/journal-entries', async (req, res) => {
    try {
      const { userId } = req.params;
      const { limit = 5, sort = 'date:desc' } = req.query;
      
      // Parse limit to number
      const limitNum = parseInt(limit);
      
      // Parse sort parameter
      const [sortField, sortOrder] = sort.split(':');
      const sortObj = {};
      sortObj[sortField === 'date' ? 'createdAt' : sortField] = sortOrder === 'desc' ? -1 : 1;
      
      // Get the correct JournalEntry model based on tenant connection
      let JournalEntry;
      
      if (req.tenantConnection) {
        // Use tenant-specific connection
        console.log(`Using tenant connection for journal entries: ${req.tenantDbName}`);
        JournalEntry = req.tenantConnection.model('JournalEntry');
      } else {
        // Use default database
        console.log('Using default database for journal entries');
        JournalEntry = require('../models/JournalEntry');
      }
      
      // Get journal entries
      const journalEntries = await JournalEntry.find({ user: userId })
        .sort(sortObj)
        .limit(limitNum)
        .lean();
      
      // Return journal entries
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

module.exports = router;