// server/src/models/JournalEntry.js - SIMPLIFIED VERSION (NO QUESTIONS!)

const mongoose = require('mongoose');

const JournalEntrySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required']
  },
  
  // REMOVED: template field (no more templates needed)
  // REMOVED: journalFields (all questions removed!)
  
  // The assigned doctor for this journal entry
  assignedDoctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // ONLY CONTENT FIELD - This is the main journal text
  rawText: {
    type: String,
    required: [true, 'Journal content is required'],
    trim: true
  },
  
  // Keep sentiment analysis for analytics
  sentimentAnalysis: {
    sentiment: {
      type: {
        type: String,
        enum: ['positive', 'negative', 'neutral'],
        default: 'neutral'
      },
      emotions: [{
        name: String,
        score: Number
      }],
      highlights: [{
        text: String,
        keyword: String,
        type: String
      }],
      score: {
        type: Number,
        default: 50
      },
      confidence: {
        type: Number,
        default: 0.5
      },
      flags: [String]
    },
    emotions: [{
      name: String,
      score: Number
    }],
    summary: String,
    flags: [String],
    timestamp: {
      type: Date,
      default: Date.now
    },
    source: String
  },
  
  // Keep doctor notes functionality
  doctorNotes: [{
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
  
  // Privacy settings
  isPrivate: {
    type: Boolean,
    default: false
  },
  
  isSharedWithDoctor: {
    type: Boolean,
    default: true
  },
  
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

// SIMPLIFIED: Pre-save middleware (much simpler now)
JournalEntrySchema.pre('save', function(next) {
  try {
    // Ensure rawText is not empty
    if (!this.rawText || this.rawText.trim() === '') {
      const error = new Error('Journal content cannot be empty');
      error.name = 'ValidationError';
      return next(error);
    }
    
    // Trim whitespace
    this.rawText = this.rawText.trim();
    
    next();
  } catch (error) {
    next(error);
  }
});

// Add indexes for better performance
JournalEntrySchema.index({ user: 1, createdAt: -1 });
JournalEntrySchema.index({ assignedDoctor: 1, createdAt: -1 });
JournalEntrySchema.index({ isSharedWithDoctor: 1 });

// Instance method to get content preview
JournalEntrySchema.methods.getContentPreview = function(maxLength = 100) {
  if (!this.rawText) return '';
  
  if (this.rawText.length <= maxLength) {
    return this.rawText;
  }
  
  return this.rawText.substring(0, maxLength) + '...';
};

// Instance method to check if journal is accessible by doctor
JournalEntrySchema.methods.isAccessibleByDoctor = function(doctorId) {
  if (this.isPrivate) return false;
  if (!this.isSharedWithDoctor) return false;
  
  // If assigned to specific doctor, only that doctor can access
  if (this.assignedDoctor) {
    return this.assignedDoctor.toString() === doctorId.toString();
  }
  
  // Otherwise, any doctor with patient relationship can access
  return true;
};

// Static method to find journals by user
JournalEntrySchema.statics.findByUser = function(userId, options = {}) {
  const {
    limit = 10,
    skip = 0,
    sortBy = 'createdAt',
    sortOrder = -1
  } = options;
  
  return this.find({ user: userId })
    .sort({ [sortBy]: sortOrder })
    .limit(limit)
    .skip(skip)
    .select('-__v');
};

// Static method to find journals accessible by doctor
JournalEntrySchema.statics.findAccessibleByDoctor = function(doctorId, options = {}) {
  const {
    limit = 10,
    skip = 0,
    sortBy = 'createdAt',
    sortOrder = -1
  } = options;
  
  return this.find({
    isPrivate: false,
    isSharedWithDoctor: true,
    $or: [
      { assignedDoctor: doctorId },
      { assignedDoctor: null } // Not assigned to specific doctor
    ]
  })
    .sort({ [sortBy]: sortOrder })
    .limit(limit)
    .skip(skip)
    .populate('user', 'firstName lastName email')
    .select('-__v');
};

const JournalEntry = mongoose.model('JournalEntry', JournalEntrySchema);

module.exports = JournalEntry;