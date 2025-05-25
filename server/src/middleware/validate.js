// server/src/middleware/validate.js - Updated validation rules
const { body, validationResult } = require('express-validator');

// Registration validation rules - Updated for new fields
exports.registerValidationRules = [
  // First name validation
  body('firstName')
    .notEmpty().withMessage('First name is required')
    .trim()
    .isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
  
  // Last name validation
  body('lastName')
    .notEmpty().withMessage('Last name is required')
    .trim()
    .isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),
  
  // Email validation
  body('email')
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email')
    .normalizeEmail({ 
      gmail_remove_dots: false,
      gmail_remove_subaddress: true,
      outlookdotcom_remove_subaddress: true,
      yahoo_remove_subaddress: true,
      icloud_remove_subaddress: true
    }),
  
  // Password validation
  body('password')
    .if(body('googleId').not().exists())
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*])/).withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  
  // Password confirmation validation
  body('confirmPassword')
    .if(body('googleId').not().exists())
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
  
  // Doctor-specific validations
  body('specialty')
    .if(body('role').equals('doctor'))
    .notEmpty().withMessage('Specialty is required for doctors'),
  
  body('experience')
    .if(body('role').equals('doctor'))
    .notEmpty().withMessage('Experience is required for doctors'),
  
  // Contact number validation (optional but if provided, should be valid)
  body('personalContactNumber')
    .optional()
    .isMobilePhone().withMessage('Please enter a valid phone number'),
  
  body('clinicContactNumber')
    .optional()
    .isMobilePhone().withMessage('Please enter a valid clinic phone number'),
  
  // Availability validation for doctors
  body('availability')
    .if(body('role').equals('doctor'))
    .optional()
    .custom((value) => {
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          // Check if at least one day is available
          const hasAvailableDay = Object.values(parsed).some(day => day.available === true);
          if (!hasAvailableDay) {
            throw new Error('At least one day must be available');
          }
        } catch (e) {
          throw new Error('Invalid availability format');
        }
      }
      return true;
    }),
  
  // Appointment types validation for doctors
  body('appointmentTypes')
    .if(body('role').equals('doctor'))
    .optional()
    .custom((value) => {
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          if (!parsed.inPerson && !parsed.telehealth) {
            throw new Error('At least one appointment type must be selected');
          }
        } catch (e) {
          throw new Error('Invalid appointment types format');
        }
      }
      return true;
    }),
  
  // Terms and conditions validation
  body('termsAccepted')
    .equals('true').withMessage('You must accept the terms and conditions')
];

// Login validation rules (unchanged)
exports.loginValidationRules = [
  // Email validation
  body('email')
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email')
    .normalizeEmail({ gmail_remove_dots: false }),
  
  // Password validation
  body('password')
    .notEmpty().withMessage('Password is required')
];

// Middleware to check for validation errors
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    });
  }
  next();
};