const mongoose = require('mongoose');

const bankAccountSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  bankName: {
    type: String,
    required: true,
    maxlength: 100
  },
  accountName: {
    type: String,
    required: true,
    maxlength: 100
  },
  accountNumber: {
    type: String,
    required: true,
    maxlength: 50
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const digitalWalletSchema = new mongoose.Schema({
  enabled: {
    type: Boolean,
    default: false
  },
  qrCode: {
    type: String // URL to QR code image
  },
  accountNumber: {
    type: String
  },
  accountName: {
    type: String
  }
});

const paymentMethodSchema = new mongoose.Schema({
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  gcash: digitalWalletSchema,
  paymaya: digitalWalletSchema,
  bankAccounts: [bankAccountSchema],
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

// Indexes
paymentMethodSchema.index({ doctor: 1 });
paymentMethodSchema.index({ tenantId: 1 }, { sparse: true });

// Update the updatedAt field on save
paymentMethodSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Method to get active payment methods
paymentMethodSchema.methods.getActivePaymentMethods = function() {
  const activeMethods = [];
  
  if (this.gcash.enabled) {
    activeMethods.push({
      type: 'gcash',
      name: 'GCash',
      qrCode: this.gcash.qrCode
    });
  }
  
  if (this.paymaya.enabled) {
    activeMethods.push({
      type: 'paymaya',
      name: 'PayMaya',
      qrCode: this.paymaya.qrCode
    });
  }
  
  this.bankAccounts.filter(account => account.isActive).forEach(account => {
    activeMethods.push({
      type: 'bank_transfer',
      name: account.bankName,
      accountName: account.accountName,
      accountNumber: account.accountNumber
    });
  });
  
  return activeMethods;
};

module.exports = mongoose.model('PaymentMethod', paymentMethodSchema);
