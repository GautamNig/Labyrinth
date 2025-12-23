// App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';  // ADD THIS IMPORT
import { AuthProvider } from './contexts/AuthContext';
import { MediaProvider } from './contexts/MediaContext';
import { RoomProvider } from './contexts/RoomContext';
import { PeerProvider } from './contexts/PeerContext';  // ADD THIS IMPORT
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import RoomPage from './pages/RoomPage';
import './styles/index.css';

function App() {
  return (
    <AuthProvider>
      <MediaProvider>
        <RoomProvider>
          <PeerProvider>  {/* Add PeerProvider */}
            <BrowserRouter>  {/* Now BrowserRouter is defined */}
              <Routes>
  <Route path="/" element={<LoginPage />} />
  <Route path="/Labyrinth" element={<LoginPage />} /> {/* Add this line */}
  <Route path="/dashboard" element={
    <ProtectedRoute>
      <DashboardPage />
    </ProtectedRoute>
  } />
  <Route path="/room/:roomId" element={
    <ProtectedRoute>
      <RoomPage />
    </ProtectedRoute>
  } />
  {/* Add a catch-all redirect */}
  <Route path="*" element={<LoginPage />} />
</Routes>
            </BrowserRouter>
          </PeerProvider>
        </RoomProvider>
      </MediaProvider>
    </AuthProvider>
  );
}

export default App;