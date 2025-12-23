// components/LocalVideoPreview.jsx - UPDATED
import React, { useEffect, useRef } from 'react';
import { useMedia } from '../contexts/MediaContext';
import AudioVisualizer from './AudioVisualizer';

const LocalVideoPreview = () => {
  const { 
    localStream, 
    isCameraOn, 
    isMicOn, 
    isLoading, 
    error, 
    initializeMedia,
    restartMediaWithPermissions 
  } = useMedia();
  const videoRef = useRef(null);

  // Set video stream when available
  useEffect(() => {
    if (videoRef.current && localStream) {
      console.log('🎥 Setting video srcObject for local preview');
      videoRef.current.srcObject = localStream;
      
      // Log track info
      const videoTracks = localStream.getVideoTracks();
      const audioTracks = localStream.getAudioTracks();
      
      console.log('📊 Local stream tracks:', {
        video: videoTracks.length,
        audio: audioTracks.length,
        videoEnabled: videoTracks[0]?.enabled,
        audioEnabled: audioTracks[0]?.enabled
      });
    }
  }, [localStream]);

  // Initialize media on mount
  useEffect(() => {
    const init = async () => {
      if (!localStream) {
        console.log('🔄 Initializing media on mount...');
        await initializeMedia();
      }
    };
    init();
  }, []);

  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p>Loading camera and microphone...</p>
        <p style={styles.hint}>Please allow permissions if prompted</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <div style={styles.errorIcon}>⚠️</div>
        <h4>Camera/Microphone Error</h4>
        <p style={styles.errorText}>{error}</p>
        <div style={styles.errorButtons}>
          <button 
            onClick={restartMediaWithPermissions}
            style={styles.retryButton}
          >
            Request Permissions
          </button>
          <button 
            onClick={initializeMedia}
            style={styles.secondaryButton}
          >
            Try Again
          </button>
        </div>
        <p style={styles.helpText}>
          If this persists, check browser settings for camera/microphone permissions.
        </p>
      </div>
    );
  }

  const hasVideoTracks = localStream?.getVideoTracks().length > 0;
  const hasAudioTracks = localStream?.getAudioTracks().length > 0;

  return (
    <div style={styles.container}>
      <div style={styles.videoWrapper}>
        {hasVideoTracks ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={styles.video}
            onLoadedMetadata={() => console.log('✅ Local video metadata loaded')}
            onCanPlay={() => console.log('✅ Local video can play')}
          />
        ) : (
          <div style={styles.cameraOffPlaceholder}>
            <div style={styles.cameraOffIcon}>📷</div>
            <p>Camera not available</p>
            <p style={styles.smallText}>
              {isCameraOn ? 'Waiting for camera...' : 'Camera is off'}
            </p>
            <button 
              onClick={() => initializeMedia({ video: true, audio: isMicOn })}
              style={styles.enableButton}
            >
              Enable Camera
            </button>
          </div>
        )}
        
        {/* Status overlay */}
        <div style={styles.statusOverlay}>
          <div style={styles.statusIcons}>
            <div style={{
              ...styles.statusIcon,
              ...(isCameraOn && hasVideoTracks ? styles.statusOn : styles.statusOff)
            }}>
              {isCameraOn && hasVideoTracks ? '📹' : '📷'}
              <span style={styles.statusText}>
                {isCameraOn && hasVideoTracks ? 'Camera On' : 'Camera Off'}
              </span>
            </div>
            <div style={{
              ...styles.statusIcon,
              ...(isMicOn && hasAudioTracks ? styles.statusOn : styles.statusOff)
            }}>
              {isMicOn && hasAudioTracks ? '🎤' : '🔇'}
              <span style={styles.statusText}>
                {isMicOn && hasAudioTracks ? 'Mic On' : 'Mic Muted'}
              </span>
            </div>
          </div>
        </div>
        
        {/* Debug info */}
        <div style={styles.debugInfo}>
          <span>Tracks: V:{localStream?.getVideoTracks().length || 0} A:{localStream?.getAudioTracks().length || 0}</span>
        </div>
        
        {/* Name label */}
        <div style={styles.nameLabel}>
          You (Preview)
        </div>
      </div>

      {/* Audio visualizer - only show if we have audio */}
      {hasAudioTracks && <AudioVisualizer />}
      
      {/* Media controls */}
      <div style={styles.mediaControls}>
        <button
          onClick={() => initializeMedia({ video: true, audio: true })}
          style={styles.mediaButton}
        >
          🔄 Refresh Media
        </button>
        <button
          onClick={restartMediaWithPermissions}
          style={styles.mediaButton}
        >
          🔓 Request Permissions
        </button>
      </div>
    </div>
  );
};

const styles = {
  container: {
    width: '100%',
    height: '100%',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: '15px'
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--text-gray)',
    textAlign: 'center'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid rgba(255, 255, 255, 0.1)',
    borderTopColor: 'var(--primary-purple)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '15px'
  },
  hint: {
    fontSize: '0.9rem',
    opacity: 0.7,
    marginTop: '10px'
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    textAlign: 'center',
    padding: '20px',
    color: 'var(--text-light)'
  },
  errorIcon: {
    fontSize: '3rem',
    marginBottom: '15px',
    opacity: 0.7
  },
  errorText: {
    color: 'var(--text-gray)',
    marginBottom: '20px',
    fontSize: '0.9rem'
  },
  errorButtons: {
    display: 'flex',
    gap: '10px',
    marginBottom: '15px'
  },
  retryButton: {
    padding: '10px 20px',
    backgroundColor: 'var(--primary-purple)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    color: 'white',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  secondaryButton: {
    padding: '10px 20px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid var(--border-light)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-light)',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  helpText: {
    fontSize: '0.8rem',
    color: 'var(--text-gray)',
    maxWidth: '300px'
  },
  videoWrapper: {
    position: 'relative',
    width: '100%',
    flex: 1,
    backgroundColor: '#000',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    minHeight: '300px'
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transform: 'scaleX(-1)',
    backgroundColor: '#000'
  },
  cameraOffPlaceholder: {
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
  cameraOffIcon: {
    fontSize: '4rem',
    marginBottom: '15px',
    opacity: 0.5
  },
  smallText: {
    fontSize: '0.9rem',
    marginBottom: '15px',
    opacity: 0.7
  },
  enableButton: {
    padding: '8px 16px',
    backgroundColor: 'var(--primary-purple)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    color: 'white',
    fontWeight: '500',
    cursor: 'pointer'
  },
  statusOverlay: {
    position: 'absolute',
    top: '15px',
    left: '15px',
    right: '15px',
    zIndex: 10
  },
  statusIcons: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap'
  },
  statusIcon: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '0.9rem',
    fontWeight: '500',
    backdropFilter: 'blur(10px)',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    color: 'white'
  },
  statusOn: {
    backgroundColor: 'rgba(34, 197, 94, 0.7)'
  },
  statusOff: {
    backgroundColor: 'rgba(239, 68, 68, 0.7)'
  },
  statusText: {
    fontSize: '0.8rem'
  },
  debugInfo: {
    position: 'absolute',
    top: '15px',
    right: '15px',
    padding: '4px 8px',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: 'white',
    borderRadius: '4px',
    fontSize: '0.7rem',
    fontFamily: 'monospace'
  },
  nameLabel: {
    position: 'absolute',
    bottom: '15px',
    left: '15px',
    padding: '6px 12px',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: 'white',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.9rem',
    fontWeight: '500'
  },
  mediaControls: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'center'
  },
  mediaButton: {
    padding: '8px 16px',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: 'var(--radius-md)',
    color: '#93c5fd',
    fontSize: '0.8rem',
    cursor: 'pointer'
  }
};

export default LocalVideoPreview;