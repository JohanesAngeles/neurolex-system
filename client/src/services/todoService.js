

// Get all todo items
const getTodoItems = async () => {
  try {
    console.log("Using mock todo data");
    // Return mock data instead of making the API call
    return [
      { 
        _id: '1', 
        text: 'Review weekly therapy notes', 
        dueDate: new Date().toISOString(),
        createdAt: new Date().toISOString()
      },
      { 
        _id: '2', 
        text: 'Complete therapy exercises', 
        dueDate: new Date(Date.now() + 86400000).toISOString(),
        createdAt: new Date().toISOString()
      }
    ];
    
    // Keep this commented out until the API is working
    /*
    const token = localStorage.getItem('token');
    const response = await axios.get(API_URL, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data.data;
    */
  } catch (error) {
    console.error('Error fetching todo items:', error);
    throw error;
  }
};

// Other methods remain the same, but with console logs or mock returns
const createTodoItem = async (todoData) => {
  try {
    console.log("Creating mock todo item:", todoData);
    // Return a mock response
    return {
      _id: Date.now().toString(),
      ...todoData,
      createdAt: new Date().toISOString()
    };
    
    // Keep this commented out until the API is working
    /*
    const token = localStorage.getItem('token');
    const response = await axios.post(API_URL, todoData, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data.data;
    */
  } catch (error) {
    console.error('Error creating todo item:', error);
    throw error;
  }
};

const completeTodoItem = async (todoId) => {
  try {
    console.log("Completing mock todo item:", todoId);
    // Just return success
    return { success: true };
    
    // Keep this commented out until the API is working
    /*
    const token = localStorage.getItem('token');
    const response = await axios.patch(`${API_URL}/${todoId}/complete`, {}, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data.data;
    */
  } catch (error) {
    console.error('Error completing todo item:', error);
    throw error;
  }
};

const deleteTodoItem = async (todoId) => {
  try {
    console.log("Deleting mock todo item:", todoId);
    // Just return success
    return { success: true };
    
    // Keep this commented out until the API is working
    /*
    const token = localStorage.getItem('token');
    const response = await axios.delete(`${API_URL}/${todoId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
    */
  } catch (error) {
    console.error('Error deleting todo item:', error);
    throw error;
  }
};

const todoService = {
  getTodoItems,
  createTodoItem,
  completeTodoItem,
  deleteTodoItem
};

export default todoService;