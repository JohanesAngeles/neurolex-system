// models/Mood.js

const mongoose = require('mongoose');

// Only create the schema, don't register the model directly
const MoodSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  mood: {
    type: String,
    required: true,
    enum: ['great', 'good', 'okay', 'struggling', 'upset']
  },
  notes: {
    type: String,
    default: ''
  },
  // Add symptoms field to support the symptom tracker feature
  symptoms: [{
    type: String
  }],
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Create compound index for quick lookups by user and date
MoodSchema.index({ user: 1, timestamp: -1 });

// Export ONLY the schema without compiling the model
module.exports = MoodSchema;