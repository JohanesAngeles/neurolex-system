/**
 * Configuration for schema registry
 * Defines which models should be tenant-specific vs global
 */

module.exports = {
  // Models that should be specific to each tenant database
  TENANT_MODELS: [
    'User',
    'Appointment',
    'JournalEntry',
    'Mood',
    'MoodJournal',
    'Conversation',
    'Message',
    'FormTemplate',
    'Doctor',
    'Notification',
    'PatientDoctorAssociation',
    'PatientGroup'
  ],
  
  // Models that should remain in the master/global database
  GLOBAL_MODELS: [
    'Tenant' // This should stay in the master database
  ],
  
  // Default schema options
  DEFAULT_SCHEMA_OPTIONS: {
    timestamps: true, // Adds createdAt and updatedAt timestamps to all schemas
    toJSON: { virtuals: true }, // Include virtuals when converting to JSON
    toObject: { virtuals: true }, // Include virtuals when converting to object
    id: false // Don't add 'id' virtual property
  }
};