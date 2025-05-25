// server/src/models/PatientDoctorAssociation.js

const mongoose = require('mongoose');

const PatientDoctorAssociationSchema = new mongoose.Schema({
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
PatientDoctorAssociationSchema.index({ patient: 1, doctor: 1 }, { unique: true });

const PatientDoctorAssociation = mongoose.model('PatientDoctorAssociation', PatientDoctorAssociationSchema);

module.exports = PatientDoctorAssociation;