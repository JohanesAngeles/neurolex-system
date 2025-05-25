// server/src/models/FormTemplate.js

const mongoose = require('mongoose');

const FieldOptionSchema = new mongoose.Schema({
  value: {
    type: String,
    required: true
  },
  label: {
    type: String,
    required: true
  }
}, { _id: false });

const FormFieldSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['text', 'textarea', 'select', 'multiselect', 'radio', 'checkbox', 'date', 'time', 'rating'],
    required: true
  },
  label: {
    type: String,
    required: true
  },
  placeholder: String,
  helperText: String,
  required: {
    type: Boolean,
    default: false
  },
  options: [FieldOptionSchema],
  min: Number,
  max: Number,
  isPrivate: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    default: 0
  }
}, { _id: false });

const FormTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Template name is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  fields: [FormFieldSchema],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  category: {
    type: String,
    enum: ['daily', 'weekly', 'mood', 'symptom', 'therapy', 'custom'],
    default: 'custom'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Method to duplicate a template
FormTemplateSchema.methods.duplicate = function(newName) {
  const duplicate = this.toObject();
  delete duplicate._id;
  duplicate.name = newName || `${this.name} (Copy)`;
  duplicate.isDefault = false;
  duplicate.createdAt = new Date();
  duplicate.updatedAt = new Date();
  return new FormTemplate(duplicate);
};

const FormTemplate = mongoose.model('FormTemplate', FormTemplateSchema);

module.exports = FormTemplate;