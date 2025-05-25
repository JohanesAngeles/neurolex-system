// server/src/models/BillingRecord.js
const mongoose = require('mongoose');

const billingRecordSchema = new mongoose.Schema({
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'PHP', 'EUR', 'GBP']
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'paid', 'overdue', 'cancelled'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'gcash', 'paymaya', 'bank_transfer', 'credit_card', 'other']
  },
  transactionId: {
    type: String
  },
  notes: {
    type: String,
    maxlength: 1000
  },
  dueDate: {
    type: Date,
    required: true
  },
  paidAt: {
    type: Date
  },
  // Multi-tenant support
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: false,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for efficient queries
billingRecordSchema.index({ doctor: 1, status: 1 });
billingRecordSchema.index({ patient: 1, status: 1 });
billingRecordSchema.index({ appointment: 1 }, { unique: true });
billingRecordSchema.index({ dueDate: 1, status: 1 });
billingRecordSchema.index({ tenantId: 1 }, { sparse: true });

// Update the updatedAt field on save
billingRecordSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Virtual for overdue status
billingRecordSchema.virtual('isOverdue').get(function() {
  return this.status === 'pending' && this.dueDate < new Date();
});

// Static method to get billing summary
billingRecordSchema.statics.getBillingSummary = async function(doctorId, dateRange = {}) {
  const pipeline = [
    { $match: { 
        doctor: mongoose.Types.ObjectId(doctorId),
        ...(dateRange.startDate && { createdAt: { $gte: dateRange.startDate } }),
        ...(dateRange.endDate && { createdAt: { $lte: dateRange.endDate } })
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }
    }
  ];
  
  return this.aggregate(pipeline);
};

module.exports = mongoose.model('BillingRecord', billingRecordSchema);