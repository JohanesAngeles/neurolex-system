import React, { useState, useEffect, useCallback } from 'react';
import todoService from '../../services/todoService';
import { getSocket } from '../../services/socketService';
import moodService from '../../services/moodService';
import '../../styles/components/dashboard/todoList.css';

const TodoList = ({ user, onShowMoodTracker }) => {
  const [todoItems, setTodoItems] = useState([]);
  const [needsMoodCheck, setNeedsMoodCheck] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user needs a mood check
  const checkMoodStatus = useCallback(() => {
    try {
      const needsCheck = !moodService.hasSubmittedToday();
      setNeedsMoodCheck(needsCheck);
      console.log("TodoList: Needs mood check:", needsCheck);
    } catch (error) {
      console.error("Error checking mood status:", error);
      setNeedsMoodCheck(true);
    }
  }, []);

  // Setup socket listeners for real-time updates
  const setupSocketListeners = useCallback(() => {
    const socket = getSocket();
    if (!socket) return;

    // Listen for todo item events
    socket.on('todoCreated', (newTodo) => {
      console.log('New todo created:', newTodo);
      setTodoItems(prev => [newTodo, ...prev]);
    });

    socket.on('todoCompleted', (todoId) => {
      console.log('Todo completed:', todoId);
      setTodoItems(prev => prev.filter(item => item._id !== todoId));
    });

    socket.on('todoDeleted', (todoId) => {
      console.log('Todo deleted:', todoId);
      setTodoItems(prev => prev.filter(item => item._id !== todoId));
    });

    return () => {
      socket.off('todoCreated');
      socket.off('todoCompleted');
      socket.off('todoDeleted');
    };
  }, []);

  // Load data from API
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Check mood tracker status
      checkMoodStatus();
      
      // Load todo items from API
      const items = await todoService.getTodoItems();
      setTodoItems(items);
    } catch (err) {
      console.error('Error loading todo data:', err);
      setError('Failed to load to-do items. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [checkMoodStatus]);

  // Initialize component
  useEffect(() => {
    if (user) {
      loadData();
      setupSocketListeners();
    }
  }, [user, loadData, setupSocketListeners]);

  // Listen for mood submission events
  useEffect(() => {
    const handleMoodSubmitted = () => {
      console.log("TodoList: Mood submitted event detected");
      setNeedsMoodCheck(false);
    };

    window.addEventListener('moodSubmitted', handleMoodSubmitted);
    
    return () => {
      window.removeEventListener('moodSubmitted', handleMoodSubmitted);
    };
  }, []);

  // Also check localStorage for mood submissions
  useEffect(() => {
    const checkInterval = setInterval(() => {
      const hasSubmitted = moodService.hasSubmittedToday();
      if (hasSubmitted && needsMoodCheck) {
        console.log("TodoList: Mood submitted detected via check");
        setNeedsMoodCheck(false);
      }
    }, 3000); // Check every 3 seconds
    
    return () => clearInterval(checkInterval);
  }, [needsMoodCheck]);

  const handleGoToMoodTracker = () => {
    try {
      // Call parent component's handler
      if (typeof onShowMoodTracker === 'function') {
        onShowMoodTracker();
      }
    } catch (error) {
      console.error("Error handling mood tracker:", error);
    }
  };

  if (isLoading) {
    return <div className="todo-list-loading">Loading to-do items...</div>;
  }

  return (
    <div className="todo-list-container">
      <div className="todo-header">
        <h2>To-do</h2>
      </div>
      
      {error && (
        <div className="todo-error-message">{error}</div>
      )}
      
      <div className="todo-items">
        {/* Mood tracker reminder */}
        {needsMoodCheck && (
          <div className="todo-item mood-reminder">
            <div className="todo-item-content">
              <div className="todo-item-text">Complete your daily mood check-in</div>
              <div className="todo-item-time">Today</div>
            </div>
            <button 
              className="todo-item-action" 
              onClick={handleGoToMoodTracker}
            >
              Go
            </button>
          </div>
        )}
        
        {/* Regular todo items - display only, no checkbox */}
        {todoItems.map(item => (
          <div className="todo-item" key={item._id}>
            <div className="todo-item-content">
              <div className="todo-item-text">{item.text}</div>
              <div className="todo-item-time">
                {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'No due date'}
              </div>
            </div>
            <button 
              className="todo-item-action"
              onClick={() => console.log('Todo action', item._id)}
            >
              Go
            </button>
          </div>
        ))}
        
        {/* Empty state */}
        {todoItems.length === 0 && !needsMoodCheck && (
          <div className="empty-todo">
            <p>No tasks for today</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TodoList;