/**
 * MoodJournal schema definition matching the existing model
 */
const mongoose = require('mongoose');

/**
 * Creates a MoodJournal schema
 * @returns {Schema} Mongoose schema for MoodJournal model
 */
function createMoodJournalSchema() {
  const schema = new mongoose.Schema({
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    value: {
      type: Number,
      required: true,
      min: 1,  // 1 = Very Sad
      max: 5   // 5 = Very Happy
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 2000
    },
    date: {
      type: Date,
      default: Date.now,
      index: true
    },
    tags: [{
      type: String,
      trim: true
    }],
    // Optional analysis fields that might be added by AI processing
    analysis: {
      sentiment: {
        type: String,
        enum: ['positive', 'neutral', 'negative', null],
        default: null
      },
      emotions: [{
        type: String,
        trim: true
      }],
      topics: [{
        type: String,
        trim: true
      }],
      summary: {
        type: String,
        trim: true
      }
    }
  }, {
    timestamps: true
  });

  // Create compound index for userId + date for more efficient queries
  schema.index({ userId: 1, date: 1 }, { unique: true });

  // Add a method to convert mood value to sentiment category
  schema.methods.getSentiment = function() {
    if (this.value >= 4) return 'positive';
    if (this.value <= 2) return 'negative';
    return 'neutral';
  };

  // Add a static method to calculate mood score for a collection of entries
  schema.statics.calculateScore = function(entries) {
    if (!entries || entries.length === 0) return 0;
    
    // Calculate points: positive (1 point), neutral (0.5 points), negative (0 points)
    let totalPoints = 0;
    
    entries.forEach(entry => {
      const sentiment = entry.getSentiment();
      if (sentiment === 'positive') totalPoints += 1;
      else if (sentiment === 'neutral') totalPoints += 0.5;
    });
    
    // Calculate score (0-100)
    return Math.round((totalPoints / entries.length) * 100);
  };
  
  return schema;
}

module.exports = createMoodJournalSchema;