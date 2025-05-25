import axios from 'axios';

// Create a dedicated axios instance for user service
const userAxios = axios.create({
  baseURL: '/api/users',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests with detailed logging
userAxios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for detailed error logging
userAxios.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    return Promise.reject(error);
  }
);

// User profile operations
const getCurrentUser = async () => {
  try {
    const response = await userAxios.get('/me');
    return response.data;
  } catch (error) {
    console.error('Error getting current user:', error);
    throw error;
  }
};

const saveOnboardingData = async (onboardingData) => {
  try {
    const response = await userAxios.post('/onboarding', onboardingData);
    return response.data;
  } catch (error) {
    console.error('Error saving onboarding data:', error);
    throw error;
  }
};

const skipOnboarding = async () => {
  try {
    const response = await userAxios.post('/onboarding/skip');
    return response.data;
  } catch (error) {
    console.error('Error skipping onboarding:', error);
    throw error;
  }
};

// Todo item operations
const getTodoItems = async () => {
  try {
    const response = await userAxios.get('/todo-items');
    return response.data;
  } catch (error) {
    console.error('Error fetching todo items:', error);
    throw error;
  }
};

const createTodoItem = async (todoData) => {
  try {
    const response = await userAxios.post('/todo-items', todoData);
    return response.data;
  } catch (error) {
    console.error('Error creating todo item:', error);
    throw error;
  }
};

const completeTodoItem = async (itemId) => {
  try {
    const response = await userAxios.patch(`/todo-items/${itemId}/complete`);
    return response.data;
  } catch (error) {
    console.error(`Error completing todo item ${itemId}:`, error);
    throw error;
  }
};

const deleteTodoItem = async (itemId) => {
  try {
    const response = await userAxios.delete(`/todo-items/${itemId}`);
    return response.data;
  } catch (error) {
    console.error(`Error deleting todo item ${itemId}:`, error);
    throw error;
  }
};

// Notification operations
const getNotifications = async () => {
  try {
    const response = await userAxios.get('/notifications');
    return response.data;
  } catch (error) {
    console.error('Error fetching notifications:', error);
    throw error;
  }
};

const markNotificationAsRead = async (notificationId) => {
  try {
    const response = await userAxios.patch(`/notifications/${notificationId}/read`);
    return response.data;
  } catch (error) {
    console.error(`Error marking notification ${notificationId} as read:`, error);
    throw error;
  }
};

const markAllNotificationsAsRead = async () => {
  try {
    const response = await userAxios.patch('/notifications/read-all');
    return response.data;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};

// Connection testing
const testConnection = async () => {
  const token = localStorage.getItem('token');
  
  try {
    const response = await fetch('/api/users/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        status: response.status,
        message: errorData.message || 'Unknown error'
      };
    }
    
    const data = await response.json();
    return {
      success: true,
      data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
};

const userService = {
  // User profile
  getCurrentUser,
  saveOnboardingData,
  skipOnboarding,
  testConnection,
  
  // Todo items
  getTodoItems,
  createTodoItem,
  completeTodoItem,
  deleteTodoItem,
  
  // Notifications
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead
};

export default userService;