// server/src/schemas/definitions/journalEntrySchema.js - SIMPLIFIED VERSION (NO QUESTIONS!)

const mongoose = require('mongoose');

/**
 * Creates a simplified Journal Entry schema
 * @returns {Schema} Mongoose schema for JournalEntry model
 */
function createJournalEntrySchema() {
  return new mongoose.Schema({
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required']
    },
    
    // REMOVED: template field (no more form templates)
    // REMOVED: title field (no more titles)
    // REMOVED: journalFields (all questions removed!)
    // REMOVED: responses field (no more structured responses)
    
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
      trim: true,
      minlength: [1, 'Journal content cannot be empty'],
      maxlength: [10000, 'Journal content cannot exceed 10,000 characters']
    },
    
    // Keep sentiment analysis for mental health insights
    sentimentAnalysis: {
      sentiment: {
        type: {
          type: String,
          enum: ['positive', 'negative', 'neutral'],
          default: 'neutral'
        },
        emotions: [{
          name: {
            type: String,
            required: true
          },
          score: {
            type: Number,
            min: 0,
            max: 1
          }
        }],
        highlights: [{
          text: String,
          keyword: String,
          type: {
            type: String,
            enum: ['emotion', 'concern', 'positive', 'negative']
          }
        }],
        score: {
          type: Number,
          default: 50,
          min: 0,
          max: 100
        },
        confidence: {
          type: Number,
          default: 0.5,
          min: 0,
          max: 1
        },
        flags: [{
          type: String,
          enum: ['concern', 'urgent', 'positive', 'neutral']
        }]
      },
      emotions: [{
        name: {
          type: String,
          required: true
        },
        score: {
          type: Number,
          min: 0,
          max: 1
        }
      }],
      summary: {
        type: String,
        maxlength: [500, 'Summary cannot exceed 500 characters']
      },
      flags: [{
        type: String,
        enum: ['concern', 'urgent', 'positive', 'neutral', 'review_needed']
      }],
      timestamp: {
        type: Date,
        default: Date.now
      },
      source: {
        type: String,
        enum: ['ai', 'manual', 'automated'],
        default: 'ai'
      }
    },
    
    // Doctor notes functionality
    doctorNotes: [{
      content: {
        type: String,
        required: [true, 'Doctor note content is required'],
        trim: true,
        maxlength: [1000, 'Doctor note cannot exceed 1,000 characters']
      },
      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Doctor reference is required']
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    
    // Privacy and sharing settings
    isPrivate: {
      type: Boolean,
      default: false
    },
    
    isSharedWithDoctor: {
      type: Boolean,
      default: true
    },
    
    // Metadata
    createdAt: {
      type: Date,
      default: Date.now
    },
    
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }, {
    timestamps: true, // Automatically manage createdAt and updatedAt
    versionKey: false, // Remove __v field
    toJSON: { 
      virtuals: true,
      transform: function(doc, ret) {
        // Remove sensitive fields from JSON output
        delete ret._id;
        ret.id = doc._id;
        return ret;
      }
    },
    toObject: { virtuals: true }
  });
}

module.exports = createJournalEntrySchema;