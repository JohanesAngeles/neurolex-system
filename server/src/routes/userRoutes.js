// server/src/routes/userRoutes.js
const express = require('express');
const userController = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenantMiddleware');

const router = express.Router();

// Apply middleware in the correct order - auth first, then tenant connection
router.use(protect);
router.use(tenantMiddleware);

// 🔧 CRITICAL: Add debug middleware for onboarding route
router.use('/onboarding', (req, res, next) => {
  console.log('\n=== ONBOARDING ROUTE DEBUG ===');
  console.log('Method:', req.method);
  console.log('Headers:', req.headers);
  console.log('Body keys:', Object.keys(req.body || {}));
  console.log('User ID:', req.user?.id || req.user?._id);
  console.log('Tenant ID:', req.tenantId);
  console.log('Tenant Connection:', !!req.tenantConnection);
  console.log('===============================\n');
  next();
});

// User profile routes
router.get('/me', userController.getCurrentUser);
router.get('/profile', userController.getProfile);

// 🔧 CRITICAL: Onboarding routes (both POST and PUT for compatibility)
router.post('/onboarding', userController.updateOnboarding);
router.put('/onboarding', userController.updateOnboarding);  // Add PUT method too
router.post('/onboarding/skip', userController.skipOnboarding);

// Other profile management
// router.patch('/profile/:section', userController.updateProfileSection); // Temporarily disabled
router.get('/doctors', userController.getDoctors);

// Mobile app routes
router.get('/users/:userId/appointments', userController.getUserAppointments);
router.get('/users/:userId/journal-entries', userController.getUserJournalEntries);
router.get('/users/:userId/moods/current', userController.getCurrentMood);
router.post('/users/:userId/moods', userController.createMood);

// Admin routes
router.get('/', userController.getUsers);
router.post('/', userController.createUser);
router.get('/:id', userController.getUserById);
router.delete('/:id', userController.deleteUser);

module.exports = router;