import { 
  collection, 
  addDoc, 
  serverTimestamp,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  runTransaction,
  increment,
  onSnapshot  // ADD THIS IMPORT
} from 'firebase/firestore';
import { db } from '../firebase';

// Generate 6-digit room code
const generateRoomCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Check if room code is unique
const isRoomCodeUnique = async (code) => {
  const roomsRef = collection(db, 'rooms');
  const q = query(roomsRef, where('roomCode', '==', code));
  const querySnapshot = await getDocs(q);
  return querySnapshot.empty;
};

// Create a new room
export const createRoom = async (roomData, user) => {
  try {
    // Generate unique room code
    let roomCode;
    let isUnique = false;
    
    // Try up to 5 times to get a unique code
    for (let i = 0; i < 5; i++) {
      roomCode = generateRoomCode();
      isUnique = await isRoomCodeUnique(roomCode);
      if (isUnique) break;
    }
    
    if (!isUnique) {
      throw new Error('Could not generate unique room code. Please try again.');
    }

    const room = {
      name: roomData.name || `${user.displayName}'s Room`,
      maxParticipants: Math.min(Math.max(roomData.maxParticipants, 2), 10),
      currentParticipants: 1,
      hostId: user.uid,
      hostName: user.displayName,
      hostPhotoURL: user.photoURL || '',
      createdAt: serverTimestamp(),
      lastActivity: serverTimestamp(),
      isActive: true,
      status: 'waiting',
      roomCode: roomCode
    };

    // Add room to Firestore
    const roomRef = await addDoc(collection(db, 'rooms'), room);
    
    // Add host as first participant
    await setDoc(doc(db, 'rooms', roomRef.id, 'participants', user.uid), {
      name: user.displayName,
      email: user.email,
      photoURL: user.photoURL || '',
      joinedAt: serverTimestamp(),
      isHost: true,
      isActive: true
    });

    return {
      id: roomRef.id,
      ...room,
      roomCode
    };
  } catch (error) {
    console.error('Error creating room:', error);
    throw error;
  }
};

// Get room by ID
export const getRoom = async (roomId) => {
  try {
    const roomRef = doc(db, 'rooms', roomId);
    const roomSnap = await getDoc(roomRef);
    
    if (roomSnap.exists()) {
      return {
        id: roomSnap.id,
        ...roomSnap.data()
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting room:', error);
    throw error;
  }
};

// Get room by code
export const getRoomByCode = async (roomCode) => {
  try {
    const roomsRef = collection(db, 'rooms');
    const q = query(roomsRef, where('roomCode', '==', roomCode));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const roomDoc = querySnapshot.docs[0];
      return {
        id: roomDoc.id,
        ...roomDoc.data()
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting room by code:', error);
    throw error;
  }
};

// Get all active rooms
export const getActiveRooms = async () => {
  try {
    const roomsRef = collection(db, 'rooms');
    const q = query(
      roomsRef, 
      where('isActive', '==', true),
      where('status', 'in', ['waiting', 'active'])
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting active rooms:', error);
    throw error;
  }
};

// Get participants of a room
export const getRoomParticipants = async (roomId) => {
  try {
    const participantsRef = collection(db, 'rooms', roomId, 'participants');
    const querySnapshot = await getDocs(participantsRef);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting participants:', error);
    throw error;
  }
};

// Join a room
export const joinRoom = async (roomId, user) => {
  try {
    console.log(`=== JOIN ROOM ATTEMPT ===`);
    console.log(`User: ${user.uid} (${user.displayName})`);
    console.log(`Room: ${roomId}`);
    
    // First, check if user is already a participant
    const participantRef = doc(db, 'rooms', roomId, 'participants', user.uid);
    const participantSnap = await getDoc(participantRef);
    
    if (participantSnap.exists()) {
      console.log('User already a participant, skipping join');
      return { alreadyJoined: true };
    }
    
    // Get current room state
    const roomRef = doc(db, 'rooms', roomId);
    const roomSnap = await getDoc(roomRef);
    
    if (!roomSnap.exists()) {
      throw new Error('Room not found');
    }
    
    const roomData = roomSnap.data();
    console.log('Current room state:', roomData);
    
    // Check if room is full
    if (roomData.currentParticipants >= roomData.maxParticipants) {
      console.log('Room is full, cannot join');
      throw new Error('Room is full');
    }
    
    // Use transaction for atomic operation
    console.log('Starting transaction to join room...');
    await runTransaction(db, async (transaction) => {
      // Get fresh data within transaction
      const freshRoomSnap = await transaction.get(roomRef);
      if (!freshRoomSnap.exists()) {
        throw new Error('Room not found');
      }
      
      const freshRoomData = freshRoomSnap.data();
      console.log('Fresh room data in transaction:', freshRoomData);
      
      // Check again if room is full
      if (freshRoomData.currentParticipants >= freshRoomData.maxParticipants) {
        throw new Error('Room is now full');
      }
      
      // Check again if user already joined (race condition)
      const freshParticipantSnap = await transaction.get(participantRef);
      if (freshParticipantSnap.exists()) {
        console.log('User already joined (race condition detected)');
        return; // User already joined, nothing to do
      }
      
      // Add participant
      transaction.set(participantRef, {
        name: user.displayName,
        email: user.email,
        photoURL: user.photoURL || '',
        joinedAt: serverTimestamp(),
        isHost: false,
        isActive: true
      });
      
      // Update participant count
      transaction.update(roomRef, {
        currentParticipants: freshRoomData.currentParticipants + 1,
        lastActivity: serverTimestamp()
      });
      
      console.log('Transaction successful - user joined');
    });
    
    console.log('=== JOIN SUCCESSFUL ===');
    return { success: true };
    
  } catch (error) {
    console.error('Join room error:', error);
    
    // Check if user actually got added despite error (race condition)
    try {
      const finalCheck = await getDoc(doc(db, 'rooms', roomId, 'participants', user.uid));
      if (finalCheck.exists()) {
        console.log('User was added despite error (race condition)');
        return { alreadyJoined: true };
      }
    } catch (checkError) {
      console.error('Final check error:', checkError);
    }
    
    throw error;
  }
};
// Leave a room
export const leaveRoomService = async (roomId, userId) => {
  try {
    const roomRef = doc(db, 'rooms', roomId);
    const participantRef = doc(db, 'rooms', roomId, 'participants', userId);
    
    // Remove participant from subcollection
    await deleteDoc(participantRef);
    
    // Update participant count
    await updateDoc(roomRef, {
      currentParticipants: increment(-1),
      lastActivity: serverTimestamp()
    });
    
    return true;
  } catch (error) {
    console.error('Error leaving room:', error);
    throw error;
  }
};

export const listenToRoom = (roomId, callback) => {
  try {
    const roomRef = doc(db, 'rooms', roomId);
    
    console.log(`Setting up room listener for: ${roomId}`);
    
    const unsubscribe = onSnapshot(roomRef, 
      (snapshot) => {
        console.log(`Room snapshot received for ${roomId}:`, snapshot.exists());
        if (snapshot.exists()) {
          const data = {
            id: snapshot.id,
            ...snapshot.data()
          };
          console.log('Room data:', data);
          callback(data);
        } else {
          console.log('Room does not exist');
          callback(null);
        }
      },
      (error) => {
        console.error('Error in room listener:', error);
        callback(null, error);
      }
    );
    
    return unsubscribe;
  } catch (error) {
    console.error('Error setting up room listener:', error);
    throw error;
  }
};

// Listen to room participants in real-time
export const listenToParticipants = (roomId, callback) => {
  try {
    const participantsRef = collection(db, 'rooms', roomId, 'participants');
    
    console.log(`Setting up participants listener for room: ${roomId}`);
    
    const unsubscribe = onSnapshot(participantsRef, 
      (snapshot) => {
        const participants = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        console.log(`Participants snapshot: ${participants.length} participants`);
        callback(participants);
      },
      (error) => {
        console.error('Error in participants listener:', error);
        callback([], error);
      }
    );
    
    return unsubscribe;
  } catch (error) {
    console.error('Error setting up participants listener:', error);
    throw error;
  }
};

// Listen to all active rooms (for dashboard)
export const listenToActiveRooms = (callback) => {
  try {
    const roomsRef = collection(db, 'rooms');
    const q = query(
      roomsRef, 
      where('isActive', '==', true),
      where('status', 'in', ['waiting', 'active'])
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rooms = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(rooms);
    }, (error) => {
      console.error('Error listening to active rooms:', error);
    });
    
    return unsubscribe;
  } catch (error) {
    console.error('Error setting up active rooms listener:', error);
    throw error;
  }
};

// Update room activity timestamp
export const updateRoomActivity = async (roomId) => {
  try {
    const roomRef = doc(db, 'rooms', roomId);
    await updateDoc(roomRef, {
      lastActivity: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating room activity:', error);
  }
};

// End/delete room
export const endRoom = async (roomId) => {
  try {
    const roomRef = doc(db, 'rooms', roomId);
    await updateDoc(roomRef, {
      isActive: false,
      status: 'ended'
    });
  } catch (error) {
    console.error('Error ending room:', error);
    throw error;
  }
};

// Validate if a user can join a room
export const validateRoomJoin = async (roomId, userId) => {
  try {
    const room = await getRoom(roomId);
    
    if (!room) {
      return { valid: false, error: 'Room not found' };
    }
    
    if (!room.isActive || room.status === 'ended') {
      return { valid: false, error: 'Room is no longer active' };
    }
    
    if (room.currentParticipants >= room.maxParticipants) {
      return { valid: false, error: 'Room is full' };
    }
    
    // Check if user is already in the room
    const participants = await getRoomParticipants(roomId);
    const isAlreadyParticipant = participants.some(p => p.id === userId);
    
    if (isAlreadyParticipant) {
      return { valid: true, warning: 'User already in room' };
    }
    
    return { valid: true };
  } catch (error) {
    console.error('Error validating room join:', error);
    return { valid: false, error: 'Validation failed' };
  }
};