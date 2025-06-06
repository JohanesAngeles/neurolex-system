// server/src/models/Mood.js
const mongoose = require('mongoose');
const createMoodSchema = require('../schemas/definitions/moodSchema');

// Create the schema
const MoodSchema = createMoodSchema();

// Add additional model-specific methods
MoodSchema.statics.findRecentMoodByUser = async function(tenantId, userId, hours = 2) {
  const timeThreshold = new Date(Date.now() - (hours * 60 * 60 * 1000));
  
  return await this.findOne({
    tenantId: new mongoose.Types.ObjectId(tenantId),
    userId: new mongoose.Types.ObjectId(userId),
    timestamp: { $gte: timeThreshold }
  }).sort({ timestamp: -1 });
};

MoodSchema.statics.getUserMoodHistory = async function(tenantId, userId, limit = 50) {
  return await this.find({
    tenantId: new mongoose.Types.ObjectId(tenantId),
    userId: new mongoose.Types.ObjectId(userId)
  })
  .sort({ timestamp: -1 })
  .limit(limit)
  .select('moodRating moodKey moodLabel moodSvgUrl reflection timestamp');
};

MoodSchema.statics.getMoodAnalytics = async function(tenantId, userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const analytics = await this.aggregate([
    {
      $match: {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        userId: new mongoose.Types.ObjectId(userId),
        timestamp: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        totalEntries: { $sum: 1 },
        averageRating: { $avg: "$moodRating" },
        moodDistribution: {
          $push: {
            key: "$moodKey",
            rating: "$moodRating",
            date: "$timestamp"
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        totalEntries: 1,
        averageRating: { $round: ["$averageRating", 2] },
        moodDistribution: 1
      }
    }
  ]);

  return analytics[0] || {
    totalEntries: 0,
    averageRating: 0,
    moodDistribution: []
  };
};

// Export the model
module.exports = mongoose.model('Mood', MoodSchema);