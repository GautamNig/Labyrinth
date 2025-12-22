import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { 
  createRoom as createRoomService, 
  getActiveRooms,
  getRoomByCode,
  getRoom
} from '../services/roomService';

const RoomContext = createContext();

export const useRoom = () => {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error('useRoom must be used within a RoomProvider');
  }
  return context;
};

export const RoomProvider = ({ children }) => {
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Create a new room
  const createRoom = async (roomData) => {
    if (!user) throw new Error('User must be logged in');
    
    setLoading(true);
    setError(null);
    
    try {
      const newRoom = await createRoomService(roomData, user);
      
      // Add to local state
      setRooms(prev => [newRoom, ...prev]);
      setCurrentRoom(newRoom);
      
      return newRoom;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Fetch active rooms
  const fetchActiveRooms = async () => {
    setLoading(true);
    try {
      const activeRooms = await getActiveRooms();
      setRooms(activeRooms);
      return activeRooms;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Join room by ID
  const joinRoomById = async (roomId) => {
    setLoading(true);
    try {
      const room = await getRoom(roomId);
      if (!room || !room.isActive) {
        throw new Error('Room not found or inactive');
      }
      setCurrentRoom(room);
      return room;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Join room by code
  const joinRoomByCode = async (roomCode) => {
    setLoading(true);
    try {
      const room = await getRoomByCode(roomCode);
      if (!room || !room.isActive) {
        throw new Error('Room not found or inactive');
      }
      setCurrentRoom(room);
      return room;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Leave current room
  const leaveRoom = () => {
    setCurrentRoom(null);
  };

  // Clear error
  const clearError = () => {
    setError(null);
  };

  // Initial fetch of rooms
  useEffect(() => {
    if (user) {
      fetchActiveRooms();
    }
  }, [user]);

  const value = {
    rooms,
    currentRoom,
    loading,
    error,
    createRoom,
    fetchActiveRooms,
    joinRoomById,
    joinRoomByCode,
    leaveRoom,
    clearError,
    // ADD THIS LINE - expose setCurrentRoom function
    setCurrentRoom
  };

  return (
    <RoomContext.Provider value={value}>
      {children}
    </RoomContext.Provider>
  );
};