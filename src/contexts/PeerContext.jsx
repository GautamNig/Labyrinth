// contexts/PeerContext.jsx - UPDATED VERSION
import React, { createContext, useContext, useRef, useCallback, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { useMedia } from './MediaContext';
import { useRoom } from './RoomContext';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  deleteDoc,
  onSnapshot,
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
  
  const [peers, setPeers] = useState({});
  const [connectionStatus, setConnectionStatus] = useState('idle');
  const [activeConnections, setActiveConnections] = useState(0);
  
  const peerConnectionsRef = useRef({});
  const localStreamRef = useRef(null);
  const cleanupFunctionsRef = useRef([]);

  // STUN servers configuration
  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { 
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      { 
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ]
  };

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('🧹 Cleaning up peer connections');
    
    Object.values(peerConnectionsRef.current).forEach(pc => {
      if (pc && pc.signalingState !== 'closed') {
        pc.close();
      }
    });
    
    peerConnectionsRef.current = {};
    
    cleanupFunctionsRef.current.forEach(fn => fn());
    cleanupFunctionsRef.current = [];
    
    setPeers({});
    setConnectionStatus('idle');
    setActiveConnections(0);
    
    console.log('✅ Peer cleanup complete');
  }, []);

  // Initialize signaling for a room
  const initializeSignaling = useCallback(async (roomId) => {
    if (!user || !roomId) return;
    
    console.log('📡 Initializing signaling for room:', roomId);
    
    try {
      const signalingDocRef = doc(db, 'rooms', roomId, 'signaling', user.uid);
      
      await setDoc(signalingDocRef, {
        userId: user.uid,
        userName: user.displayName,
        isOnline: true,
        lastSeen: serverTimestamp(),
        status: 'online',
        readyForConnection: true
      }, { merge: true });
      
      console.log('✅ Signaling document created/updated for user:', user.uid);
      
    } catch (error) {
      console.error('❌ Error creating signaling document:', error);
    }
  }, [user]);

  // Create a peer connection with proper event handlers
  const createPeerConnection = useCallback((remoteUserId, remoteUserData) => {
    console.log('🔗 Creating peer connection to:', remoteUserId);
    
    try {
      const pc = new RTCPeerConnection(iceServers);
      peerConnectionsRef.current[remoteUserId] = pc;
      
      // Add local stream tracks if available
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current);
        });
      }
      
      // Handle remote stream
      pc.ontrack = (event) => {
        console.log('📹 Received remote track from:', remoteUserId);
        
        const remoteStream = event.streams[0];
        if (remoteStream) {
          setPeers(prev => ({
            ...prev,
            [remoteUserId]: {
              ...prev[remoteUserId],
              stream: remoteStream,
              connectionState: pc.connectionState || 'connected',
              userData: remoteUserData
            }
          }));
        }
      };
      
      // ICE candidate handler
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('🧊 New ICE candidate for:', remoteUserId);
          sendICECandidate(remoteUserId, event.candidate);
        }
      };
      
      // ICE gathering state
      pc.onicegatheringstatechange = () => {
        console.log(`🧊 ICE gathering state for ${remoteUserId}:`, pc.iceGatheringState);
      };
      
      // Connection state changes
      pc.onconnectionstatechange = () => {
        console.log(`🔌 Connection state with ${remoteUserId}:`, pc.connectionState);
        
        setPeers(prev => ({
          ...prev,
          [remoteUserId]: {
            ...prev[remoteUserId],
            connectionState: pc.connectionState
          }
        }));
        
        if (pc.connectionState === 'connected') {
          console.log(`✅ Connected to ${remoteUserId}`);
          setConnectionStatus('connected');
        } else if (pc.connectionState === 'disconnected' || 
                   pc.connectionState === 'failed' || 
                   pc.connectionState === 'closed') {
          console.log(`❌ Connection lost with ${remoteUserId}`);
          
          if (peerConnectionsRef.current[remoteUserId]) {
            peerConnectionsRef.current[remoteUserId].close();
            delete peerConnectionsRef.current[remoteUserId];
          }
          
          setPeers(prev => {
            const newPeers = { ...prev };
            delete newPeers[remoteUserId];
            return newPeers;
          });
        }
      };
      
      // ICE connection state
      pc.oniceconnectionstatechange = () => {
        console.log(`🧊 ICE connection state with ${remoteUserId}:`, pc.iceConnectionState);
        
        if (pc.iceConnectionState === 'failed') {
          console.log(`❌ ICE connection failed for ${remoteUserId}, restarting ICE`);
          // Try to restart ICE
          setTimeout(() => {
            if (pc.iceConnectionState === 'failed') {
              pc.restartIce();
            }
          }, 1000);
        }
      };
      
      // Signaling state
      pc.onsignalingstatechange = () => {
        console.log(`📡 Signaling state with ${remoteUserId}:`, pc.signalingState);
      };
      
      console.log('✅ Peer connection created for:', remoteUserId);
      return pc;
      
    } catch (error) {
      console.error('❌ Error creating peer connection:', error);
      return null;
    }
  }, []);

  // Send ICE candidate
  const sendICECandidate = useCallback(async (remoteUserId, candidate) => {
    if (!currentRoom?.id || !user) return;
    
    try {
      const candidateDocRef = doc(
        db, 
        'rooms', 
        currentRoom.id, 
        'signaling', 
        remoteUserId,
        'candidates',
        `${Date.now()}_${user.uid}`
      );
      
      await setDoc(candidateDocRef, {
        to: remoteUserId,
        from: user.uid,
        candidate: JSON.stringify(candidate.toJSON()),
        timestamp: serverTimestamp(),
        type: 'candidate'
      });
      
      console.log('✅ ICE candidate sent to:', remoteUserId);
    } catch (error) {
      console.error('❌ Error sending ICE candidate:', error);
    }
  }, [currentRoom?.id, user]);

  // Send SDP offer
  const sendOffer = useCallback(async (remoteUserId, offer) => {
    if (!currentRoom?.id || !user) return;
    
    console.log('📤 Sending offer to user:', remoteUserId);
    
    try {
      const offerDocRef = doc(
        db,
        'rooms',
        currentRoom.id,
        'signaling',
        remoteUserId,
        'offers',
        `${Date.now()}_${user.uid}`
      );
      
      await setDoc(offerDocRef, {
        sdp: JSON.stringify(offer),
        from: user.uid,
        fromName: user.displayName,
        to: remoteUserId,
        timestamp: serverTimestamp(),
        type: 'offer'
      });
      
      console.log('✅ Offer saved to Firestore at path:', offerDocRef.path);
      
    } catch (error) {
      console.error('❌ Error sending offer:', error);
    }
  }, [currentRoom?.id, user]);

  // Send SDP answer
  const sendAnswer = useCallback(async (remoteUserId, answer) => {
    if (!currentRoom?.id || !user) return;
    
    console.log('📤 Sending answer to user:', remoteUserId);
    
    try {
      const answerDocRef = doc(
        db,
        'rooms',
        currentRoom.id,
        'signaling',
        remoteUserId,
        'answers',
        `${Date.now()}_${user.uid}`
      );
      
      await setDoc(answerDocRef, {
        sdp: JSON.stringify(answer),
        from: user.uid,
        fromName: user.displayName,
        to: remoteUserId,
        timestamp: serverTimestamp(),
        type: 'answer'
      });
      
      console.log('✅ Answer saved to Firestore at path:', answerDocRef.path);
      
    } catch (error) {
      console.error('❌ Error sending answer:', error);
    }
  }, [currentRoom?.id, user]);

  // Handle incoming offer - FIXED VERSION
  const handleIncomingOffer = useCallback(async (remoteUserId, offer) => {
    console.log('🎯 handleIncomingOffer called for:', remoteUserId);
    console.log('   Offer type:', offer?.type);
    
    try {
      let pc = peerConnectionsRef.current[remoteUserId];
      if (!pc) {
        console.log('   Creating new peer connection...');
        const remoteUserData = { 
          id: remoteUserId, 
          name: offer.fromName || 'Remote User' 
        };
        pc = createPeerConnection(remoteUserId, remoteUserData);
        if (!pc) {
          console.error('   ❌ Failed to create peer connection');
          return;
        }
      }
      
      console.log('   Setting remote description...');
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('   ✅ Remote description set');
      
      console.log('   Creating answer...');
      const answer = await pc.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      console.log('   Answer created:', answer.type);
      
      console.log('   Setting local description...');
      await pc.setLocalDescription(answer);
      console.log('   ✅ Local description set');
      
      console.log('   Sending answer to:', remoteUserId);
      await sendAnswer(remoteUserId, answer);
      console.log('   ✅ Answer sent');
      
      // Set up initial peer state
      setPeers(prev => ({
        ...prev,
        [remoteUserId]: {
          ...prev[remoteUserId],
          connectionState: pc.connectionState,
          userData: { id: remoteUserId, name: offer.fromName || 'Remote User' }
        }
      }));
      
    } catch (error) {
      console.error('❌ Error in handleIncomingOffer:', error);
    }
  }, [createPeerConnection, sendAnswer]);

  // Handle incoming answer
  const handleIncomingAnswer = useCallback(async (remoteUserId, answer) => {
    console.log('🎯 Handling incoming answer from:', remoteUserId);
    
    const pc = peerConnectionsRef.current[remoteUserId];
    if (!pc) {
      console.error('❌ No peer connection found for:', remoteUserId);
      return;
    }
    
    try {
      const remoteDesc = new RTCSessionDescription(answer);
      await pc.setRemoteDescription(remoteDesc);
      console.log('✅ Remote description set for:', remoteUserId);
    } catch (error) {
      console.error('❌ Error setting remote description:', error);
    }
  }, []);

  // Handle incoming ICE candidate
  const handleIncomingICECandidate = useCallback(async (remoteUserId, candidate) => {
    console.log('🧊 Handling incoming ICE candidate from:', remoteUserId);
    
    const pc = peerConnectionsRef.current[remoteUserId];
    if (!pc) {
      console.error('❌ No peer connection found for ICE candidate:', remoteUserId);
      return;
    }
    
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('✅ ICE candidate added for:', remoteUserId);
    } catch (error) {
      console.error('❌ Error adding ICE candidate:', error);
    }
  }, []);

  // Connect to a specific user
  const connectToUser = useCallback(async (remoteUserId, remoteUserData) => {
    if (!user || user.uid === remoteUserId) return;
    
    console.log('🤝 Connecting to user:', remoteUserId);
    setConnectionStatus('connecting');
    
    // Check if already connected
    if (peerConnectionsRef.current[remoteUserId]) {
      console.log('⚠️ Already connected to:', remoteUserId);
      return;
    }
    
    try {
      const pc = createPeerConnection(remoteUserId, remoteUserData);
      if (!pc) {
        throw new Error('Failed to create peer connection');
      }
      
      // Create offer
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      await pc.setLocalDescription(offer);
      await sendOffer(remoteUserId, offer);
      
      console.log('✅ Offer created and sent to:', remoteUserId);
      
      // Set initial peer state
      setPeers(prev => ({
        ...prev,
        [remoteUserId]: {
          connectionState: 'connecting',
          userData: remoteUserData
        }
      }));
      
    } catch (error) {
      console.error('❌ Error connecting to user:', error);
      setConnectionStatus('error');
    }
  }, [user, createPeerConnection, sendOffer]);

  // ========== USE EFFECTS ==========

  // Keep localStreamRef updated
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // Initialize signaling when room is ready
  useEffect(() => {
    if (currentRoom?.id && user) {
      console.log('📡 Initializing signaling for room:', currentRoom.id);
      initializeSignaling(currentRoom.id);
    }
  }, [currentRoom?.id, user, initializeSignaling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Offer listener
  useEffect(() => {
    if (!currentRoom?.id || !user) return;
    
    console.log('👂 Setting up offer listener for user:', user.uid);
    
    const offersRef = collection(
      db, 
      'rooms', 
      currentRoom.id, 
      'signaling', 
      user.uid,
      'offers'
    );
    
    const offersUnsubscribe = onSnapshot(offersRef, 
      (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const offerData = change.doc.data();
            console.log('📨 NEW OFFER RECEIVED from:', offerData.from);
            
            try {
              const offer = JSON.parse(offerData.sdp);
              await handleIncomingOffer(offerData.from, offer);
              
              // Clean up the offer document
              await deleteDoc(change.doc.ref);
              console.log('✅ Offer processed and cleaned up');
              
            } catch (error) {
              console.error('❌ Error processing offer:', error);
            }
          }
        });
      },
      (error) => {
        console.error('❌ Error in offer listener:', error);
      }
    );
    
    cleanupFunctionsRef.current.push(offersUnsubscribe);
    
    return () => {
      offersUnsubscribe();
    };
  }, [currentRoom?.id, user, handleIncomingOffer]);

  // Answer listener
  useEffect(() => {
    if (!currentRoom?.id || !user) return;
    
    console.log('👂 Setting up answer listener');
    
    const answersRef = collection(
      db, 
      'rooms', 
      currentRoom.id, 
      'signaling', 
      user.uid,
      'answers'
    );
    
    const answersUnsubscribe = onSnapshot(answersRef, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const answerData = change.doc.data();
          console.log('📨 Received answer from:', answerData.from);
          
          try {
            await handleIncomingAnswer(answerData.from, JSON.parse(answerData.sdp));
            await deleteDoc(change.doc.ref);
          } catch (error) {
            console.error('❌ Error processing answer:', error);
          }
        }
      });
    });
    
    cleanupFunctionsRef.current.push(answersUnsubscribe);
    
    return () => {
      answersUnsubscribe();
    };
  }, [currentRoom?.id, user, handleIncomingAnswer]);

  // ICE candidate listener
  useEffect(() => {
    if (!currentRoom?.id || !user) return;
    
    console.log('👂 Setting up ICE candidate listener');
    
    const candidatesRef = collection(
      db, 
      'rooms', 
      currentRoom.id, 
      'signaling', 
      user.uid,
      'candidates'
    );
    
    const candidatesUnsubscribe = onSnapshot(candidatesRef, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const candidateData = change.doc.data();
          console.log('🧊 Received ICE candidate from:', candidateData.from);
          
          try {
            await handleIncomingICECandidate(
              candidateData.from, 
              JSON.parse(candidateData.candidate)
            );
            await deleteDoc(change.doc.ref);
          } catch (error) {
            console.error('❌ Error processing ICE candidate:', error);
          }
        }
      });
    });
    
    cleanupFunctionsRef.current.push(candidatesUnsubscribe);
    
    return () => {
      candidatesUnsubscribe();
    };
  }, [currentRoom?.id, user, handleIncomingICECandidate]);

  // Participants listener - UPDATED to handle both host and joiner logic
  useEffect(() => {
  if (!currentRoom?.id || !user) return;
  
  console.log('👥 HOST/JOINER - Setting up participants listener');
  console.log('   My ID:', user.uid);
  console.log('   Room Host ID:', currentRoom.hostId);
  console.log('   Am I host?', currentRoom.hostId === user.uid);
  
  const participantsRef = collection(db, 'rooms', currentRoom.id, 'participants');
  
  const unsubscribe = onSnapshot(participantsRef, (snapshot) => {
    const participants = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log('📊 Current participants:', participants.map(p => `${p.name} (${p.id})`));
    
    // Filter out self
    const otherParticipants = participants.filter(p => p.id !== user.uid);
    console.log('   Other participants:', otherParticipants.length);
    
    // If I'm the HOST
    if (currentRoom.hostId === user.uid) {
      console.log(`👑 I AM THE HOST - connecting to ${otherParticipants.length} other participants`);
      
      otherParticipants.forEach(participant => {
        // Check if we already have a connection
        if (!peerConnectionsRef.current[participant.id]) {
          console.log(`   🟡 Creating connection to: ${participant.name} (${participant.id})`);
          
          // Delay to avoid race conditions
          setTimeout(() => {
            connectToUser(participant.id, {
              name: participant.name,
              photoURL: participant.photoURL
            });
          }, 1000);
        } else {
          const pc = peerConnectionsRef.current[participant.id];
          console.log(`   ${pc.connectionState === 'connected' ? '✅' : '🔄'} Already connected to ${participant.name}: ${pc.connectionState}`);
        }
      });
    }
    // If I'm a JOINER
    else {
      console.log(`👤 I AM A JOINER - connecting to host only`);
      
      const host = participants.find(p => p.isHost);
      if (host && host.id !== user.uid) {
        if (!peerConnectionsRef.current[host.id]) {
          console.log(`   🟡 Connecting to host: ${host.name} (${host.id})`);
          
          setTimeout(() => {
            connectToUser(host.id, {
              name: host.name,
              photoURL: host.photoURL
            });
          }, 1000);
        }
      }
    }
  });
  
  cleanupFunctionsRef.current.push(unsubscribe);
  
  return () => {
    unsubscribe();
  };
}, [currentRoom, user, connectToUser]);

  // Update active connections count
  useEffect(() => {
    const count = Object.keys(peers).length;
    setActiveConnections(count);
    
    if (count > 0 && connectionStatus !== 'connected') {
      setConnectionStatus('connected');
    }
  }, [peers, connectionStatus]);

  // Auto-cleanup stale connections
  useEffect(() => {
    const interval = setInterval(() => {
      Object.entries(peerConnectionsRef.current).forEach(([userId, pc]) => {
        if (pc && (pc.connectionState === 'disconnected' || 
                   pc.connectionState === 'failed' || 
                   pc.connectionState === 'closed')) {
          console.log(`🧹 Cleaning up stale connection to ${userId}`);
          pc.close();
          delete peerConnectionsRef.current[userId];
          
          setPeers(prev => {
            const newPeers = { ...prev };
            delete newPeers[userId];
            return newPeers;
          });
        }
      });
    }, 10000); // Check every 10 seconds
    
    return () => clearInterval(interval);
  }, []);

  const value = {
    peers,
    connectionStatus,
    activeConnections,
    connectToUser,
    cleanup
  };

  return (
    <PeerContext.Provider value={value}>
      {children}
    </PeerContext.Provider>
  );
};