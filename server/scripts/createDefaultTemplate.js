// Save this as server/src/scripts/createDefaultTemplate.js

const mongoose = require('mongoose');
const FormTemplate = require('../models/FormTemplate');
const config = require('../config/db');

// Connect to database
mongoose.connect(config.mongoURI)
  .then(() => console.log('MongoDB connected...'))
  .catch(err => console.error('MongoDB connection error:', err));

// Create default daily journal template
const createDefaultTemplate = async () => {
  try {
    // Check if a default template already exists
    const existingTemplate = await FormTemplate.findOne({ name: 'Daily Journal' });
    
    if (existingTemplate) {
      console.log('Default template already exists');
      return;
    }
    
    const dailyJournalTemplate = new FormTemplate({
      name: 'Daily Journal',
      description: 'Track your daily thoughts, feelings, and experiences',
      category: 'daily_reflection',
      isActive: true,
      fields: [
        {
          id: 'mood',
          type: 'radio',
          label: 'How are you feeling today?',
          required: true,
          order: 1,
          options: [
            { label: 'Great', value: 'great' },
            { label: 'Good', value: 'good' },
            { label: 'Okay', value: 'okay' },
            { label: 'Not good', value: 'not_good' },
            { label: 'Terrible', value: 'terrible' }
          ]
        },
        {
          id: 'journal',
          type: 'textarea',
          label: 'Write about your day',
          placeholder: 'How was your day? What did you do? How did you feel?',
          required: true,
          order: 2
        },
        {
          id: 'sleep',
          type: 'select',
          label: 'How well did you sleep last night?',
          required: false,
          order: 3,
          options: [
            { label: 'Very well', value: 'very_well' },
            { label: 'Well', value: 'well' },
            { label: 'Average', value: 'average' },
            { label: 'Poorly', value: 'poorly' },
            { label: 'Very poorly', value: 'very_poorly' }
          ]
        },
        {
          id: 'activities',
          type: 'checkbox',
          label: 'What activities did you do today?',
          required: false,
          order: 4,
          options: [
            { label: 'Exercise', value: 'exercise' },
            { label: 'Social interaction', value: 'social' },
            { label: 'Meditation', value: 'meditation' },
            { label: 'Work/Study', value: 'work' },
            { label: 'Hobbies', value: 'hobbies' },
            { label: 'Self-care', value: 'self_care' }
          ]
        },
        {
          id: 'stress_level',
          type: 'rating',
          label: 'What was your stress level today?',
          required: false,
          order: 5,
          min: 0,
          max: 10,
          options: [
            { label: 'No stress', value: '0' },
            { label: 'High stress', value: '10' }
          ]
        }
      ]
    });
    
    await dailyJournalTemplate.save();
    console.log('Default template created successfully');
  } catch (err) {
    console.error('Error creating default template:', err);
  } finally {
    mongoose.disconnect();
  }
};

createDefaultTemplate();

// To run this script:
// node server/src/scripts/createDefaultTemplate.js