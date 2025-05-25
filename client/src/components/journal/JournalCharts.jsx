import React, { useState, useEffect } from 'react';
import { 
  LineChart, 
  Line, 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

// Mock data - replace with actual data in production
const generateMockData = (days) => {
  const sentiments = ['positive', 'neutral', 'negative'];
  const today = new Date();
  
  return Array(days).fill().map((_, i) => {
    const date = new Date();
    date.setDate(today.getDate() - (days - 1) + i);
    
    return {
      date: date.toISOString().split('T')[0],
      day: date.toLocaleDateString('en-US', { weekday: 'short' }),
      sentiment: sentiments[Math.floor(Math.random() * 3)],
      sentimentValue: Math.floor(Math.random() * 100)
    };
  });
};

const COLORS = {
  positive: '#4CAF50',
  neutral: '#FFEB3B',
  negative: '#FF5252',
  unlogged: '#E0E0E0'
};

const CHART_COLORS = ['#4CAF50', '#FFEB3B', '#FF5252', '#E0E0E0'];

const JournalCharts = () => {
  const [timeFrame, setTimeFrame] = useState('week');
  const [data, setData] = useState([]);
  const [summaryData, setSummaryData] = useState([]);
  
  useEffect(() => {
    // Simulate API call
    const mockData = generateMockData(timeFrame === 'week' ? 7 : 30);
    setData(mockData);
    
    // Calculate summary data
    const positive = mockData.filter(d => d.sentiment === 'positive').length;
    const neutral = mockData.filter(d => d.sentiment === 'neutral').length;
    const negative = mockData.filter(d => d.sentiment === 'negative').length;
    
    setSummaryData([
      { name: 'Positive', value: positive },
      { name: 'Neutral', value: neutral },
      { name: 'Negative', value: negative }
    ]);
  }, [timeFrame]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 shadow-md rounded-md">
          <p className="font-medium">{`${label}`}</p>
          <p className="text-sm">
            Sentiment: <span style={{ color: COLORS[payload[0].payload.sentiment] }}>
              {payload[0].payload.sentiment}
            </span>
          </p>
          <p className="text-sm">{`Value: ${payload[0].value}`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full space-y-8">
      {/* Timeframe selector */}
      <div className="flex justify-end mb-4">
        <select 
          className="bg-gray-100 border border-gray-300 rounded-md px-3 py-1"
          value={timeFrame}
          onChange={(e) => setTimeFrame(e.target.value)}
        >
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
      </div>
      
      {/* Sentiment Distribution Pie Chart */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h3 className="text-lg font-medium mb-4">Sentiment Distribution</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={summaryData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {summaryData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={CHART_COLORS[index]} 
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Sentiment Timeline */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h3 className="text-lg font-medium mb-4">Sentiment Timeline</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="day" 
                padding={{ left: 10, right: 10 }} 
              />
              <YAxis domain={[0, 100]} />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="sentimentValue" 
                stroke="#8884d8" 
                activeDot={{ r: 8 }} 
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Daily Sentiment Bar Chart */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h3 className="text-lg font-medium mb-4">Daily Mood Summary</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.slice(-7)}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="sentimentValue" 
                name="Mood Score"
                barSize={30}
              >
                {data.slice(-7).map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[entry.sentiment]} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex justify-center gap-6">
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
          <span className="text-sm">Positive</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-yellow-400 mr-2"></div>
          <span className="text-sm">Neutral</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
          <span className="text-sm">Negative</span>
        </div>
      </div>
    </div>
  );
};

export default JournalCharts;