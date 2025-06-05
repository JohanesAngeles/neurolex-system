// server/src/routes/userRoutes.js - COMPLETE UPDATED FILE
const express = require('express');
const userController = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenantMiddleware');

// 🔧 NEW: Add multer for file uploads
const multer = require('multer');

const router = express.Router();

// Apply middleware in the correct order - auth first, then tenant connection
router.use(protect);
router.use(tenantMiddleware);

// 🔧 NEW: Configure multer for profile picture uploads
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1 // Only allow 1 file
  },
  fileFilter: (req, file, cb) => {
    console.log('📁 File filter - received file:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });

    // Check file type
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      console.log('✅ File type approved:', file.mimetype);
      cb(null, true);
    } else {
      console.log('❌ File type rejected:', file.mimetype);
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'), false);
    }
  }
});

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

// 🔧 NEW: Profile picture upload routes
router.post('/profile/picture', upload.single('profilePicture'), (req, res, next) => {
  console.log('\n=== PROFILE PICTURE UPLOAD DEBUG ===');
  console.log('Method:', req.method);
  console.log('Path:', req.path);
  console.log('File received:', !!req.file);
  console.log('File details:', req.file ? {
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    buffer: !!req.file.buffer
  } : 'No file');
  console.log('User ID:', req.user?.id || req.user?._id);
  console.log('Content-Type:', req.headers['content-type']);
  console.log('=====================================\n');
  next();
}, userController.uploadProfilePicture);

router.delete('/profile/picture', userController.deleteProfilePicture);

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
      'POST /api/users/profile/picture', // NEW
      'DELETE /api/users/profile/picture', // NEW
      'POST /api/users/onboarding'
    ]
  });
});

// 🔧 NEW: Error handling middleware for multer errors
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    console.error('Multer error:', error);
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 5MB.'
      });
    }
    
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Only one file is allowed.'
      });
    }
    
    return res.status(400).json({
      success: false,
      message: 'File upload error: ' + error.message
    });
  }
  
  if (error.message && error.message.includes('Invalid file type')) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  
  next(error);
});

module.exports = router;