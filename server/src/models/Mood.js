const mongoose = require('mongoose');

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
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Create compound index for quick lookups by user and date
MoodSchema.index({ user: 1, timestamp: -1 });

module.exports = mongoose.model('Mood', MoodSchema);