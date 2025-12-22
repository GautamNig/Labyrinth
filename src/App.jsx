import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { RoomProvider } from './contexts/RoomContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import RoomPage from './pages/RoomPage';
import ProtectedRoute from './components/ProtectedRoute';
import './index.css';

function App() {
  return (
    <Router>
      <AuthProvider>
        <RoomProvider> {/* Make sure this wraps everything */}
          <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/room/:roomId"
              element={
                <ProtectedRoute>
                  <RoomPage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </RoomProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;