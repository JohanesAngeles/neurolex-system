// server/src/models/JournalEntry.js

const mongoose = require('mongoose');

const JournalEntrySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required']
  },
  template: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FormTemplate',
    default: null
  },
  // New field to store the specific doctor assigned to this journal entry
  // This will only show the journal to the doctor who has an appointment with the patient
  assignedDoctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  responses: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Fields specific to the new journal structure
  journalFields: {
    // Gentle Reflections section
    thoughtReflection: {
      type: String,
      default: ''
    },
    thoughtFeeling: {
      type: String,
      default: ''
    },
    selfKindness: {
      type: String,
      default: ''
    },
    
    // Moments of Gratitude section
    gratitude: {
      type: String,
      default: ''
    },
    
    // Tender Moments section
    challengeReflection: {
      type: String,
      default: ''
    },
    selfCareInChallenge: {
      type: String,
      default: ''
    },
    
    // Self-Care Check-In section
    selfCareActivities: {
      type: [String],
      default: []
    },
    otherSelfCare: {
      type: String,
      default: ''
    },
    
    // Hopes for Tomorrow section
    tomorrowIntention: {
      type: String,
      default: ''
    },
    
    // A Loving Note section
    lovingReminder: {
      type: String,
      default: ''
    },
    
    // Mood tracking
    quickMood: {
      type: String,
      enum: ['positive', 'neutral', 'negative'],
      default: 'neutral'
    }
  },
  
  rawText: {
    type: String,
    default: ''
  },
  
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
      highlights: [{ // Add this new field
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

// Method to extract a raw text version from all responses
JournalEntrySchema.pre('save', function(next) {
  try {
    // Extract text from journalFields if they exist
    if (this.journalFields && (!this.rawText || this.rawText.trim() === '')) {
      let extractedText = '';
      
      // Add text from each field
      if (this.journalFields.thoughtReflection) {
        extractedText += `Thought: ${this.journalFields.thoughtReflection} `;
      }
      
      if (this.journalFields.thoughtFeeling) {
        extractedText += `Feeling: ${this.journalFields.thoughtFeeling} `;
      }
      
      if (this.journalFields.selfKindness) {
        extractedText += `Self-kindness: ${this.journalFields.selfKindness} `;
      }
      
      if (this.journalFields.gratitude) {
        extractedText += `Gratitude: ${this.journalFields.gratitude} `;
      }
      
      if (this.journalFields.challengeReflection) {
        extractedText += `Challenge: ${this.journalFields.challengeReflection} `;
      }
      
      if (this.journalFields.selfCareInChallenge) {
        extractedText += `Self-care in challenge: ${this.journalFields.selfCareInChallenge} `;
      }
      
      if (this.journalFields.selfCareActivities && this.journalFields.selfCareActivities.length > 0) {
        extractedText += `Self-care activities: ${this.journalFields.selfCareActivities.join(', ')} `;
      }
      
      if (this.journalFields.otherSelfCare) {
        extractedText += `Other self-care: ${this.journalFields.otherSelfCare} `;
      }
      
      if (this.journalFields.tomorrowIntention) {
        extractedText += `Tomorrow's intention: ${this.journalFields.tomorrowIntention} `;
      }
      
      if (this.journalFields.lovingReminder) {
        extractedText += `Loving reminder: ${this.journalFields.lovingReminder} `;
      }
      
      this.rawText = extractedText.trim();
    }
    // If no journalFields but responses exist
    else if (this.responses && (!this.rawText || this.rawText.trim() === '')) {
      let extractedText = '';
      
      // Convert Map to object if necessary
      const responsesObj = this.responses instanceof Map ? 
        Object.fromEntries(this.responses) : this.responses;
      
      // Iterate through responses and extract text
      for (const [key, value] of Object.entries(responsesObj)) {
        if (typeof value === 'string') {
          extractedText += value + ' ';
        } else if (value && typeof value === 'object') {
          if (Array.isArray(value)) {
            extractedText += value.join(', ') + ' ';
          } else if (value.text) {
            extractedText += value.text + ' ';
          } else if (value.answer) {
            extractedText += value.answer + ' ';
          }
        }
      }
      
      this.rawText = extractedText.trim();
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

const JournalEntry = mongoose.model('JournalEntry', JournalEntrySchema);

module.exports = JournalEntry;