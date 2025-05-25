/**
 * PatientDoctorAssociation schema definition matching the existing model
 */
const mongoose = require('mongoose');

/**
 * Creates a PatientDoctorAssociation schema
 * @returns {Schema} Mongoose schema for PatientDoctorAssociation model
 */
function createPatientDoctorAssociationSchema() {
  const schema = new mongoose.Schema({
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Patient reference is required']
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Doctor reference is required']
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'declined', 'terminated'],
      default: 'pending'
    },
    assignedTemplates: [{
      template: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FormTemplate'
      },
      assignedDate: {
        type: Date,
        default: Date.now
      },
      active: {
        type: Boolean,
        default: true
      }
    }],
    notes: [{
      content: {
        type: String,
        required: true
      },
      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }, {
    timestamps: true
  });

  // Ensure that patient-doctor pairs are unique
  schema.index({ patient: 1, doctor: 1 }, { unique: true });
  
  return schema;
}

module.exports = createPatientDoctorAssociationSchema;