// JournalInsights.test.js
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import JournalInsights from './JournalInsights';
import sentimentService from './sentimentService';

// Mock the sentiment service
jest.mock('./sentimentService');

describe('JournalInsights Component', () => {
  const mockSentimentData = {
    dates: [
      {
        date: '2025-04-13',
        sentiment: 'negative',
        day: 'Sunday',
        dayShort: 'Sun',
        dayOfMonth: '13',
        month: 'Apr'
      },
      {
        date: '2025-04-14',
        sentiment: 'neutral',
        day: 'Monday',
        dayShort: 'Mon',
        dayOfMonth: '14',
        month: 'Apr'
      },
      {
        date: '2025-04-15',
        sentiment: 'neutral',
        day: 'Tuesday',
        dayShort: 'Tue',
        dayOfMonth: '15',
        month: 'Apr'
      },
      {
        date: '2025-04-16',
        sentiment: 'positive',
        day: 'Wednesday',
        dayShort: 'Wed',
        dayOfMonth: '16',
        month: 'Apr'
      },
      {
        date: '2025-04-17',
        sentiment: 'positive',
        day: 'Thursday',
        dayShort: 'Thu',
        dayOfMonth: '17',
        month: 'Apr'
      },
      {
        date: '2025-04-18',
        sentiment: 'negative',
        day: 'Friday',
        dayShort: 'Fri',
        dayOfMonth: '18',
        month: 'Apr'
      },
      {
        date: '2025-04-19',
        sentiment: 'negative',
        day: 'Saturday',
        dayShort: 'Sat',
        dayOfMonth: '19',
        month: 'Apr'
      }
    ],
    summary: {
      positiveDays: 2,
      neutralDays: 2,
      negativeDays: 3,
      unloggedDays: 0,
      totalDays: 7,
      score: 43
    }
  };

  beforeEach(() => {
    // Mock the getSentimentData method
    sentimentService.getSentimentData.mockResolvedValue(mockSentimentData);
  });

  test('renders loading state initially', () => {
    render(<JournalInsights />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('renders sentiment summary after loading', async () => {
    render(<JournalInsights />);
    
    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Check for sentiment summary
    expect(screen.getByText('Sentiment Summary')).toBeInTheDocument();
    expect(screen.getByText('Positive')).toBeInTheDocument();
    expect(screen.getByText('Neutral')).toBeInTheDocument();
    expect(screen.getByText('Negative')).toBeInTheDocument();
    
    // Check for counts
    expect(screen.getByText('2 / 7 days', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('3 / 7 days', { exact: false })).toBeInTheDocument();
  });
  
  test('displays correct sentiment score', async () => {
    render(<JournalInsights />);
    
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    expect(screen.getByText('43')).toBeInTheDocument();
    expect(screen.getByText('Overall Sentiment Score')).toBeInTheDocument();
  });
  
  test('changes time frame when dropdown is changed', async () => {
    const user = userEvent.setup();
    render(<JournalInsights />);
    
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Mock the service for month data
    const monthData = {
      ...mockSentimentData,
      summary: {
        ...mockSentimentData.summary,
        totalDays: 30
      }
    };
    sentimentService.getSentimentData.mockResolvedValue(monthData);
    
    // Change dropdown to 'month'
    const select = screen.getByRole('combobox');
    await user.click(select);
    const monthOption = screen.getByRole('option', { name: 'This Month' });
    await user.click(monthOption);
    
    // Wait for re-render with new data
    await waitFor(() => {
      expect(sentimentService.getSentimentData).toHaveBeenCalledWith('month', expect.anything());
    });
  });
});