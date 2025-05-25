/**
 * Schema Registry - Main Entry Point
 * Centralizes schema management for multi-tenant architecture
 */
const mongoose = require('mongoose');
const { applyTenantFields } = require('./extensions/tenantFields');
// Fix the path to the password hashing middleware
const bcrypt = require('bcryptjs');

// Define tenant models list directly to avoid circular dependencies
const TENANT_MODELS = [
  'User', 
  'JournalEntry',
  'Appointment',
  'Mood',
  'MoodJournal',
  'Doctor',
  'FormTemplate',
  'Message',
  'Conversation',
  'Notification',
  'PatientDoctorAssociation'
];

const GLOBAL_MODELS = [
  'Tenant'
];

// Import schema definitions
const createUserSchema = require('./definitions/userSchema');
const createJournalEntrySchema = require('./definitions/journalEntrySchema');
const createAppointmentSchema = require('./definitions/appointmentSchema');
const createMoodSchema = require('./definitions/moodSchema');
const createDoctorSchema = require('./definitions/doctorSchema');
const createFormTemplateSchema = require('./definitions/formTemplateSchema');
const createMessageSchema = require('./definitions/messageSchema');
const createConversationSchema = require('./definitions/conversationSchema');
const createNotificationSchema = require('./definitions/notificationSchema');
const createPatientDoctorAssociationSchema = require('./definitions/patientDoctorAssociationSchema'); 
const createMoodJournalSchema = require('./definitions/moodJournalSchema');

/**
 * Apply password hashing middleware directly
 * @param {Schema} schema - Mongoose schema
 * @returns {Schema} Schema with password hashing
 */
function applyPasswordHashing(schema) {
  // Add pre-save hook for password hashing
  schema.pre('save', async function(next) {
    // Only hash the password if it's modified or new
    if (!this.isModified('password')) {
      return next();
    }

    try {
      console.log(`Hashing password for user: ${this.email || 'new user'}`);
      // Generate salt
      const salt = await bcrypt.genSalt(10);
      // Hash password
      this.password = await bcrypt.hash(this.password, salt);
      console.log('Password hashed successfully');
      next();
    } catch (error) {
      console.error('Error hashing password:', error);
      next(error);
    }
  });

  // Add comparePassword method
  schema.methods.comparePassword = async function(candidatePassword) {
    try {
      console.log(`Comparing password for user: ${this.email || 'unknown'}`);
      if (!this.password) {
        console.error('User has no password set');
        return false;
      }
      return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
      console.error('Error comparing passwords:', error);
      return false;
    }
  };

  return schema;
}

/**
 * Prepares a schema with middleware and extensions for tenant use
 * @param {string} modelName - Name of the model
 * @returns {Schema|null} Prepared mongoose schema
 */
function prepareSchema(modelName) {
  let schema;
  
  // Create base schema based on model name
  switch(modelName) {
    case 'User':
      schema = createUserSchema();
      // Apply password hashing middleware to User schema
      try {
        schema = applyPasswordHashing(schema);
        console.log('Password hashing middleware applied to User schema');
      } catch (err) {
        console.error('Error applying password hashing to User schema:', err.message);
      }
      break;
    case 'JournalEntry':
      schema = createJournalEntrySchema();
      break;
    case 'Appointment':
      schema = createAppointmentSchema();
      break;
    case 'Mood':
      schema = createMoodSchema();
      break;
    case 'MoodJournal':
      schema = createMoodJournalSchema();
      break;
    case 'Doctor':
      schema = createDoctorSchema();
      break;
    case 'FormTemplate':
      schema = createFormTemplateSchema();
      break;
    case 'Message':
      schema = createMessageSchema();
      break;
    case 'Conversation':
      schema = createConversationSchema();
      break;
    case 'Notification':
      schema = createNotificationSchema();
      break;
    case 'PatientDoctorAssociation':
      schema = createPatientDoctorAssociationSchema();
      break;
    default:
      console.warn(`Schema definition not found for model: ${modelName}`);
      return null;
  }
  
  // Apply tenant fields to all tenant models
  if (schema && typeof applyTenantFields === 'function') {
    try {
      schema = applyTenantFields(schema);
    } catch (err) {
      console.warn(`Error applying tenant fields to ${modelName}:`, err.message);
    }
  }
  
  return schema;
}

/**
 * Gets all tenant schemas
 * @returns {Object} Map of model names to schemas
 */
function getTenantSchemas() {
  const schemas = {};
  
  TENANT_MODELS.forEach(modelName => {
    try {
      const schema = prepareSchema(modelName);
      if (schema) {
        schemas[modelName] = schema;
      }
    } catch (err) {
      console.error(`Error preparing schema for ${modelName}:`, err.message);
    }
  });
  
  console.log(`Prepared schemas for models: ${Object.keys(schemas).join(', ')}`);
  return schemas;
}

module.exports = {
  getTenantSchemas,
  prepareSchema,
  TENANT_MODELS,
  GLOBAL_MODELS
};