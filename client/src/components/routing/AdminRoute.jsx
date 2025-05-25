// client/src/components/routing/AdminRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    // Show loading spinner
    return <div>Loading...</div>;
  }
  
  if (!user || user.role !== 'admin') {
    // Redirect to login or unauthorized page
    return <Navigate to="/unauthorized" replace />;
  }
  
  return children;
};

export default AdminRoute;