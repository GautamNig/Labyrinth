import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useRoom } from '../contexts/RoomContext';
import { listenToActiveRooms } from '../services/roomService';
import CreateRoomModal from '../components/CreateRoomModal';

const DashboardPage = () => {
  const { user, logout } = useAuth();
  const { rooms: initialRooms, loading, error, fetchActiveRooms } = useRoom();
  const navigate = useNavigate();
  
  const [rooms, setRooms] = useState(initialRooms);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  // Real-time room updates
 useEffect(() => {
  if (!user) return;

  console.log('Setting up dashboard room listeners');
  
  const unsubscribe = listenToActiveRooms((updatedRooms) => {
    console.log('Dashboard rooms updated:', updatedRooms.length, 'rooms');
    updatedRooms.forEach(room => {
      console.log(`Room ${room.id}: ${room.currentParticipants}/${room.maxParticipants}`);
    });
    setRooms(updatedRooms);
  });

  return () => {
    console.log('Cleaning up dashboard listeners');
    unsubscribe();
  };
}, [user]);

  // Sync with context rooms on initial load
  useEffect(() => {
    setRooms(initialRooms);
  }, [initialRooms]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleJoinRoom = async (roomId) => {
    setIsJoining(true);
    setJoinError('');
    
    try {
      // Find the room in our local state
      const roomToJoin = rooms.find(room => room.id === roomId);
      
      if (!roomToJoin) {
        setJoinError('Room not found');
        return;
      }
      
      // Check if room is full
      if (roomToJoin.currentParticipants >= roomToJoin.maxParticipants) {
        setJoinError('This room is now full');
        return;
      }
      
      // Check if room is active
      if (!roomToJoin.isActive || roomToJoin.status === 'ended') {
        setJoinError('This room is no longer active');
        return;
      }
      
      // Navigate to room (auto-join will happen in RoomPage)
      navigate(`/room/${roomId}`);
      
    } catch (err) {
      console.error('Error joining room:', err);
      setJoinError('Failed to join room. Please try again.');
    } finally {
      setIsJoining(false);
    }
  };

  const formatTimeAgo = (timestamp) => {
  if (!timestamp) return 'Just now';
  
  let date;
  
  // Handle both Firestore timestamp and regular date
  if (timestamp.toDate) {
    date = timestamp.toDate();
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else if (timestamp.seconds) {
    // Firestore timestamp { seconds, nanoseconds }
    date = new Date(timestamp.seconds * 1000);
  } else {
    return 'Just now';
  }
  
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

  const isRoomFull = (room) => {
    return room.currentParticipants >= room.maxParticipants;
  };

  return (
    <>
      <div className="dashboard-page">
        <nav className="dashboard-nav">
          <div className="container nav-container">
            <div className="nav-left">
              <div className="nav-logo"></div>
              <h1 className="nav-title">Labyrinth</h1>
            </div>
            
            <div className="nav-right">
              <div className="user-info">
                {user?.photoURL && (
                  <img
                    src={user.photoURL}
                    alt={user.displayName}
                    className="user-avatar"
                  />
                )}
                <span className="user-name">{user?.displayName}</span>
              </div>
              <button
                onClick={handleLogout}
                className="logout-btn"
              >
                Logout
              </button>
            </div>
          </div>
        </nav>

        <main className="dashboard-main">
          <div className="container">
            <div className="dashboard-content">
              <div className="dashboard-header">
                <h2 className="dashboard-title">Labyrinth Dashboard</h2>
                <p className="dashboard-subtitle">
                  Create or join video chat rooms. Host meetings, collaborate, and connect.
                </p>
              </div>

              {/* Quick Actions */}
              <div style={styles.quickActions}>
                <div style={styles.actionCard}>
                  <div style={styles.actionIcon}>🎥</div>
                  <h3 style={styles.actionTitle}>Create Room</h3>
                  <p style={styles.actionDescription}>
                    Start a new video chat room. Set participant limits and invite others.
                  </p>
                  <button 
                    onClick={() => setShowCreateModal(true)}
                    style={styles.actionButton}
                  >
                    Create New Room
                  </button>
                </div>

                <div style={styles.actionCard}>
                  <div style={styles.actionIcon}>👥</div>
                  <h3 style={styles.actionTitle}>Active Rooms</h3>
                  <p style={styles.actionDescription}>
                    {rooms.length === 0 
                      ? 'No active rooms. Be the first to create one!' 
                      : `${rooms.length} room${rooms.length !== 1 ? 's' : ''} available`
                    }
                  </p>
                  <button 
                    onClick={fetchActiveRooms}
                    style={styles.refreshButton}
                    disabled={loading}
                  >
                    {loading ? 'Refreshing...' : '🔄 Refresh List'}
                  </button>
                </div>
              </div>

              {/* Available Rooms */}
              <div style={styles.roomsSection}>
                <div style={styles.sectionHeader}>
                  <h3 style={styles.sectionTitle}>
                    Available Rooms {rooms.length > 0 && `(${rooms.length})`}
                  </h3>
                  {joinError && (
                    <div style={styles.joinErrorBanner}>
                      {joinError}
                      <button 
                        onClick={() => setJoinError('')}
                        style={styles.dismissError}
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
                
                {error && (
                  <div style={styles.errorMessage}>
                    Error: {error}
                    <button 
                      onClick={fetchActiveRooms}
                      style={styles.retryButton}
                    >
                      Retry
                    </button>
                  </div>
                )}

                {loading && rooms.length === 0 ? (
                  <div style={styles.loading}>
                    <div style={styles.spinner}></div>
                    <p>Loading rooms...</p>
                  </div>
                ) : rooms.length === 0 ? (
                  <div style={styles.emptyState}>
                    <div style={styles.emptyIcon}>🏰</div>
                    <h4 style={styles.emptyTitle}>No Active Rooms</h4>
                    <p style={styles.emptyText}>
                      Be the first to create a room! Click "Create New Room" above.
                    </p>
                  </div>
                ) : (
                  <div style={styles.roomsGrid}>
                    {rooms.map(room => {
                      const full = isRoomFull(room);
                      return (
                        <div 
                          key={room.id} 
                          style={{
                            ...styles.roomCard,
                            ...(full ? styles.roomCardFull : {}),
                            ...(isJoining ? styles.roomCardDisabled : {})
                          }}
                        >
                          <div style={styles.roomHeader}>
                            <div style={styles.roomHost}>
                              {room.hostPhotoURL ? (
                                <img 
                                  src={room.hostPhotoURL} 
                                  alt={room.hostName}
                                  style={styles.hostAvatar}
                                />
                              ) : (
                                <div style={styles.defaultAvatar}>
                                  {room.hostName.charAt(0)}
                                </div>
                              )}
                              <span style={styles.hostName}>{room.hostName}</span>
                            </div>
                            <div style={styles.roomCode}>
                              #{room.roomCode}
                            </div>
                          </div>
                          
                          <h4 style={styles.roomName}>{room.name}</h4>
                          
                          <div style={styles.roomDetails}>
                            <div style={styles.participantInfo}>
                              <span style={{
                                ...styles.participantCount,
                                ...(full ? styles.participantCountFull : {})
                              }}>
                                {room.currentParticipants}/{room.maxParticipants}
                              </span>
                              <span style={styles.participantLabel}>
                                {full ? 'FULL' : 'participants'}
                              </span>
                            </div>
                            <div style={styles.roomTime}>
                              {formatTimeAgo(room.createdAt)}
                            </div>
                          </div>
                          
                          {full ? (
                            <div style={styles.fullRoomBadge}>
                              <span style={styles.fullRoomText}>Room Full</span>
                            </div>
                          ) : (
                            <button 
                              style={styles.joinRoomButton}
                              onClick={() => handleJoinRoom(room.id)}
                              disabled={isJoining}
                            >
                              {isJoining ? 'Joining...' : 'Join Room'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      <CreateRoomModal 
        isOpen={showCreateModal} 
        onClose={() => setShowCreateModal(false)} 
      />
    </>
  );
};

// Styles object - add these to your existing styles
const styles = {
  quickActions: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: 'var(--space-lg)',
    marginBottom: 'var(--space-xl)'
  },
  actionCard: {
    backgroundColor: 'var(--bg-card-light)',
    border: '1px solid var(--border-light)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-lg)',
    transition: 'all 0.3s ease'
  },
  actionIcon: {
    fontSize: '2.5rem',
    marginBottom: 'var(--space-md)'
  },
  actionTitle: {
    fontSize: '1.3rem',
    fontWeight: '600',
    marginBottom: 'var(--space-sm)',
    color: 'var(--text-light)'
  },
  actionDescription: {
    color: 'var(--text-gray)',
    marginBottom: 'var(--space-md)',
    lineHeight: 1.5
  },
  actionButton: {
    width: '100%',
    padding: 'var(--space-md)',
    background: 'linear-gradient(135deg, var(--primary-purple), var(--primary-indigo))',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    color: 'white',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  refreshButton: {
    width: '100%',
    padding: 'var(--space-md)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid var(--border-light)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-light)',
    fontSize: '1rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  roomsSection: {
    marginTop: 'var(--space-xl)'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 'var(--space-lg)'
  },
  sectionTitle: {
    fontSize: '1.5rem',
    fontWeight: '600',
    color: 'var(--text-light)',
    margin: 0
  },
  joinErrorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    color: '#f87171',
    padding: '8px 16px',
    borderRadius: 'var(--radius-md)',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  dismissError: {
    background: 'none',
    border: 'none',
    color: '#f87171',
    fontSize: '1.2rem',
    cursor: 'pointer',
    padding: '0',
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%'
  },
  errorMessage: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    color: '#f87171',
    padding: 'var(--space-md)',
    borderRadius: 'var(--radius-md)',
    marginBottom: 'var(--space-md)'
  },
  retryButton: {
    marginLeft: '10px',
    padding: '4px 12px',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '4px',
    color: '#93c5fd',
    cursor: 'pointer',
    fontSize: '0.9rem'
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--space-xl)',
    color: 'var(--text-gray)'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid rgba(255, 255, 255, 0.1)',
    borderTopColor: 'var(--primary-purple)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: 'var(--space-md)'
  },
  emptyState: {
    textAlign: 'center',
    padding: 'var(--space-xl)',
    color: 'var(--text-gray)'
  },
  emptyIcon: {
    fontSize: '4rem',
    marginBottom: 'var(--space-md)',
    opacity: 0.5
  },
  emptyTitle: {
    fontSize: '1.5rem',
    marginBottom: 'var(--space-sm)',
    color: 'var(--text-light)'
  },
  emptyText: {
    fontSize: '1rem',
    lineHeight: 1.5
  },
  roomsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: 'var(--space-md)'
  },
  roomCard: {
    backgroundColor: 'var(--bg-card-light)',
    border: '1px solid var(--border-light)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-lg)',
    transition: 'all 0.3s ease'
  },
  roomCardFull: {
    borderColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: 'rgba(30, 41, 59, 0.5)'
  },
  roomCardDisabled: {
    pointerEvents: 'none',
    opacity: 0.5
  },
  roomHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 'var(--space-md)'
  },
  roomHost: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-sm)'
  },
  hostAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: '2px solid var(--border-light)'
  },
  defaultAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: 'var(--primary-purple)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: '600',
    fontSize: '0.9rem'
  },
  hostName: {
    fontSize: '0.9rem',
    color: 'var(--text-light)',
    fontWeight: '500'
  },
  roomCode: {
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    color: '#a78bfa',
    padding: 'var(--space-xs) var(--space-sm)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8rem',
    fontWeight: '600',
    fontFamily: 'monospace'
  },
  roomName: {
    fontSize: '1.2rem',
    fontWeight: '600',
    color: 'var(--text-light)',
    marginBottom: 'var(--space-md)'
  },
  roomDetails: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 'var(--space-lg)'
  },
  participantInfo: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 'var(--space-xs)'
  },
  participantCount: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: 'var(--text-light)'
  },
  participantCountFull: {
    color: '#f87171'
  },
  participantLabel: {
    fontSize: '0.9rem',
    color: 'var(--text-gray)'
  },
  roomTime: {
    fontSize: '0.9rem',
    color: 'var(--text-gray)'
  },
  fullRoomBadge: {
    width: '100%',
    padding: '12px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: 'var(--radius-md)',
    textAlign: 'center'
  },
  fullRoomText: {
    color: '#f87171',
    fontWeight: '600',
    fontSize: '0.9rem'
  },
  joinRoomButton: {
    width: '100%',
    padding: 'var(--space-sm)',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: 'var(--radius-md)',
    color: '#93c5fd',
    fontSize: '0.9rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  }
};

export default DashboardPage;