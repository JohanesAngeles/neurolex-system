/**
 * Journal Entry schema definition - Updated with title field
 */
const mongoose = require('mongoose');

/**
 * Creates a Journal Entry schema
 * @returns {Schema} Mongoose schema for JournalEntry model
 */
function createJournalEntrySchema() {
  return new mongoose.Schema({
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
    // New title field for the journal entry
    title: {
      type: String,
      default: ''
    },
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
}

module.exports = createJournalEntrySchema;