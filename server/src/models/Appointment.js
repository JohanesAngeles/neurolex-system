// server/models/Appointment.js
const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  appointmentDate: {
    type: Date,
    required: true
  },
  duration: {
    type: Number,
    required: true,
    default: 30 // 30 minutes by default
  },
  appointmentType: {
    type: String,
    required: true,
    enum: ['Initial Consultation', 'Follow-up', 'Therapy Session', 'Assessment']
  },
  status: {
    type: String,
    required: true,
    enum: ['Scheduled', 'Completed', 'Cancelled', 'No-show'],
    default: 'Scheduled'
  },
  notes: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create indexes for efficient queries
appointmentSchema.index({ doctor: 1, appointmentDate: 1 });
appointmentSchema.index({ patient: 1, appointmentDate: 1 });
appointmentSchema.index({ appointmentDate: 1, status: 1 });

const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment;