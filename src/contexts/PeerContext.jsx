// contexts/PeerContext.jsx - SIMPLIFIED VERSION
import React, { createContext, useContext, useRef, useCallback, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { useMedia } from './MediaContext';
import { useRoom } from './RoomContext';
import { 
  doc, 
  setDoc, 
  getDoc,
  deleteDoc,
  onSnapshot,
  collection,
  addDoc,
  updateDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';

const PeerContext = createContext();

export const usePeer = () => {
  const context = useContext(PeerContext);
  if (!context) {
    throw new Error('usePeer must be used within a PeerProvider');
  }
  return context;
};

export const PeerProvider = ({ children }) => {
  const { user } = useAuth();
  const { localStream } = useMedia();
  const { currentRoom } = useRoom();
  
  const [remoteStream, setRemoteStream] = useState(null);
  const [remoteUser, setRemoteUser] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const isCallerRef = useRef(false);
  const roomIdRef = useRef(null);

  // STUN servers
  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' }
    ]
  };

  // Create peer connection
  const createPeerConnection = useCallback(() => {
    console.log('🔗 Creating new peer connection');
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    
    const pc = new RTCPeerConnection(iceServers);
    peerConnectionRef.current = pc;
    
    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        console.log(`🎤 Adding local ${track.kind} track to PC`);
        pc.addTrack(track, localStreamRef.current);
      });
    }
    
    // Handle remote tracks
    const remoteStream = new MediaStream();
    setRemoteStream(remoteStream);
    
    pc.ontrack = (event) => {
      console.log('📹 Received remote track:', event.track.kind);
      remoteStream.addTrack(event.track);
      setRemoteStream(new MediaStream(remoteStream.getTracks()));
    };
    
    // ICE candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 Generated ICE candidate');
        sendIceCandidate(event.candidate);
      }
    };
    
    // Connection state
    pc.oniceconnectionstatechange = () => {
      console.log('🧊 ICE connection state:', pc.iceConnectionState);
      setConnectionStatus(pc.iceConnectionState);
    };
    
    pc.onsignalingstatechange = () => {
      console.log('📡 Signaling state:', pc.signalingState);
    };
    
    pc.onconnectionstatechange = () => {
      console.log('🔌 Connection state:', pc.connectionState);
    };
    
    return pc;
  }, []);

  // Send ICE candidate to Firestore
  const sendIceCandidate = useCallback(async (candidate) => {
    if (!roomIdRef.current || !user) return;
    
    try {
      const collectionName = isCallerRef.current ? 'offerCandidates' : 'answerCandidates';
      const candidatesRef = collection(db, 'rooms', roomIdRef.current, collectionName);
      
      await addDoc(candidatesRef, {
        candidate: candidate.toJSON(),
        senderId: user.uid,
        senderName: user.displayName,
        timestamp: serverTimestamp()
      });
      
      console.log('✅ ICE candidate sent');
    } catch (error) {
      console.error('❌ Error sending ICE candidate:', error);
    }
  }, [user]);

  // Create offer (caller)
  const createOffer = useCallback(async () => {
    if (!currentRoom?.id || !user) return;
    
    console.log('📤 Creating offer as caller');
    isCallerRef.current = true;
    roomIdRef.current = currentRoom.id;
    
    const pc = createPeerConnection();
    setConnectionStatus('creating-offer');
    
    try {
      // Create offer
      const offerDescription = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await pc.setLocalDescription(offerDescription);
      console.log('✅ Offer created:', offerDescription.type);
      
      // Save offer to Firestore
      const roomRef = doc(db, 'rooms', currentRoom.id);
      await setDoc(roomRef, {
        offer: {
          sdp: offerDescription.sdp,
          type: offerDescription.type
        },
        callerId: user.uid,
        callerName: user.displayName,
        createdAt: serverTimestamp()
      }, { merge: true });
      
      console.log('✅ Offer saved to Firestore');
      
      // Listen for answer
      const unsubscribe = onSnapshot(roomRef, async (snapshot) => {
        if (!snapshot.exists()) return;
        
        const data = snapshot.data();
        if (data.answer && !pc.currentRemoteDescription) {
          console.log('📩 Received answer from remote peer');
          const answerDescription = new RTCSessionDescription(data.answer);
          await pc.setRemoteDescription(answerDescription);
          console.log('✅ Remote description set');
        }
      });
      
      // Listen for answer candidates
      const answerCandidatesRef = collection(db, 'rooms', currentRoom.id, 'answerCandidates');
      const candidatesUnsubscribe = onSnapshot(answerCandidatesRef, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            console.log('🧊 Received answer candidate');
            
            try {
              await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
              
              // Get remote user info
              if (data.senderId !== user.uid) {
                setRemoteUser({
                  id: data.senderId,
                  name: data.senderName
                });
              }
              
              // Clean up candidate
              await deleteDoc(change.doc.ref);
            } catch (error) {
              console.error('Error adding answer candidate:', error);
            }
          }
        });
      });
      
      return () => {
        unsubscribe();
        candidatesUnsubscribe();
      };
      
    } catch (error) {
      console.error('❌ Error creating offer:', error);
      setConnectionStatus('error');
    }
  }, [currentRoom?.id, user, createPeerConnection]);

  // Create answer (callee)
  const createAnswer = useCallback(async () => {
    if (!currentRoom?.id || !user) return;
    
    console.log('📤 Creating answer as callee');
    isCallerRef.current = false;
    roomIdRef.current = currentRoom.id;
    
    const pc = createPeerConnection();
    setConnectionStatus('creating-answer');
    
    try {
      const roomRef = doc(db, 'rooms', currentRoom.id);
      const roomSnap = await getDoc(roomRef);
      
      if (!roomSnap.exists()) {
        throw new Error('Room not found');
      }
      
      const roomData = roomSnap.data();
      if (!roomData.offer) {
        throw new Error('No offer found in room');
      }
      
      console.log('📩 Received offer from caller:', roomData.callerName);
      setRemoteUser({
        id: roomData.callerId,
        name: roomData.callerName
      });
      
      // Set remote description
      const offerDescription = new RTCSessionDescription(roomData.offer);
      await pc.setRemoteDescription(offerDescription);
      console.log('✅ Remote description set');
      
      // Create answer
      const answerDescription = await pc.createAnswer();
      await pc.setLocalDescription(answerDescription);
      console.log('✅ Answer created');
      
      // Save answer to Firestore
      await updateDoc(roomRef, {
        answer: {
          sdp: answerDescription.sdp,
          type: answerDescription.type
        },
        calleeId: user.uid,
        calleeName: user.displayName,
        answeredAt: serverTimestamp()
      });
      
      console.log('✅ Answer saved to Firestore');
      
      // Listen for offer candidates
      const offerCandidatesRef = collection(db, 'rooms', currentRoom.id, 'offerCandidates');
      const candidatesUnsubscribe = onSnapshot(offerCandidatesRef, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            console.log('🧊 Received offer candidate');
            
            try {
              await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
              
              // Clean up candidate
              await deleteDoc(change.doc.ref);
            } catch (error) {
              console.error('Error adding offer candidate:', error);
            }
          }
        });
      });
      
      return () => {
        candidatesUnsubscribe();
      };
      
    } catch (error) {
      console.error('❌ Error creating answer:', error);
      setConnectionStatus('error');
    }
  }, [currentRoom?.id, user, createPeerConnection]);

  // Clean up
  const cleanup = useCallback(() => {
    console.log('🧹 Cleaning up peer connection');
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    setRemoteStream(null);
    setRemoteUser(null);
    setConnectionStatus('disconnected');
    isCallerRef.current = false;
    roomIdRef.current = null;
  }, []);

  // Hang up call
  const hangUp = useCallback(async () => {
    cleanup();
    
    if (currentRoom?.id) {
      try {
        // Clean up Firestore data
        const roomRef = doc(db, 'rooms', currentRoom.id);
        
        // Delete candidates collections
        const offerCandidatesRef = collection(db, 'rooms', currentRoom.id, 'offerCandidates');
        const offerSnapshot = await getDocs(offerCandidatesRef);
        offerSnapshot.docs.forEach(async (doc) => {
          await deleteDoc(doc.ref);
        });
        
        const answerCandidatesRef = collection(db, 'rooms', currentRoom.id, 'answerCandidates');
        const answerSnapshot = await getDocs(answerCandidatesRef);
        answerSnapshot.docs.forEach(async (doc) => {
          await deleteDoc(doc.ref);
        });
        
        // Clear offer/answer from room document
        await updateDoc(roomRef, {
          offer: null,
          answer: null,
          callerId: null,
          calleeId: null
        });
        
        console.log('✅ Call data cleaned up');
      } catch (error) {
        console.error('Error cleaning up call data:', error);
      }
    }
  }, [currentRoom?.id, cleanup]);

  // Initialize call based on role
  useEffect(() => {
    if (!currentRoom?.id || !user || !localStream) return;
    
    console.log('🚀 Initializing call for room:', currentRoom.id);
    console.log('User:', user.uid, user.displayName);
    console.log('Room host:', currentRoom.hostId);
    
    // Update local stream reference
    localStreamRef.current = localStream;
    
    // Determine if user is the host (caller) or joiner (callee)
    const isHost = currentRoom.hostId === user.uid;
    console.log(`User is ${isHost ? 'host (caller)' : 'joiner (callee)'}`);
    
    // Wait a bit for other participant
    const timer = setTimeout(() => {
      if (isHost) {
        console.log('🎯 Host will create offer');
        createOffer();
      } else {
        console.log('🎯 Joiner will create answer');
        createAnswer();
      }
    }, 2000);
    
    return () => {
      clearTimeout(timer);
      hangUp();
    };
  }, [currentRoom?.id, user, localStream, createOffer, createAnswer, hangUp]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const value = {
    remoteStream,
    remoteUser,
    connectionStatus,
    hangUp,
    cleanup,
    // For debugging
    getPeerConnection: () => peerConnectionRef.current
  };

  return (
    <PeerContext.Provider value={value}>
      {children}
    </PeerContext.Provider>
  );
};