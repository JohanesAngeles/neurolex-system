// server/src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authController = require('../controllers/authControllers');
const tenantMiddleware = require('../middleware/tenantMiddleware');
const { registerValidationRules, loginValidationRules, validate } = require('../middleware/validate');

// Ensure uploads directories exist
const uploadsDir = path.join(__dirname, '../../uploads');
const profilesDir = path.join(uploadsDir, 'profiles');
const licensesDir = path.join(uploadsDir, 'licenses');
const educationDir = path.join(uploadsDir, 'education');
const additionalDir = path.join(uploadsDir, 'additional');

// Create directories if they don't exist
[uploadsDir, profilesDir, licensesDir, educationDir, additionalDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Setup multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Different destinations based on file type
    if (file.fieldname === 'profilePhoto') {
      cb(null, profilesDir);
    } else if (file.fieldname === 'licenseDocument') {
      cb(null, licensesDir);
    } else if (file.fieldname === 'educationCertificate') {
      cb(null, educationDir);
    } else if (file.fieldname === 'additionalDocuments') {
      cb(null, additionalDir);
    } else {
      cb(null, uploadsDir);
    }
  },
  filename: (req, file, cb) => {
    // Create unique filename
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

// Create multer instance with file size limits
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    // Accept only specific file types
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images (JPEG, PNG) and documents (PDF, DOC, DOCX) are allowed'));
    }
  }
});

// Get available tenants for registration
router.get('/tenants', authController.getTenants);

// Process uploads first, then handle tenant context, then register
router.post(
  '/register',
  (req, res, next) => {
    // First process the multipart form data with updated fields
    upload.fields([
      { name: 'profilePhoto', maxCount: 1 },
      { name: 'licenseDocument', maxCount: 1 },
      { name: 'educationCertificate', maxCount: 1 },
      { name: 'additionalDocuments', maxCount: 10 } // Allow up to 10 additional documents
    ])(req, res, (err) => {
      if (err) {
        console.error('File upload error:', err);
        return res.status(400).json({ 
          success: false, 
          message: `File upload error: ${err.message}` 
        });
      }
      
      // Log the parsed form data for debugging
      console.log('Parsed form data (body):', req.body);
      console.log('Parsed form files:', req.files ? Object.keys(req.files) : 'none');
      
      // Continue to next middleware
      next();
    });
  },
  // Then handle tenant context
  tenantMiddleware.setTenantContext,
  // Finally process the registration
  authController.register
);

// Other routes
router.post('/login', loginValidationRules, validate, authController.login);
router.post('/google-auth', authController.googleAuth);
router.post('/verify-email', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerificationCode);
router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-reset-code', authController.verifyResetCode);
router.post('/reset-password', authController.resetPassword);

router.post('/admin-login', authController.adminLogin);

// ✅ Stream Chat token generation endpoint
router.post('/chat/token', authController.generateChatToken);

// Get user profile - with tenant middleware
router.get(
  '/me',
  tenantMiddleware,
  authController.getMe
);

module.exports = router;