/**
 * Message schema definition matching the existing model
 */
const mongoose = require('mongoose');

/**
 * Creates a Message schema
 * @returns {Schema} Mongoose schema for Message model
 */
function createMessageSchema() {
  const schema = new mongoose.Schema({
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: true
    },
    readBy: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read', 'failed'],
      default: 'sent'
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
  schema.index({ conversationId: 1, createdAt: 1 });
  schema.index({ sender: 1 });
  
  return schema;
}

module.exports = createMessageSchema;