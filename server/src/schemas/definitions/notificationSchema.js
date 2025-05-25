/**
 * Notification schema definition matching the existing model
 */
const mongoose = require('mongoose');

/**
 * Creates a Notification schema
 * @returns {Schema} Mongoose schema for Notification model
 */
function createNotificationSchema() {
  return new mongoose.Schema({
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    title: {
      type: String,
      required: true
    },
    message: {
      type: String,
      required: true
    },
    type: {
      type: String,
      required: true,
      enum: ['message', 'call', 'appointment', 'system', 'mood', 'other']
    },
    data: {
      type: Object,
      default: {}
    },
    read: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  });
}

module.exports = createNotificationSchema;