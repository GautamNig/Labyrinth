// components/RemoteVideo.jsx - SIMPLIFIED VERSION
import React, { useEffect, useRef } from 'react';
import { usePeer } from '../contexts/PeerContext';

const RemoteVideo = () => {
  const { remoteStream, remoteUser, connectionStatus } = usePeer();
  const videoRef = useRef(null);

  useEffect(() => {
    console.log('🎬 RemoteVideo useEffect');
    console.log('Remote stream:', remoteStream);
    console.log('Remote user:', remoteUser);
    console.log('Connection status:', connectionStatus);
    
    if (videoRef.current && remoteStream) {
      console.log('🎥 Setting remote stream to video element');
      console.log('Stream tracks:', remoteStream.getTracks().map(t => ({
        kind: t.kind,
        enabled: t.enabled,
        muted: t.muted,
        readyState: t.readyState
      })));
      
      videoRef.current.srcObject = remoteStream;
      
      // Try to play the video
      const playVideo = () => {
        if (videoRef.current && videoRef.current.paused) {
          videoRef.current.play()
            .then(() => console.log('✅ Remote video playing'))
            .catch(err => console.error('❌ Remote video play error:', err));
        }
      };
      
      playVideo();
      
      // Set up event listeners
      videoRef.current.onloadedmetadata = () => {
        console.log('✅ Remote video metadata loaded');
        playVideo();
      };
      
      videoRef.current.oncanplay = () => {
        console.log('✅ Remote video can play');
        playVideo();
      };
    }
    
    // Cleanup
    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [remoteStream, remoteUser, connectionStatus]);

  if (!remoteStream) {
    return (
      <div style={styles.placeholder}>
        <div style={styles.avatar}>
          {remoteUser?.name?.charAt(0) || '?'}
        </div>
        <p style={styles.placeholderText}>
          {connectionStatus === 'creating-offer' || connectionStatus === 'creating-answer' 
            ? 'Connecting...' 
            : 'Waiting for remote video...'}
        </p>
        <p style={styles.statusText}>
          Status: {connectionStatus}
        </p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={false}
        style={styles.video}
      />
      <div style={styles.overlay}>
        <div style={styles.nameBadge}>
          {remoteUser?.name || 'Remote User'}
        </div>
        <div style={{
          ...styles.statusBadge,
          backgroundColor: connectionStatus === 'connected' ? '#10b981' :
                         connectionStatus === 'checking' ? '#f59e0b' :
                         '#ef4444'
        }}>
          {connectionStatus}
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: '#000',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden'
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    backgroundColor: '#000'
  },
  placeholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--bg-card)',
    color: 'var(--text-gray)',
    textAlign: 'center'
  },
  avatar: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    backgroundColor: 'var(--primary-purple)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: '2rem',
    fontWeight: '600',
    marginBottom: '15px'
  },
  placeholderText: {
    fontSize: '1rem',
    marginBottom: '10px'
  },
  statusText: {
    fontSize: '0.8rem',
    opacity: 0.7
  },
  overlay: {
    position: 'absolute',
    top: '15px',
    left: '15px',
    right: '15px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  nameBadge: {
    padding: '6px 12px',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: 'white',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.9rem',
    fontWeight: '500',
    backdropFilter: 'blur(10px)'
  },
  statusBadge: {
    padding: '4px 8px',
    color: 'white',
    borderRadius: '12px',
    fontSize: '0.7rem',
    fontWeight: '600',
    textTransform: 'uppercase'
  }
};

export default RemoteVideo;