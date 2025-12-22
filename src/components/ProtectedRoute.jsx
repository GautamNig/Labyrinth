import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/index.css'; // Add this import

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex-center" style={{ minHeight: '100vh', backgroundColor: 'var(--bg-dark)' }}>
        <div className="text-center">
          <div className="spinner"></div>
          <p style={{ marginTop: '1rem', color: 'var(--text-light)' }}>Loading Labyrinth...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;