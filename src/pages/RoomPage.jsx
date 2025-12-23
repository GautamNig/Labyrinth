// pages/RoomPage.jsx - COMPLETE UPDATED VERSION
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePeer } from '../contexts/PeerContext';
import ConnectionDebug from '../components/ConnectionDebug';
import RemoteVideo from '../components/RemoteVideo';

import {
  getRoom,
  getRoomParticipants,
  joinRoom as joinRoomService,
  listenToRoom,
  listenToParticipants,
  debugRoomState
} from '../services/roomService';
import { useMedia } from '../contexts/MediaContext';
import { useRoom } from '../contexts/RoomContext';
import LocalVideoPreview from '../components/LocalVideoPreview';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const RoomPage = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setCurrentRoom } = useRoom();

  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joinAttempted, setJoinAttempted] = useState(false);
  const { peers, connectionStatus, activeConnections, initializeUserSignaling, connectToUser } = usePeer();
  const {
    localStream,
    isCameraOn,
    isMicOn,
    toggleCamera,
    toggleMicrophone,
    isLoading: mediaLoading,
    error: mediaError
  } = useMedia();

  // Debug function to check Firestore structure
  const debugFirestoreStructure = async () => {
    console.clear();
    console.log('🔍 === COMPLETE FIRESTORE DEBUG === 🔍');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Current user:', user?.uid);
    console.log('Room ID:', roomId);
    
    try {
      // 1. Get the specific room
      console.log('\n📁 === CURRENT ROOM DATA ===');
      const roomRef = doc(db, 'rooms', roomId);
      const roomSnap = await getDoc(roomRef);
      
      if (!roomSnap.exists()) {
        console.log('❌ Room not found in Firestore');
        return;
      }
      
      const roomData = roomSnap.data();
      console.log('📋 Room Document:', {
        id: roomId,
        name: roomData.name,
        hostId: roomData.hostId,
        hostName: roomData.hostName,
        roomCode: roomData.roomCode,
        currentParticipants: roomData.currentParticipants,
        maxParticipants: roomData.maxParticipants,
        status: roomData.status,
        isActive: roomData.isActive,
        createdAt: roomData.createdAt?.toDate?.() || roomData.createdAt,
        lastActivity: roomData.lastActivity?.toDate?.() || roomData.lastActivity
      });
      
      // 2. Get participants
      console.log('\n👥 === PARTICIPANTS ===');
      const participantsRef = collection(db, 'rooms', roomId, 'participants');
      const participantsSnapshot = await getDocs(participantsRef);
      
      console.log(`Total participants in DB: ${participantsSnapshot.docs.length}`);
      console.log(`Room shows: ${roomData.currentParticipants}/${roomData.maxParticipants}`);
      
      participantsSnapshot.docs.forEach(participantDoc => {
        const participantData = participantDoc.data();
        console.log(`- ${participantData.name} (${participantDoc.id})`, {
          isHost: participantData.isHost,
          isActive: participantData.isActive,
          joinedAt: participantData.joinedAt?.toDate?.() || participantData.joinedAt,
          email: participantData.email,
          isCurrentUser: participantDoc.id === user?.uid
        });
      });
      
      // 3. Check if current user is in participants
      const isUserInParticipants = participantsSnapshot.docs.some(doc => doc.id === user?.uid);
      console.log(`\n✅ Current user in participants? ${isUserInParticipants ? 'YES' : 'NO'}`);
      
      // 4. Get signaling data
      console.log('\n📡 === SIGNALING DATA ===');
      const signalingRef = collection(db, 'rooms', roomId, 'signaling');
      const signalingSnapshot = await getDocs(signalingRef);
      
      console.log(`Signaling users: ${signalingSnapshot.docs.length}`);
      
      for (const signalingDoc of signalingSnapshot.docs) {
        const userId = signalingDoc.id;
        const signalingData = signalingDoc.data();
        
        console.log(`\n👤 User: ${userId} (${signalingData.userName || 'No name'})`);
        console.log('  📄 Signaling Document:', {
          isOnline: signalingData.isOnline,
          readyForConnection: signalingData.readyForConnection,
          status: signalingData.status,
          lastSeen: signalingData.lastSeen?.toDate?.() || signalingData.lastSeen
        });
        
        // Check offers
        const offersRef = collection(db, 'rooms', roomId, 'signaling', userId, 'offers');
        const offersSnapshot = await getDocs(offersRef);
        console.log(`  📨 Offers TO this user: ${offersSnapshot.docs.length}`);
        offersSnapshot.docs.forEach(offerDoc => {
          const offerData = offerDoc.data();
          console.log(`    → From: ${offerData.from} (${offerData.fromName}) to: ${offerData.to}`, {
            type: offerData.type,
            timestamp: offerData.timestamp?.toDate?.() || offerData.timestamp,
            docId: offerDoc.id
          });
        });
        
        // Check answers
        const answersRef = collection(db, 'rooms', roomId, 'signaling', userId, 'answers');
        const answersSnapshot = await getDocs(answersRef);
        console.log(`  📩 Answers TO this user: ${answersSnapshot.docs.length}`);
        answersSnapshot.docs.forEach(answerDoc => {
          const answerData = answerDoc.data();
          console.log(`    → From: ${answerData.from} to: ${answerData.to}`);
        });
        
        // Check candidates
        const candidatesRef = collection(db, 'rooms', roomId, 'signaling', userId, 'candidates');
        const candidatesSnapshot = await getDocs(candidatesRef);
        console.log(`  🧊 ICE Candidates TO this user: ${candidatesSnapshot.docs.length}`);
      }
      
      // 5. Summary
      console.log('\n📊 === SUMMARY ===');
      console.log(`Room: ${roomData.name} (${roomId})`);
      console.log(`Host: ${roomData.hostName} (${roomData.hostId})`);
      console.log(`Capacity: ${roomData.currentParticipants}/${roomData.maxParticipants}`);
      console.log(`Current user ${user?.uid} is ${isUserInParticipants ? 'IN' : 'NOT IN'} room`);
      console.log(`UI shows error: "${error}"`);
      console.log(`UI loading state: ${loading}`);
      
    } catch (error) {
      console.error('❌ Debug error:', error);
    }
  };

  // Real-time room updates
  useEffect(() => {
    if (!roomId || !user) return;

    console.log('🎯 Setting up real-time listeners for room:', roomId);

    const unsubscribeRoom = listenToRoom(roomId, (roomData) => {
      console.log('📡 Room real-time update:', roomData);
      if (roomData) {
        setRoom(roomData);
        setCurrentRoom(roomData); // Update RoomContext
        
        // Clear error if room is now valid
        if (error && roomData.isActive && roomData.currentParticipants <= roomData.maxParticipants) {
          setError('');
        }
      } else {
        setError('Room was deleted');
      }
    });

    const unsubscribeParticipants = listenToParticipants(roomId, (participantsData) => {
      console.log('👥 Participants real-time update:', participantsData);
      setParticipants(participantsData);
      
      // Check if current user is in participants
      const isUserInRoom = participantsData.some(p => p.id === user.uid);
      console.log('Current user in room?', isUserInRoom);
      
      // If user is in room but UI shows error, clear it
      if (isUserInRoom && error.includes('Room is full')) {
        console.log('✅ User is in room, clearing "room is full" error');
        setError('');
      }
    });

    // Cleanup
    return () => {
      console.log('🧹 Cleaning up real-time listeners');
      unsubscribeRoom();
      unsubscribeParticipants();
    };
  }, [roomId, user, error, setCurrentRoom]);

  // Initial load - FIXED VERSION
  const loadRoom = useCallback(async () => {
    if (!user || !roomId || joinAttempted) {
      return;
    }
    
    setLoading(true);
    setError('');
    setJoinAttempted(true);
    
    console.log('=== LOAD ROOM START ===');
    console.log('User:', user.uid, user.displayName);
    console.log('Room ID:', roomId);

    try {
      // Get fresh room data
      const roomData = await getRoom(roomId);
      console.log('Room data from service:', roomData);
      
      if (!roomData) {
        setError('Room not found');
        setLoading(false);
        return;
      }

      if (!roomData.isActive || roomData.status === 'ended') {
        setError('Room is no longer active');
        setLoading(false);
        return;
      }

      // Get participants
      const participantsData = await getRoomParticipants(roomId);
      console.log('Participants from service:', participantsData);
      console.log('Participant IDs:', participantsData.map(p => p.id));

      // Check if user is already in room
      const isUserInRoom = participantsData.some(p => p.id === user.uid);
      console.log('Is user already in room?', isUserInRoom);

      // Set initial state
      setRoom(roomData);
      setParticipants(participantsData);
      setCurrentRoom(roomData);

      // If user is already in room, stop here
      if (isUserInRoom) {
        console.log('✅ User already in room, loading complete');
        setLoading(false);
        
        // Initialize signaling for peer connections
        setTimeout(() => {
          initializeUserSignaling?.();
        }, 1000);
        return;
      }

      // Check if room appears full in UI data
      const isRoomFull = participantsData.length >= roomData.maxParticipants;
      console.log('Is room full?', isRoomFull, `(${participantsData.length}/${roomData.maxParticipants})`);

      // Double check with fresh data from Firestore
      const roomRef = doc(db, 'rooms', roomId);
      const freshRoomSnap = await getDoc(roomRef);
      const freshRoomData = freshRoomSnap.data();
      const freshParticipantsRef = collection(db, 'rooms', roomId, 'participants');
      const freshParticipantsSnap = await getDocs(freshParticipantsRef);
      const actualParticipantCount = freshParticipantsSnap.docs.length;
      
      console.log('Fresh check - Room capacity:', freshRoomData?.currentParticipants, '/', freshRoomData?.maxParticipants);
      console.log('Fresh check - Actual participants:', actualParticipantCount);
      console.log('Fresh check - User in fresh participants?', freshParticipantsSnap.docs.some(doc => doc.id === user.uid));

      // If room is actually full, show error
      if (actualParticipantCount >= roomData.maxParticipants) {
        console.log('❌ Room is actually full, cannot join');
        setError(`Room is full (${actualParticipantCount}/${roomData.maxParticipants} participants)`);
        setLoading(false);
        return;
      }

      // Room has space - try to join
      console.log('🔄 Attempting to join room...');
      try {
        const joinResult = await joinRoomService(roomId, user);
        console.log('Join result:', joinResult);

        // Wait a bit for Firestore to update
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Get updated data
        const updatedRoom = await getRoom(roomId);
        const updatedParticipants = await getRoomParticipants(roomId);
        
        console.log('After join - Room:', updatedRoom);
        console.log('After join - Participants:', updatedParticipants);

        setRoom(updatedRoom);
        setParticipants(updatedParticipants);
        setCurrentRoom(updatedRoom);

        // Check if user is now in room
        const userNowInRoom = updatedParticipants.some(p => p.id === user.uid);
        console.log('User now in room?', userNowInRoom);

        if (!userNowInRoom) {
          // Final check with fresh Firestore data
          const finalCheck = await getDocs(collection(db, 'rooms', roomId, 'participants'));
          const finalUserInRoom = finalCheck.docs.some(doc => doc.id === user.uid);
          
          if (finalUserInRoom) {
            console.log('✅ Race condition resolved - user IS in room');
            // User is actually in room, update state
            const finalParticipants = finalCheck.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            setParticipants(finalParticipants);
          } else {
            console.log('❌ User still not in room after join attempt');
            setError('Failed to join room. Please try again.');
          }
        } else {
          // Success! Initialize signaling
          console.log('✅ Successfully joined room, initializing signaling...');
          setTimeout(() => {
            initializeUserSignaling?.();
          }, 1500);
        }

      } catch (joinError) {
        console.error('Join error:', joinError);
        
        // Check current state
        const currentParticipants = await getRoomParticipants(roomId);
        const userNowInRoom = currentParticipants.some(p => p.id === user.uid);
        
        if (userNowInRoom) {
          console.log('✅ User actually joined despite error (race condition)');
          setParticipants(currentParticipants);
          setError('');
          
          // Initialize signaling
          setTimeout(() => {
            initializeUserSignaling?.();
          }, 1500);
        } else if (joinError.message.includes('full')) {
          setError('Room is now full. Please try another room.');
        } else {
          setError(`Failed to join: ${joinError.message}`);
        }
      }

    } catch (err) {
      console.error('Error in loadRoom:', err);
      setError(`Failed to load room: ${err.message}`);
    } finally {
      setLoading(false);
      console.log('=== LOAD ROOM END ===');
    }
  }, [user, roomId, joinAttempted, setCurrentRoom, initializeUserSignaling]);

  // Initial load on mount
  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }

    loadRoom();
  }, [user, navigate, loadRoom]);

  const leaveRoom = () => {
    // We'll implement proper leaveRoom in next user story
    navigate('/dashboard');
  };

  const copyRoomCode = () => {
    if (room?.roomCode) {
      navigator.clipboard.writeText(room.roomCode);
      alert(`Room code ${room.roomCode} copied to clipboard!`);
    }
  };

  const handleCopyInviteLink = () => {
    const inviteLink = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(inviteLink);
    alert(`Invite link copied to clipboard!\n\n${inviteLink}`);
  };

  // Force refresh room data
  const refreshRoomData = async () => {
    console.log('🔄 Manually refreshing room data...');
    setLoading(true);
    try {
      const freshRoom = await getRoom(roomId);
      const freshParticipants = await getRoomParticipants(roomId);
      
      setRoom(freshRoom);
      setParticipants(freshParticipants);
      setCurrentRoom(freshRoom);
      setError('');
      
      console.log('✅ Room data refreshed');
    } catch (err) {
      console.error('Error refreshing room:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkWebRTCConnections = () => {
  console.clear();
  console.log('🔍 === WEBRTC CONNECTION DEBUG ===');
  
  // Check if we have peer connections
  console.log('Peers object:', peers);
  
  Object.entries(peers).forEach(([peerId, peerData]) => {
    console.log(`\n👤 Peer: ${peerId} (${peerData.userData?.name})`);
    console.log('   Connection state:', peerData.connectionState);
    
    if (peerData.stream) {
      console.log('   Stream exists:', !!peerData.stream);
      console.log('   Stream active:', peerData.stream.active);
      console.log('   Stream id:', peerData.stream.id);
      
      const videoTracks = peerData.stream.getVideoTracks();
      const audioTracks = peerData.stream.getAudioTracks();
      
      console.log('   Video tracks:', videoTracks.length);
      console.log('   Audio tracks:', audioTracks.length);
      
      videoTracks.forEach((track, index) => {
        console.log(`   Video track ${index}:`, {
          enabled: track.enabled,
          readyState: track.readyState,
          muted: track.muted,
          kind: track.kind,
          label: track.label
        });
      });
      
      audioTracks.forEach((track, index) => {
        console.log(`   Audio track ${index}:`, {
          enabled: track.enabled,
          readyState: track.readyState,
          muted: track.muted,
          kind: track.kind,
          label: track.label
        });
      });
    } else {
      console.log('   ❌ No stream available');
    }
  });
  
  // Check if we can access RTCPeerConnection
  console.log('\n🌐 WebRTC Support:');
  console.log('   RTCPeerConnection:', typeof RTCPeerConnection !== 'undefined' ? '✅ Available' : '❌ Not available');
  console.log('   getUserMedia:', typeof navigator.mediaDevices?.getUserMedia !== 'undefined' ? '✅ Available' : '❌ Not available');
  
  // Check video elements
  console.log('\n🎥 Video Elements:');
  const videoElements = document.querySelectorAll('video');
  videoElements.forEach((video, index) => {
    console.log(`   Video ${index}:`, {
      srcObject: video.srcObject,
      readyState: video.readyState,
      error: video.error,
      paused: video.paused,
      muted: video.muted,
      isRemote: !video.muted
    });
  });
};

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={styles.loadingText}>Loading room...</p>
        <button 
          onClick={refreshRoomData}
          style={styles.refreshButton}
        >
          Force Refresh
        </button>
      </div>
    );
  }

  // Show room full error only if user is NOT in participants
  const isUserInRoom = participants.some(p => p.id === user?.uid);
  if (error && error.includes('full') && !isUserInRoom) {
    return (
      <div style={styles.fullRoomContainer}>
        <div style={styles.fullRoomContent}>
          <div style={styles.fullRoomIcon}>🚫</div>
          <h2 style={styles.fullRoomTitle}>Room Full</h2>
          <p style={styles.fullRoomMessage}>
            This room has reached its maximum capacity of {room?.maxParticipants} participants.
          </p>
          <div style={styles.fullRoomDetails}>
            <p><strong>Room:</strong> {room?.name}</p>
            <p><strong>Host:</strong> {room?.hostName}</p>
            <p><strong>Current Participants:</strong> {room?.currentParticipants}/{room?.maxParticipants}</p>
            <p><strong>You are in room?</strong> {isUserInRoom ? 'YES' : 'NO'}</p>
          </div>
          <div style={styles.debugInfo}>
            <button onClick={debugFirestoreStructure} style={styles.debugButton}>
              🔍 Debug Firestore
            </button>
            <button onClick={refreshRoomData} style={styles.debugButton}>
              🔄 Refresh Data
            </button>
          </div>
          <div style={styles.fullRoomActions}>
            <button
              onClick={() => navigate('/dashboard')}
              style={styles.fullRoomButton}
            >
              Back to Dashboard
            </button>
            {!isUserInRoom && (
              <button
                onClick={async () => {
                  console.log('🔄 Retrying join...');
                  setJoinAttempted(false);
                  await loadRoom();
                }}
                style={styles.fullRoomButtonSecondary}
              >
                Try Again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (error && !error.includes('full')) {
    return (
      <div style={styles.errorContainer}>
        <div style={styles.errorIcon}>⚠️</div>
        <h2 style={styles.errorTitle}>Room Unavailable</h2>
        <p style={styles.errorMessage}>{error}</p>
        <div style={styles.errorActions}>
          <button
            onClick={() => navigate('/dashboard')}
            style={styles.backButton}
          >
            Back to Dashboard
          </button>
          <button
            onClick={refreshRoomData}
            style={styles.refreshButton}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div style={styles.errorContainer}>
        <h2 style={styles.errorTitle}>Room Not Found</h2>
        <button
          onClick={() => navigate('/dashboard')}
          style={styles.backButton}
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Room Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <button
            onClick={() => navigate('/dashboard')}
            style={styles.backButton}
          >
            ← Back
          </button>
          <div style={styles.roomInfo}>
            <h1 style={styles.roomName}>{room.name}</h1>
            <div style={styles.roomMeta}>
              <span style={styles.roomCode} onClick={copyRoomCode} title="Click to copy">
                #{room.roomCode}
              </span>
              <span style={styles.participantCount}>
                {room.currentParticipants}/{room.maxParticipants} participants
              </span>
              <span style={styles.roomStatus} data-status={room.status}>
                {room.status}
              </span>
              {!isUserInRoom && (
                <span style={styles.warningBadge}>Not in room</span>
              )}
            </div>
          </div>
        </div>

        <div style={styles.headerRight}>
          <button
            onClick={leaveRoom}
            style={styles.leaveButton}
          >
            Leave Room
          </button>
        </div>
      </header>

      <main style={styles.main}>
        {/* Video Area */}
        <div style={styles.videoSection}>
          {/* Local Video Preview */}
          <div style={styles.videoContainer}>
            <LocalVideoPreview />
          </div>

          {/* Remote Videos */}
          {Object.entries(peers).map(([peerId, peerData]) => (
            <div key={peerId} style={styles.videoContainer}>
              <RemoteVideo
                stream={peerData.stream}
                userData={peerData.userData}
                connectionState={peerData.connectionState}
              />
            </div>
          ))}

          {/* Show message if no connections yet */}
          {Object.keys(peers).length === 0 && connectionStatus === 'connected' && (
            <div style={styles.noConnectionsMessage}>
              <div style={styles.noConnectionsIcon}>👥</div>
              <p style={styles.noConnectionsText}>Connected to room</p>
              <p style={styles.noConnectionsSubtext}>
                Waiting for other participants to join...
              </p>
              <p style={styles.inviteHint}>
                Share room code: <strong>#{room?.roomCode}</strong>
              </p>
            </div>
          )}

          {/* Connection Status */}
          <div style={styles.connectionStatus}>
            <div style={{
              ...styles.statusIndicator,
              backgroundColor: connectionStatus === 'connected' ? '#10b981' :
                connectionStatus === 'connecting' ? '#f59e0b' :
                  '#ef4444'
            }}>
              {connectionStatus.toUpperCase()}
            </div>
            <div style={styles.statusText}>
              {activeConnections} connection{activeConnections !== 1 ? 's' : ''} active
            </div>
          </div>
        </div>

        {/* Participants Sidebar */}
        <aside style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <h3 style={styles.sidebarTitle}>Participants</h3>
            <span style={styles.participantBadge}>
              {participants.length}
            </span>
            <button 
              onClick={refreshRoomData}
              style={styles.refreshSmallButton}
              title="Refresh participants"
            >
              🔄
            </button>
          </div>

          <div style={styles.participantsList}>
            {participants.map(participant => (
              <div
                key={participant.id}
                style={{
                  ...styles.participantItem,
                  ...(participant.isHost ? styles.hostItem : {}),
                  ...(participant.id === user?.uid ? styles.currentUserItem : {})
                }}
              >
                <div style={styles.participantAvatar}>
                  {participant.photoURL ? (
                    <img
                      src={participant.photoURL}
                      alt={participant.name}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <div style={styles.defaultAvatar}>
                      {participant.name.charAt(0)}
                    </div>
                  )}
                  {participant.isHost && (
                    <div style={styles.hostBadge} title="Host">👑</div>
                  )}
                </div>

                <div style={styles.participantInfo}>
                  <div style={styles.participantName}>
                    {participant.name}
                    {participant.id === user?.uid && (
                      <span style={styles.youBadge}> (You)</span>
                    )}
                  </div>
                  <div style={styles.participantStatus}>
                    <span style={styles.statusDot}></span>
                    {participant.isActive ? 'Online' : 'Offline'}
                  </div>
                </div>

                {room.hostId === user?.uid && !participant.isHost && (
                  <button
                    style={styles.kickButton}
                    title="Kick participant"
                    onClick={() => alert(`Kick ${participant.name} - Coming soon`)}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Room Controls */}
          <div style={styles.controlsSection}>
            <h4 style={styles.controlsTitle}>Room Controls</h4>
            <div style={styles.controlsGrid}>
              <button
                style={{
                  ...styles.controlButton,
                  ...(isMicOn ? styles.controlButtonActive : styles.controlButtonInactive)
                }}
                onClick={toggleMicrophone}
                disabled={mediaLoading}
              >
                {isMicOn ? '🎤 Mic On' : '🔇 Mic Muted'}
              </button>
              <button
                style={{
                  ...styles.controlButton,
                  ...(isCameraOn ? styles.controlButtonActive : styles.controlButtonInactive)
                }}
                onClick={toggleCamera}
                disabled={mediaLoading}
              >
                {isCameraOn ? '📹 Camera On' : '📷 Camera Off'}
              </button>
              <button
                style={styles.controlButton}
                onClick={handleCopyInviteLink}
              >
                🔗 Invite
              </button>
              <button
                style={styles.controlButton}
                onClick={() => navigator.clipboard.writeText(`#${room.roomCode}`)}
              >
                📋 Copy Code
              </button>
              {room.hostId === user?.uid && (
                <button
                  style={styles.controlButtonDanger}
                  onClick={() => alert('End Room - Coming soon')}
                >
                  🚪 End Room
                </button>
              )}
            </div>

            {/* Media status */}
            {mediaError && (
              <div style={styles.mediaError}>
                ⚠️ {mediaError}
              </div>
            )}

            {/* Peer connections status */}
            <div style={styles.peersStatus}>
              <div style={styles.peersStatusHeader}>
                <span>Active Connections:</span>
                <span style={{
                  color: activeConnections > 0 ? '#10b981' : '#f59e0b',
                  fontWeight: '600'
                }}>
                  {activeConnections}
                </span>
              </div>
              {Object.entries(peers).map(([peerId, peerData]) => (
                <div key={peerId} style={styles.peerItem}>
                  <span style={styles.peerName}>
                    {peerData.userData?.name || 'Peer'}
                  </span>
                  <span style={{
                    ...styles.peerStatus,
                    color: peerData.connectionState === 'connected' ? '#10b981' :
                           peerData.connectionState === 'connecting' ? '#f59e0b' :
                           '#ef4444'
                  }}>
                    {peerData.connectionState || 'unknown'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>

      {/* Debug Panel */}
      <details style={styles.debugPanel}>
        <summary style={styles.debugSummary}>🔧 Debug Panel</summary>
        <ConnectionDebug />
        <div style={styles.debugActions}>
          <button 
            onClick={debugFirestoreStructure}
            style={styles.debugButton}
          >
            🔍 Debug Firestore
          </button>
          <button 
            onClick={debugRoomState}
            style={styles.debugButton}
          >
            Check Room State
          </button>
          <button 
            onClick={() => console.log('Peers:', peers)}
            style={styles.debugButton}
          >
            Log Peers
          </button>
          <button 
            onClick={refreshRoomData}
            style={styles.debugButton}
          >
            Refresh Data
          </button>
          {room?.hostId === user?.uid && participants.length > 1 && (
            <button 
              onClick={() => {
                const otherParticipant = participants.find(p => p.id !== user?.uid);
                if (otherParticipant) {
                  console.log('Manual connect to:', otherParticipant);
                  connectToUser(otherParticipant.id, {
                    name: otherParticipant.name,
                    photoURL: otherParticipant.photoURL
                  });
                }
              }}
              style={styles.debugButton}
            >
              🔗 Manual Connect
            </button>
          )}
        </div>
      </details>

      <button
        style={styles.controlButton}
        onClick={checkWebRTCConnections}
      >
        🔍 Debug WebRTC
      </button>

      <button
  style={styles.controlButton}
  onClick={() => {
    // Create a test video stream
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    
    // Draw test pattern
    const gradient = ctx.createLinearGradient(0, 0, 640, 480);
    gradient.addColorStop(0, '#8b5cf6');
    gradient.addColorStop(1, '#3b82f6');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 640, 480);
    
    // Add text
    ctx.fillStyle = 'white';
    ctx.font = 'bold 30px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('TEST VIDEO', 320, 200);
    ctx.font = '20px Arial';
    ctx.fillText('Remote Stream Test', 320, 240);
    ctx.fillText(new Date().toLocaleTimeString(), 320, 280);
    
    // Create stream
    const testStream = canvas.captureStream(30);
    const videoTrack = testStream.getVideoTracks()[0];
    videoTrack.enabled = true;
    
    console.log('🎬 Created test stream:', testStream);
    console.log('   Video track:', videoTrack);
    
    // If we have peers, update the first one with test stream
    if (Object.keys(peers).length > 0) {
      const firstPeerId = Object.keys(peers)[0];
      console.log(`Adding test stream to peer: ${firstPeerId}`);
      
      setPeers(prev => ({
        ...prev,
        [firstPeerId]: {
          ...prev[firstPeerId],
          stream: testStream
        }
      }));
    }
  }}
>
  🎬 Test Video
</button>

      {/* Room Status Footer */}
      <footer style={styles.footer}>
        <div style={styles.footerContent}>
          <div style={styles.footerInfo}>
            <span>Room created by {room.hostName}</span>
            <span style={styles.footerSeparator}>•</span>
            <span>You are {room.hostId === user?.uid ? 'the host' : 'a participant'}</span>
            <span style={styles.footerSeparator}>•</span>
            <span style={{
              color: connectionStatus === 'connected' ? '#10b981' :
                     connectionStatus === 'connecting' ? '#f59e0b' : '#ef4444'
            }}>
              {connectionStatus.toUpperCase()}
            </span>
            {!isUserInRoom && (
              <>
                <span style={styles.footerSeparator}>•</span>
                <span style={{color: '#ef4444'}}>NOT IN ROOM</span>
              </>
            )}
          </div>
          <div style={styles.footerActions}>
            <button
              style={styles.footerButton}
              onClick={handleCopyInviteLink}
            >
              Copy Invite Link
            </button>
            <button
              style={styles.footerButton}
              onClick={() => alert('Settings - Coming soon')}
            >
              Settings
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: 'var(--bg-dark)',
    color: 'var(--text-light)',
    display: 'flex',
    flexDirection: 'column'
  },
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--bg-dark)',
    gap: '20px'
  },
  spinner: {
    width: '50px',
    height: '50px',
    border: '4px solid rgba(255, 255, 255, 0.1)',
    borderTopColor: 'var(--primary-purple)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '10px'
  },
  loadingText: {
    color: 'var(--text-gray)',
    fontSize: '1.1rem'
  },
  refreshButton: {
    padding: '10px 20px',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: 'var(--radius-md)',
    color: '#93c5fd',
    cursor: 'pointer',
    fontSize: '0.9rem'
  },
  errorContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--bg-dark)',
    textAlign: 'center',
    padding: '20px',
    gap: '20px'
  },
  errorIcon: {
    fontSize: '4rem',
    marginBottom: '20px'
  },
  errorTitle: {
    fontSize: '2rem',
    marginBottom: '10px',
    color: 'var(--text-light)'
  },
  errorMessage: {
    color: 'var(--text-gray)',
    marginBottom: '30px',
    fontSize: '1.1rem',
    maxWidth: '400px'
  },
  errorActions: {
    display: 'flex',
    gap: '15px'
  },
  backButton: {
    padding: '10px 20px',
    backgroundColor: 'var(--primary-purple)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    color: 'white',
    cursor: 'pointer',
    fontSize: '1rem',
    transition: 'all 0.2s ease'
  },
  fullRoomContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--bg-dark)',
    padding: '20px'
  },
  fullRoomContent: {
    background: 'var(--bg-card)',
    padding: '40px',
    borderRadius: 'var(--radius-xl)',
    border: '1px solid var(--border-medium)',
    textAlign: 'center',
    maxWidth: '500px'
  },
  fullRoomIcon: {
    fontSize: '4rem',
    marginBottom: '20px'
  },
  fullRoomTitle: {
    fontSize: '2rem',
    marginBottom: '15px',
    color: 'var(--text-light)'
  },
  fullRoomMessage: {
    color: 'var(--text-gray)',
    marginBottom: '25px',
    fontSize: '1.1rem'
  },
  fullRoomDetails: {
    textAlign: 'left',
    marginBottom: '30px',
    padding: '20px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.9rem'
  },
  debugInfo: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'center',
    marginBottom: '20px'
  },
  debugButton: {
    padding: '8px 16px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid var(--border-light)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-light)',
    cursor: 'pointer',
    fontSize: '0.8rem'
  },
  fullRoomActions: {
    display: 'flex',
    gap: '15px',
    justifyContent: 'center'
  },
  fullRoomButton: {
    padding: '12px 24px',
    backgroundColor: 'var(--primary-purple)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    color: 'white',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '500'
  },
  fullRoomButtonSecondary: {
    padding: '12px 24px',
    backgroundColor: 'transparent',
    border: '1px solid var(--border-light)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-light)',
    cursor: 'pointer',
    fontSize: '1rem'
  },
  header: {
    backgroundColor: 'var(--bg-card)',
    borderBottom: '1px solid var(--border-light)',
    padding: '15px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px'
  },
  roomInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px'
  },
  roomName: {
    fontSize: '1.5rem',
    fontWeight: '600',
    margin: 0,
    color: 'var(--text-light)'
  },
  roomMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    fontSize: '0.9rem',
    color: 'var(--text-gray)',
    flexWrap: 'wrap'
  },
  roomCode: {
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    color: '#a78bfa',
    padding: '4px 8px',
    borderRadius: '4px',
    fontFamily: 'monospace',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  participantCount: {
    padding: '4px 8px',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: '4px'
  },
  roomStatus: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontWeight: '500',
    textTransform: 'capitalize'
  },
  warningBadge: {
    padding: '4px 8px',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    color: '#f87171',
    borderRadius: '4px',
    fontWeight: '500'
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  leaveButton: {
    padding: '10px 20px',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: 'var(--radius-md)',
    color: '#f87171',
    cursor: 'pointer',
    fontWeight: '500',
    transition: 'all 0.2s ease'
  },
  main: {
    flex: 1,
    display: 'flex',
    padding: '20px',
    gap: '20px',
    overflow: 'hidden'
  },
  videoSection: {
    flex: 3,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '15px',
    backgroundColor: 'var(--bg-card-light)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-light)',
    padding: '15px',
    minHeight: '500px',
    overflowY: 'auto',
    position: 'relative'
  },
  videoContainer: {
    position: 'relative',
    backgroundColor: '#000',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    aspectRatio: '16/9',
    minHeight: '250px',
    border: '2px solid var(--border-light)'
  },
  noConnectionsMessage: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    textAlign: 'center',
    padding: '40px',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 'var(--radius-lg)',
    backdropFilter: 'blur(10px)',
    border: '1px solid var(--border-light)',
    zIndex: 10
  },
  noConnectionsIcon: {
    fontSize: '3rem',
    marginBottom: '15px',
    opacity: 0.7
  },
  noConnectionsText: {
    fontSize: '1.5rem',
    marginBottom: '10px',
    color: 'var(--text-light)'
  },
  noConnectionsSubtext: {
    color: 'var(--text-gray)',
    marginBottom: '15px',
    fontSize: '1rem'
  },
  inviteHint: {
    color: '#a78bfa',
    fontSize: '0.9rem',
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    padding: '8px 12px',
    borderRadius: 'var(--radius-md)',
    display: 'inline-block'
  },
  connectionStatus: {
    position: 'absolute',
    bottom: '20px',
    right: '20px',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    color: 'white',
    padding: '8px 12px',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.9rem',
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backdropFilter: 'blur(10px)'
  },
  statusIndicator: {
    padding: '4px 8px',
    borderRadius: '12px',
    color: 'white',
    fontWeight: '600',
    fontSize: '0.8rem',
    textTransform: 'uppercase'
  },
  statusText: {
    fontSize: '0.8rem',
    opacity: 0.9
  },
  sidebar: {
    flex: 1,
    backgroundColor: 'var(--bg-card-light)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-light)',
    padding: '20px',
    minWidth: '300px',
    maxHeight: '600px',
    overflowY: 'auto'
  },
  sidebarHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    paddingBottom: '15px',
    borderBottom: '1px solid var(--border-light)'
  },
  sidebarTitle: {
    fontSize: '1.2rem',
    fontWeight: '600',
    margin: 0,
    color: 'var(--text-light)'
  },
  participantBadge: {
    backgroundColor: 'var(--primary-purple)',
    color: 'white',
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '0.8rem',
    fontWeight: '600'
  },
  refreshSmallButton: {
    background: 'none',
    border: 'none',
    color: 'var(--text-gray)',
    cursor: 'pointer',
    fontSize: '1rem',
    padding: '5px',
    borderRadius: '4px'
  },
  participantsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '30px'
  },
  participantItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 'var(--radius-md)',
    transition: 'all 0.2s ease'
  },
  hostItem: {
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    borderLeft: '3px solid var(--primary-purple)'
  },
  currentUserItem: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderLeft: '3px solid #3b82f6'
  },
  participantAvatar: {
    position: 'relative',
    width: '40px',
    height: '40px'
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    objectFit: 'cover'
  },
  defaultAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    backgroundColor: 'var(--primary-purple)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: '600',
    fontSize: '1.2rem'
  },
  hostBadge: {
    position: 'absolute',
    bottom: '-5px',
    right: '-5px',
    backgroundColor: 'var(--primary-purple)',
    borderRadius: '50%',
    width: '20px',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.8rem'
  },
  participantInfo: {
    flex: 1,
    minWidth: 0
  },
  participantName: {
    fontWeight: '500',
    color: 'var(--text-light)',
    marginBottom: '4px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  youBadge: {
    color: 'var(--accent-blue)',
    fontSize: '0.9rem'
  },
  participantStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.8rem',
    color: 'var(--text-gray)'
  },
  statusDot: {
    width: '8px',
    height: '8px',
    backgroundColor: '#10b981',
    borderRadius: '50%'
  },
  kickButton: {
    width: '28px',
    height: '28px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '50%',
    color: '#f87171',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.2rem',
    transition: 'all 0.2s ease'
  },
  controlsSection: {
    marginTop: '30px',
    paddingTop: '20px',
    borderTop: '1px solid var(--border-light)'
  },
  controlsTitle: {
    fontSize: '1rem',
    fontWeight: '600',
    marginBottom: '15px',
    color: 'var(--text-light)'
  },
  controlsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '10px',
    marginBottom: '20px'
  },
  controlButton: {
    padding: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid var(--border-light)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-light)',
    cursor: 'pointer',
    fontSize: '0.9rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s ease'
  },
  controlButtonActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderColor: 'rgba(34, 197, 94, 0.5)',
    color: '#4ade80'
  },
  controlButtonInactive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: 'rgba(239, 68, 68, 0.5)',
    color: '#f87171'
  },
  controlButtonDanger: {
    gridColumn: '1 / -1',
    padding: '12px',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: 'var(--radius-md)',
    color: '#f87171',
    cursor: 'pointer',
    fontSize: '0.9rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s ease'
  },
  mediaError: {
    marginTop: '10px',
    padding: '8px 12px',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    borderRadius: 'var(--radius-md)',
    color: '#fbbf24',
    fontSize: '0.8rem'
  },
  peersStatus: {
    marginTop: '20px',
    padding: '15px',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 'var(--radius-md)'
  },
  peersStatusHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '10px',
    fontSize: '0.9rem'
  },
  peerItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 0',
    fontSize: '0.8rem'
  },
  peerName: {
    color: 'var(--text-gray)'
  },
  peerStatus: {
    fontWeight: '500',
    fontSize: '0.75rem',
    textTransform: 'uppercase'
  },
  debugPanel: {
    margin: '20px',
    padding: '15px',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-light)'
  },
  debugSummary: {
    cursor: 'pointer',
    padding: '10px',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: 'var(--radius-md)',
    color: '#93c5fd',
    fontWeight: '500',
    marginBottom: '15px'
  },
  debugActions: {
    display: 'flex',
    gap: '10px',
    marginTop: '15px',
    flexWrap: 'wrap'
  },
  footer: {
    backgroundColor: 'var(--bg-card)',
    borderTop: '1px solid var(--border-light)',
    padding: '15px 20px',
    marginTop: 'auto'
  },
  footerContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  footerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    color: 'var(--text-gray)',
    fontSize: '0.9rem',
    flexWrap: 'wrap'
  },
  footerSeparator: {
    opacity: 0.5
  },
  footerActions: {
    display: 'flex',
    gap: '10px'
  },
  footerButton: {
    padding: '8px 16px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid var(--border-light)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-light)',
    cursor: 'pointer',
    fontSize: '0.9rem',
    transition: 'all 0.2s ease'
  }
};

export default RoomPage;