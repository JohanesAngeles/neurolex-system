// server/src/routes/userRoutes.js - COMPLETE UPDATED FILE
const express = require('express');
const userController = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenantMiddleware');


const router = express.Router();


// Apply middleware in the correct order - auth first, then tenant connection
router.use(protect);
router.use(tenantMiddleware);


// 🔧 CRITICAL: Add debug middleware for profile routes
router.use('/profile', (req, res, next) => {
  console.log('\n=== PROFILE ROUTE DEBUG ===');
  console.log('Method:', req.method);
  console.log('Path:', req.path);
  console.log('Full URL:', req.originalUrl);
  console.log('Headers:', {
    'content-type': req.headers['content-type'],
    'authorization': req.headers.authorization ? 'present' : 'missing',
    'x-tenant-id': req.headers['x-tenant-id']
  });
  console.log('Body keys:', Object.keys(req.body || {}));
  console.log('User ID:', req.user?.id || req.user?._id);
  console.log('Tenant ID:', req.tenantId);
  console.log('Tenant Connection:', !!req.tenantConnection);
  console.log('===============================\n');
  next();
});


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


// 🔧 CRITICAL: Profile update routes - THESE ARE THE KEY FIXES
router.put('/profile/basic', userController.updateProfileBasic);
router.patch('/profile/basic', userController.updateProfileBasic); // Support both PUT and PATCH
router.put('/profile/password', userController.updatePassword);
router.patch('/profile/password', userController.updatePassword); // Support both PUT and PATCH


// 🔧 CRITICAL: Onboarding routes (both POST and PUT for compatibility)
router.post('/onboarding', userController.updateOnboarding);
router.put('/onboarding', userController.updateOnboarding);
router.patch('/onboarding', userController.updateOnboarding); // Add PATCH support
router.post('/onboarding/skip', userController.skipOnboarding);


// Other profile management
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


// 🔧 CRITICAL: Add a test route to verify the routes are working
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'User routes are working!',
    userId: req.user?.id || req.user?._id,
    tenantId: req.tenantId,
    routes: [
      'GET /api/users/me',
      'GET /api/users/profile', 
      'PUT /api/users/profile/basic',
      'PUT /api/users/profile/password',
      'POST /api/users/onboarding'
    ]
  });
});


module.exports = router;


