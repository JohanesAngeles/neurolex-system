import React, { useState, useEffect } from 'react';
import '../../styles/components/dashboard/moodCalendar.css';
import moodService from '../../services/moodService';

// Import SVGs directly
import greatMood from '../../assets/moods/Face_Im Great.svg';
import goodMood from '../../assets/moods/Face_Im good.svg';
import okayMood from '../../assets/moods/Face_Im okay.svg';
import strugglingMood from '../../assets/moods/Face_Im struggling.svg';
import upsetMood from '../../assets/moods/Face_Im upset.svg';

// Mapping of mood values to SVGs
const moodIcons = {
  'great': greatMood,
  'good': goodMood,
  'okay': okayMood,
  'struggling': strugglingMood,
  'upset': upsetMood
};

const MoodCalendar = ({ refreshTrigger = 0, newMoodData = null }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [moodEntries, setMoodEntries] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  
  // Extract month and year to use in dependencies
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  // Get mood data for the current month
  const fetchMoodEntries = async () => {
    console.log("MoodCalendar: Fetching mood entries...");
    setIsLoading(true);
    try {
      const response = await moodService.getMoodHistory(31); // Get up to 31 days of history
      
      // Process the mood data into an object keyed by date
      const entriesByDate = {};
      if (response && response.moods) {
        response.moods.forEach(entry => {
          const date = new Date(entry.timestamp);
          const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
          entriesByDate[dateKey] = entry;
        });
      }
      
      // IMPORTANT: Also check localStorage for any pending entries
      const userId = moodService.getCurrentUserId();
      if (userId) {
        const pendingEntriesKey = `pendingMoodEntries_${userId}`;
        try {
          const pendingEntries = JSON.parse(localStorage.getItem(pendingEntriesKey) || '[]');
          
          pendingEntries.forEach(entry => {
            const date = new Date(entry.timestamp);
            const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
            entriesByDate[dateKey] = entry;
          });
        } catch (e) {
          console.error("Error parsing pending entries:", e);
        }
      }
      
      console.log("MoodCalendar: Updated entries:", entriesByDate);
      setMoodEntries(entriesByDate);
    } catch (error) {
      console.error('Error fetching mood entries:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle direct mood data passed from parent
  useEffect(() => {
    if (newMoodData) {
      console.log("MoodCalendar: Received new mood data directly:", newMoodData);
      
      // Update the mood entries with the new data
      setMoodEntries(prev => {
        const date = new Date(newMoodData.timestamp);
        const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
        
        return {
          ...prev,
          [dateKey]: newMoodData
        };
      });
    }
  }, [newMoodData]);

  // Refresh when the refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger > 0) {
      console.log("MoodCalendar: Refresh triggered:", refreshTrigger);
      fetchMoodEntries();
    }
  }, [refreshTrigger]);

  // Initial fetch and reload when month changes
  useEffect(() => {
    console.log("MoodCalendar: Month/year changed, fetching data...");
    fetchMoodEntries();
  }, [currentMonth, currentYear]);

  // Setup listeners for mood submission events
  useEffect(() => {
    console.log("MoodCalendar: Setting up event listeners");
    
    // Create event handler for mood submissions
    const handleMoodSubmitted = (event) => {
      console.log("MoodCalendar: Mood submission event captured:", event.detail);
      fetchMoodEntries();
    };
    
    // Listen for custom mood submission events
    window.addEventListener('moodSubmitted', handleMoodSubmitted);
    
    // Check localStorage on a regular interval
    const checkLocalStorageInterval = setInterval(() => {
      const userId = moodService.getCurrentUserId();
      if (userId) {
        const lastSubmissionKey = `lastMoodSubmission_${userId}`;
        const lastSubmission = localStorage.getItem(lastSubmissionKey);
        
        if (lastSubmission) {
          const lastDate = new Date(lastSubmission);
          const now = new Date();
          
          // If submission was in the last minute, refresh
          if ((now.getTime() - lastDate.getTime()) < 60000) {
            console.log("MoodCalendar: Recent submission detected in localStorage, refreshing");
            fetchMoodEntries();
          }
        }
      }
    }, 5000); // Check every 5 seconds
    
    return () => {
      window.removeEventListener('moodSubmitted', handleMoodSubmitted);
      clearInterval(checkLocalStorageInterval);
    };
  }, []);
  
  // Add a manual refresh every 10 seconds until we see data
  useEffect(() => {
    const isEmpty = Object.keys(moodEntries).length === 0;
    
    if (isEmpty) {
      const interval = setInterval(() => {
        console.log("MoodCalendar: Auto-refreshing calendar data");
        fetchMoodEntries();
      }, 10000);
      
      return () => clearInterval(interval);
    }
  }, [moodEntries]);

  // Generate calendar days for the current month
  const generateCalendarDays = () => {
    const year = currentYear;
    const month = currentMonth;
    
    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);
    
    // Get the day of the week for the first day (0 = Sunday, 1 = Monday, etc.)
    const firstDayOfWeek = firstDay.getDay();
    
    // Total days in the month
    const daysInMonth = lastDay.getDate();
    
    // Generate array of calendar days
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push({ day: null, isCurrentMonth: false });
    }
    
    // Add cells for each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateKey = `${year}-${month}-${day}`;
      const moodEntry = moodEntries[dateKey];
      
      days.push({
        day,
        date,
        isCurrentMonth: true,
        isToday: isToday(date),
        mood: moodEntry ? moodEntry.mood : null
      });
    }
    
    return days;
  };

  // Check if a date is today
  const isToday = (date) => {
    const today = new Date();
    return date.getDate() === today.getDate() && 
           date.getMonth() === today.getMonth() && 
           date.getFullYear() === today.getFullYear();
  };

  // Go to the previous month
  const prevMonth = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() - 1);
      return newDate;
    });
  };

  // Go to the next month
  const nextMonth = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + 1);
      return newDate;
    });
  };
  


  // Format the month and year for display
  const formatMonthYear = () => {
    const options = { month: 'long', year: 'numeric' };
    return currentDate.toLocaleDateString('en-US', options);
  };

  return (
    <div className="mood-calendar">
      <div className="mood-calendar-header">
        <div className="mood-calendar-title">
          <h2>{formatMonthYear()}</h2>
          <div className="month-navigation">
            <button className="month-nav-btn" onClick={prevMonth}>&lt;</button>
            <button className="month-nav-btn" onClick={nextMonth}>&gt;</button>
            
          </div>
        </div>
      </div>
      
      <div className="calendar-container">
        <div className="weekday-headers">
          <div className="weekday">SU</div>
          <div className="weekday">M</div>
          <div className="weekday">T</div>
          <div className="weekday">W</div>
          <div className="weekday">TH</div>
          <div className="weekday">F</div>
          <div className="weekday">S</div>
        </div>
        
        <div className="days-grid">
          {generateCalendarDays().map((day, index) => (
            <div 
              key={index} 
              className={`calendar-day ${!day.isCurrentMonth ? 'other-month' : ''} ${day.isToday ? 'today' : ''} ${day.mood ? 'has-mood' : ''}`}
            >
              {day.day && (
                <>
                  <div className="day-number">{day.day}</div>
                  {day.mood && (
                    <div className="mood-icon">
                      <img 
                        src={moodIcons[day.mood]} 
                        alt={day.mood} 
                        title={`Mood: ${day.mood}`}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {isLoading && <div className="calendar-loading">Loading...</div>}
      
      {/* Divider line */}
      <div className="calendar-divider"></div>
      
      {/* Legend section */}
      <div className="calendar-legend">
        <div className="legend-item">
          <div className="legend-marker light-green">#</div>
          <span className="legend-text">Mood check-in logged</span>
        </div>
        
        <div className="legend-item">
          <div className="legend-marker dark-green">#</div>
          <span className="legend-text">Journal entry written</span>
        </div>
      </div>
    </div>
  );
};

export default MoodCalendar;