import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  getRoom,
  getRoomParticipants,
  joinRoom as joinRoomService,
  listenToRoom,
  listenToParticipants
} from '../services/roomService';

const RoomPage = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasLoaded, setHasLoaded] = useState(false);

    useEffect(() => {
    setHasLoaded(false);
  }, [roomId]);
  // Real-time room updates
  useEffect(() => {
    if (!roomId || !user) return;

    console.log('Setting up real-time listeners for room:', roomId);

    const unsubscribeRoom = listenToRoom(roomId, (roomData) => {
      console.log('Room real-time update:', roomData);
      if (roomData) {
        setRoom(roomData);
      } else {
        setError('Room was deleted');
      }
    });

    const unsubscribeParticipants = listenToParticipants(roomId, (participantsData) => {
      console.log('Participants real-time update:', participantsData);
      setParticipants(participantsData);
    });

    // Cleanup
    return () => {
      console.log('Cleaning up real-time listeners');
      unsubscribeRoom();
      unsubscribeParticipants();
    };
  }, [roomId, user]);

  // Initial load
  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }

    loadRoom();
  }, [roomId, user, navigate]);

const loadRoom = async () => {
  setLoading(true);
  setError('');
  
  try {
    console.log('=== LOAD ROOM START ===');
    console.log('User:', user?.uid);
    console.log('Room ID:', roomId);
    
    // Get room and participants data
    const roomData = await getRoom(roomId);
    const participantsData = await getRoomParticipants(roomId);
    
    console.log('Room data:', roomData);
    console.log('Participants:', participantsData);
    console.log('Participant IDs:', participantsData.map(p => p.id));
    
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

    // Check if user is in participants list
    const isUserInRoom = participantsData.some(p => p.id === user.uid);
    console.log('Is user in room?', isUserInRoom);
    
    // Check if room is full
    const isRoomFull = roomData.currentParticipants >= roomData.maxParticipants;
    console.log('Is room full?', isRoomFull, `(${roomData.currentParticipants}/${roomData.maxParticipants})`);

    // Set state
    setRoom(roomData);
    setParticipants(participantsData);

    // If user is already in room, stop here
    if (isUserInRoom) {
      console.log('User already in room, loading complete');
      setLoading(false);
      return;
    }
    
    // If room is full AND user is not in it, show error
    if (isRoomFull) {
      console.log('Room is full and user not in it');
      setError('Room is full. Cannot join.');
      setLoading(false);
      return;
    }
    
    // Room has space and user is not in it - try to join
    console.log('Attempting to join room...');
    try {
      const joinResult = await joinRoomService(roomId, user);
      console.log('Join result:', joinResult);
      
      // After joining, refresh data
      const updatedRoom = await getRoom(roomId);
      const updatedParticipants = await getRoomParticipants(roomId);
      
      console.log('After join - Room:', updatedRoom);
      console.log('After join - Participants:', updatedParticipants);
      
      setRoom(updatedRoom);
      setParticipants(updatedParticipants);
      
      // Double-check user is now in room
      const userNowInRoom = updatedParticipants.some(p => p.id === user.uid);
      console.log('User now in room?', userNowInRoom);
      
      if (!userNowInRoom) {
        // Something went wrong with join
        setError('Failed to join room. Please try again.');
      }
      
    } catch (joinError) {
      console.error('Join error:', joinError);
      
      // Check current state again in case of race condition
      const currentParticipants = await getRoomParticipants(roomId);
      const userNowInRoom = currentParticipants.some(p => p.id === user.uid);
      
      if (userNowInRoom) {
        // User actually IS in room (race condition resolved)
        console.log('Race condition - user is actually in room');
        setParticipants(currentParticipants);
        // No error, just continue
      } else if (joinError.message.includes('full') || joinError.message.includes('permission')) {
        // Room is full or permission denied
        const currentRoom = await getRoom(roomId);
        const currentIsFull = currentRoom.currentParticipants >= currentRoom.maxParticipants;
        
        if (currentIsFull) {
          setError('Room is full. Cannot join.');
        } else {
          setError('Permission denied. Please try again.');
        }
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
};

  // Debug function to check current state
  const checkRoomState = async () => {
    console.log('=== ROOM STATE CHECK ===');
    console.log('UI Room:', room);
    console.log('UI Participants:', participants);
    console.log('UI Participant count:', participants?.length);
    
    try {
      const currentRoom = await getRoom(roomId);
      const currentParticipants = await getRoomParticipants(roomId);
      console.log('DB Room:', currentRoom);
      console.log('DB Participants:', currentParticipants);
      console.log('DB Participant count:', currentParticipants?.length);
      console.log('=== END CHECK ===');
    } catch (err) {
      console.error('Check failed:', err);
    }
  };

  // Call checkRoomState when room updates
  useEffect(() => {
    if (room && participants) {
      console.log('Room updated - current state:', {
        roomId: room.id,
        participantCount: room.currentParticipants,
        maxParticipants: room.maxParticipants,
        actualParticipants: participants.length
      });
    }
  }, [room, participants]);

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

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={styles.loadingText}>Loading room...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <div style={styles.errorIcon}>⚠️</div>
        <h2 style={styles.errorTitle}>Room Unavailable</h2>
        <p style={styles.errorMessage}>{error}</p>
        <button 
          onClick={() => navigate('/dashboard')}
          style={styles.backButton}
        >
          Back to Dashboard
        </button>
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

  if (error && error.includes('Room is full')) {
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
          </div>
          <div style={styles.fullRoomActions}>
            <button 
              onClick={() => navigate('/dashboard')}
              style={styles.fullRoomButton}
            >
              Back to Dashboard
            </button>
            <button 
              onClick={() => window.location.reload()}
              style={styles.fullRoomButtonSecondary}
            >
              Try Again
            </button>
          </div>
        </div>
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
        {/* Video Area Placeholder */}
        <div style={styles.videoSection}>
          <div style={styles.videoPlaceholder}>
            <div style={styles.videoIcon}>🎥</div>
            <h3 style={styles.videoTitle}>Video Chat</h3>
            <p style={styles.videoDescription}>
              Video chat functionality will be available in the next update.
            </p>
            <div style={styles.videoStats}>
              <div style={styles.stat}>
                <span style={styles.statNumber}>{participants.length}</span>
                <span style={styles.statLabel}>Connected</span>
              </div>
              <div style={styles.stat}>
                <span style={styles.statNumber}>{room.maxParticipants - participants.length}</span>
                <span style={styles.statLabel}>Slots Available</span>
              </div>
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
          </div>
          
          <div style={styles.participantsList}>
            {participants.map(participant => (
              <div 
                key={participant.id} 
                style={{
                  ...styles.participantItem,
                  ...(participant.isHost ? styles.hostItem : {})
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
                style={styles.controlButton}
                onClick={() => alert('Mute/Unmute - Coming soon')}
              >
                🎤 Mic
              </button>
              <button 
                style={styles.controlButton}
                onClick={() => alert('Camera On/Off - Coming soon')}
              >
                📹 Camera
              </button>
              <button 
                style={styles.controlButton}
                onClick={copyRoomCode}
              >
                🔗 Invite
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
          </div>
        </aside>
      </main>

      <div style={styles.statusContainer}>
  <div style={{
    ...styles.statusIndicator,
    backgroundColor: room?.currentParticipants >= room?.maxParticipants ? '#ef4444' : '#10b981'
  }}>
    {room?.currentParticipants >= room?.maxParticipants ? 'FULL' : 'AVAILABLE'}
  </div>
  <div style={styles.statusText}>
    {room?.currentParticipants}/{room?.maxParticipants} participants
    {room?.currentParticipants >= room?.maxParticipants && 
      ' (Room is full)'}
  </div>
</div>

      {/* Room Info Footer */}
      <footer style={styles.footer}>
        <div style={styles.footerContent}>
          <div style={styles.footerInfo}>
            <span>Room created by {room.hostName}</span>
            <span style={styles.footerSeparator}>•</span>
            <span>Host controls enabled</span>
          </div>
          <div style={styles.footerActions}>
            <button 
              style={styles.footerButton}
              onClick={copyRoomCode}
            >
              Copy Invite Code
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
    backgroundColor: 'var(--bg-dark)'
  },
  spinner: {
    width: '50px',
    height: '50px',
    border: '4px solid rgba(255, 255, 255, 0.1)',
    borderTopColor: 'var(--primary-purple)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '20px'
  },
  loadingText: {
    color: 'var(--text-gray)',
    fontSize: '1.1rem'
  },
  errorContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--bg-dark)',
    textAlign: 'center',
    padding: '20px'
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
  backButton: {
    padding: '8px 16px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid var(--border-light)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-light)',
    cursor: 'pointer',
    fontSize: '0.9rem',
    transition: 'all 0.2s ease'
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
    color: 'var(--text-gray)'
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
  'roomStatus[data-status="waiting"]': {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    color: '#fbbf24'
  },
  'roomStatus[data-status="active"]': {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    color: '#4ade80'
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
    backgroundColor: 'var(--bg-card-light)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-light)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '500px'
  },
  videoPlaceholder: {
    textAlign: 'center',
    padding: '40px'
  },
  videoIcon: {
    fontSize: '5rem',
    marginBottom: '20px',
    opacity: 0.5
  },
  videoTitle: {
    fontSize: '2rem',
    marginBottom: '10px',
    color: 'var(--text-light)'
  },
  videoDescription: {
    color: 'var(--text-gray)',
    marginBottom: '30px',
    fontSize: '1.1rem',
    maxWidth: '400px'
  },
  videoStats: {
    display: 'flex',
    justifyContent: 'center',
    gap: '40px',
    marginTop: '30px'
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  statNumber: {
    fontSize: '2.5rem',
    fontWeight: '700',
    color: 'var(--primary-purple)'
  },
  statLabel: {
    color: 'var(--text-gray)',
    fontSize: '0.9rem',
    marginTop: '5px'
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
    gap: '10px'
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
  footer: {
    backgroundColor: 'var(--bg-card)',
    borderTop: '1px solid var(--border-light)',
    padding: '15px 20px'
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
    fontSize: '0.9rem'
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
  },
  statusContainer: {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  marginBottom: '15px'
},
statusIndicator: {
  padding: '5px 10px',
  borderRadius: '20px',
  color: 'white',
  fontWeight: 'bold',
  fontSize: '0.8rem'
},
statusText: {
  color: 'var(--text-gray)',
  fontSize: '0.9rem'
}
};

export default RoomPage;