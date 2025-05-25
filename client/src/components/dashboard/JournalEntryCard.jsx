// src/components/dashboard/JournalEntryCard.jsx
import React from 'react';
import '../../styles/components/dashboard/journalEntryCard.css';

/**
 * Component to display a journal entry card on the dashboard
 */
const JournalEntryCard = ({ entry, onClick }) => {
  // Format date to display
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        weekday: 'short',
        month: 'short', 
        day: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };
  
  // Shorten text for preview
  const shortenText = (text, maxLength = 100) => {
    if (!text) return '';
    
    if (text.length <= maxLength) return text;
    
    return text.substring(0, maxLength) + '...';
  };
  
  // Get the content to display
  const getDisplayContent = () => {
    // If it's a template-based entry with responses
    if (entry.responses && entry.responses.size > 0) {
      // Try to get the first response value
      const firstKey = Array.from(entry.responses.keys())[0];
      return shortenText(entry.responses.get(firstKey));
    }
    
    // Try new journal fields structure
    if (entry.journalFields) {
      // Try to get a non-empty field in the following priority
      const fields = [
        entry.journalFields.thoughtReflection,
        entry.journalFields.gratitude,
        entry.journalFields.challengeReflection,
        entry.journalFields.tomorrowIntention,
        entry.journalFields.lovingReminder
      ];
      
      for (const field of fields) {
        if (field && field.trim()) {
          return shortenText(field);
        }
      }
    }
    
    // Fall back to raw text
    if (entry.rawText) {
      return shortenText(entry.rawText);
    }
    
    return 'No content to display';
  };
  
  // Get sentiment emoji based on sentiment type
  const getSentimentEmoji = () => {
    const sentimentType = entry.sentimentAnalysis?.sentiment?.type || 
                          entry.journalFields?.quickMood || 
                          'neutral';
    
    switch (sentimentType) {
      case 'positive':
        return '😊';
      case 'negative':
        return '😔';
      case 'neutral':
      default:
        return '😐';
    }
  };
  
  // Get the title for the journal entry
  const getEntryTitle = () => {
    if (entry.title) return entry.title;
    if (entry.template && entry.template.name) return entry.template.name;
    
    // If no specific title, create one based on date
    return `Journal Entry - ${formatDate(entry.createdAt)}`;
  };
  
  // Get the first emotion tag if available
  const getPrimaryEmotion = () => {
    const emotions = entry.sentimentAnalysis?.emotions || 
                     entry.sentimentAnalysis?.sentiment?.emotions || 
                     [];
    
    if (emotions.length === 0) return null;
    
    const emotion = typeof emotions[0] === 'string' ? 
      emotions[0] : 
      emotions[0]?.name || emotions[0]?.emotion;
    
    if (!emotion) return null;
    
    return emotion.charAt(0).toUpperCase() + emotion.slice(1);
  };
  
  return (
    <div className="journal-entry-card" onClick={() => onClick && onClick(entry._id)}>
      <div className="journal-entry-date">{formatDate(entry.createdAt)}</div>
      
      <div className="journal-entry-content">
        <div className="journal-entry-title">{getEntryTitle()}</div>
        <div className="journal-entry-preview">{getDisplayContent()}</div>
      </div>
      
      <div className="journal-entry-footer">
        <div className="journal-entry-sentiment">
          <span className="sentiment-emoji">{getSentimentEmoji()}</span>
          {getPrimaryEmotion() && (
            <span className="primary-emotion">{getPrimaryEmotion()}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default JournalEntryCard;