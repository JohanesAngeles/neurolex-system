/**
 * Conversation schema definition matching the existing model
 */
const mongoose = require('mongoose');

/**
 * Creates a Conversation schema
 * @returns {Schema} Mongoose schema for Conversation model
 */
function createConversationSchema() {
  const schema = new mongoose.Schema({
    participants: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }],
    lastMessage: {
      content: {
        type: String,
        default: ''
      },
      sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      read: {
        type: Boolean,
        default: false
      }
    },
    unreadCounts: {
      type: Map,
      of: Number,
      default: {}
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

  // Indexes for better query performance
  schema.index({ participants: 1 });
  schema.index({ updatedAt: -1 });
  
  return schema;
}

module.exports = createConversationSchema;