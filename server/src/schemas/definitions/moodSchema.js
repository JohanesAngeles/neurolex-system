// server/src/schemas/definitions/moodSchema.js
const mongoose = require('mongoose');

/**
 * Creates an enhanced Mood schema for mood check-ins with multi-tenant support
 * @returns {Schema} Mongoose schema for Mood model
 */
function createMoodSchema() {
  const schema = new mongoose.Schema({
    // Multi-tenant support
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true // Critical for tenant isolation
    },
    
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    // Core mood data matching Flutter implementation
    moodRating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: 'Mood rating must be an integer between 1-5'
      }
    },

    moodKey: {
      type: String,
      required: true,
      enum: ['upset', 'struggling', 'okay', 'good', 'great'],
      index: true
    },

    moodLabel: {
      type: String,
      required: true,
      maxlength: 50
    },

    // Cloudinary SVG URL for consistent cross-platform display
    moodSvgUrl: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return /^https:\/\/res\.cloudinary\.com\/.+\.svg$/.test(v);
        },
        message: 'Must be a valid Cloudinary SVG URL'
      }
    },

    // Emotional reflection text
    reflection: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: ''
    },

    // Timestamp for mood entry
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    },

    // Metadata for analytics
    metadata: {
      deviceType: {
        type: String,
        enum: ['mobile', 'web', 'tablet'],
        default: 'mobile'
      },
      appVersion: String,
      timezone: String
    }
  }, {
    timestamps: true // Adds createdAt and updatedAt
  });

  // Compound indexes for multi-tenant queries
  schema.index({ tenantId: 1, userId: 1, timestamp: -1 });
  schema.index({ tenantId: 1, userId: 1, createdAt: -1 });
  schema.index({ tenantId: 1, moodKey: 1, timestamp: -1 });

  // Prevent duplicate mood entries within 2-hour window
  schema.index({ 
    tenantId: 1, 
    userId: 1, 
    timestamp: 1 
  }, { 
    unique: false // We'll handle this in the controller logic
  });

  // Virtual for mood sentiment category
  schema.virtual('sentiment').get(function() {
    if (this.moodRating >= 4) return 'positive';
    if (this.moodRating <= 2) return 'negative';
    return 'neutral';
  });

  // Instance method to check if mood can be updated (2-hour rule)
  schema.methods.canBeUpdated = function() {
    const twoHoursAgo = new Date(Date.now() - (2 * 60 * 60 * 1000));
    return this.timestamp >= twoHoursAgo;
  };

  // Static method to get mood trends for a user
  schema.statics.getMoodTrends = async function(tenantId, userId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return await this.aggregate([
      {
        $match: {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          userId: new mongoose.Types.ObjectId(userId),
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
            moodKey: "$moodKey"
          },
          count: { $sum: 1 },
          avgRating: { $avg: "$moodRating" },
          latestEntry: { $last: "$$ROOT" }
        }
      },
      {
        $sort: { "_id.date": -1 }
      }
    ]);
  };

  // Static method to calculate mood score for analytics
  schema.statics.calculateMoodScore = function(moodEntries) {
    if (!moodEntries || moodEntries.length === 0) return 0;
    
    let totalScore = 0;
    moodEntries.forEach(entry => {
      // Convert 1-5 scale to 0-100 scale
      totalScore += ((entry.moodRating - 1) / 4) * 100;
    });
    
    return Math.round(totalScore / moodEntries.length);
  };

  // Pre-save middleware for validation
  schema.pre('save', function(next) {
    // Ensure timezone is set if not provided
    if (!this.metadata.timezone) {
      this.metadata.timezone = 'UTC';
    }
    next();
  });

  return schema;
}

module.exports = createMoodSchema;