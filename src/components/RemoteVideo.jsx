// components/RemoteVideo.jsx - FINAL FIX
import React, { useEffect, useRef, useState } from 'react';

const RemoteVideo = ({ stream, userData, connectionState }) => {
  const videoRef = useRef(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
  const [trackInfo, setTrackInfo] = useState({ video: [], audio: [] });
  const [videoError, setVideoError] = useState(null);

  useEffect(() => {
    console.log('🎬 RemoteVideo useEffect called for user:', userData?.name);
    console.log('   Stream exists:', !!stream);
    console.log('   Stream active:', stream?.active);
    console.log('   Stream id:', stream?.id);
    
    if (!stream) {
      console.log('❌ No stream provided');
      return;
    }

    // Check tracks immediately
    const videoTracks = stream.getVideoTracks();
    const audioTracks = stream.getAudioTracks();
    
    console.log('📊 Initial track check:', {
      videoTracks: videoTracks.length,
      audioTracks: audioTracks.length,
      videoEnabled: videoTracks[0]?.enabled,
      audioEnabled: audioTracks[0]?.enabled
    });
    
    setTrackInfo({
      video: videoTracks.map(t => ({
        enabled: t.enabled,
        kind: t.kind,
        label: t.label || 'No label'
      })),
      audio: audioTracks.map(t => ({
        enabled: t.enabled,
        kind: t.kind,
        label: t.label || 'No label'
      }))
    });
    
    setHasVideo(videoTracks.length > 0 && videoTracks[0].enabled);
    setHasAudio(audioTracks.length > 0 && audioTracks[0].enabled);
    
    if (videoRef.current) {
      console.log('🎥 Setting video srcObject...');
      videoRef.current.srcObject = stream;
      
      // IMPORTANT: Force enable tracks
      videoTracks.forEach(track => {
        if (!track.enabled) {
          console.log('🔄 Enabling video track...');
          track.enabled = true;
        }
      });
      
      audioTracks.forEach(track => {
        if (!track.enabled) {
          console.log('🔄 Enabling audio track...');
          track.enabled = true;
        }
      });
      
      // Force play with error handling
      const playVideo = () => {
        if (videoRef.current && videoRef.current.paused) {
          console.log('▶️ Attempting to play video...');
          videoRef.current.play()
            .then(() => {
              console.log('✅ Video play succeeded');
              setVideoError(null);
            })
            .catch(error => {
              console.error('❌ Video play failed:', error);
              setVideoError(error.message);
              
              // Try again with user interaction
              setTimeout(() => {
                if (videoRef.current && videoRef.current.paused) {
                  videoRef.current.play().catch(e => {
                    console.log('Second play attempt failed:', e);
                  });
                }
              }, 1000);
            });
        }
      };
      
      // Try to play immediately
      playVideo();
      
      // Also try after metadata loads
      videoRef.current.onloadedmetadata = () => {
        console.log('✅ Video metadata loaded');
        playVideo();
      };
      
      videoRef.current.oncanplay = () => {
        console.log('✅ Video can play');
        playVideo();
      };
      
      // Track event listeners
      const handleTrackChange = () => {
        const vTracks = stream.getVideoTracks();
        const aTracks = stream.getAudioTracks();
        
        setHasVideo(vTracks.length > 0 && vTracks[0]?.enabled);
        setHasAudio(aTracks.length > 0 && aTracks[0]?.enabled);
        
        console.log('🔄 Track change detected:', {
          video: vTracks.length > 0 && vTracks[0]?.enabled,
          audio: aTracks.length > 0 && aTracks[0]?.enabled
        });
      };
      
      stream.getTracks().forEach(track => {
        track.addEventListener('ended', handleTrackChange);
        track.addEventListener('mute', handleTrackChange);
        track.addEventListener('unmute', handleTrackChange);
      });
      
      return () => {
        stream.getTracks().forEach(track => {
          track.removeEventListener('ended', handleTrackChange);
          track.removeEventListener('mute', handleTrackChange);
          track.removeEventListener('unmute', handleTrackChange);
        });
      };
    }
  }, [stream, userData]);

  // Force play on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (videoRef.current && videoRef.current.paused && hasVideo) {
        console.log('🔄 Force playing video after timeout...');
        videoRef.current.play().catch(err => {
          console.error('Force play error:', err);
        });
      }
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [hasVideo]);

  const getConnectionStatusColor = () => {
    switch (connectionState) {
      case 'connected': return '#10b981';
      case 'connecting': return '#f59e0b';
      case 'disconnected': return '#ef4444';
      case 'failed': return '#dc2626';
      default: return '#6b7280';
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.videoWrapper}>
        {hasVideo ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              style={styles.video}
              muted={false}
              onLoadedMetadata={() => console.log('✅ onLoadedMetadata fired')}
              onCanPlay={() => console.log('✅ onCanPlay fired')}
              onPlay={() => console.log('▶️ onPlay fired')}
              onError={(e) => {
                console.error('❌ Video error event:', e);
                setVideoError(videoRef.current?.error?.message || 'Unknown error');
              }}
            />
            
            {/* Debug overlay */}
            <div style={styles.debugOverlay}>
              <div style={styles.debugRow}>
                <span>🎥: {trackInfo.video.length}</span>
                <span>🎤: {trackInfo.audio.length}</span>
              </div>
              <div style={styles.debugRow}>
                <span style={{color: hasVideo ? '#10b981' : '#ef4444'}}>
                  {hasVideo ? 'VIDEO ON' : 'VIDEO OFF'}
                </span>
                <span style={{color: hasAudio ? '#10b981' : '#ef4444'}}>
                  {hasAudio ? 'AUDIO ON' : 'AUDIO OFF'}
                </span>
              </div>
            </div>
            
            {/* Error message */}
            {videoError && (
              <div style={styles.errorOverlay}>
                <div style={styles.errorText}>⚠️ {videoError}</div>
                <button 
                  style={styles.retryButton}
                  onClick={() => videoRef.current?.play()}
                >
                  Retry Play
                </button>
              </div>
            )}
          </>
        ) : (
          <div style={styles.noVideoPlaceholder}>
            <div style={styles.avatar}>
              {userData?.name?.charAt(0) || 'U'}
            </div>
            <p style={styles.noVideoText}>Waiting for video...</p>
            <div style={styles.trackInfo}>
              <div>Video tracks: {trackInfo.video.length}</div>
              <div>Audio tracks: {trackInfo.audio.length}</div>
              {trackInfo.video.length > 0 && (
                <div style={{fontSize: '0.7rem', color: '#f59e0b'}}>
                  Track exists but not enabled
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Status overlay */}
        <div style={styles.statusOverlay}>
          <div style={styles.statusIcons}>
            <div style={{
              ...styles.statusIcon,
              backgroundColor: hasVideo ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)'
            }}>
              {hasVideo ? '📹' : '📷'}
            </div>
            <div style={{
              ...styles.statusIcon,
              backgroundColor: hasAudio ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)'
            }}>
              {hasAudio ? '🎤' : '🔇'}
            </div>
          </div>
          
          <div style={{
            ...styles.connectionStatus,
            backgroundColor: getConnectionStatusColor()
          }}>
            {connectionState || 'unknown'}
          </div>
        </div>
        
        {/* Name label */}
        <div style={styles.nameLabel}>
          {userData?.name || 'Remote User'}
        </div>
      </div>
      
      {/* Debug panel */}
      <div style={styles.debugPanel}>
        <button 
          style={styles.debugButton}
          onClick={() => {
            console.log('🔍 Remote stream debug:', {
              stream: stream,
              tracks: stream?.getTracks(),
              videoTracks: stream?.getVideoTracks(),
              audioTracks: stream?.getAudioTracks(),
              videoElement: videoRef.current,
              videoElementState: videoRef.current ? {
                srcObject: videoRef.current.srcObject,
                readyState: videoRef.current.readyState,
                error: videoRef.current.error,
                paused: videoRef.current.paused,
                currentTime: videoRef.current.currentTime,
                videoWidth: videoRef.current.videoWidth,
                videoHeight: videoRef.current.videoHeight
              } : null
            });
            
            // Force enable all tracks
            if (stream) {
              stream.getVideoTracks().forEach(track => {
                track.enabled = true;
                console.log('✅ Enabled video track');
              });
              stream.getAudioTracks().forEach(track => {
                track.enabled = true;
                console.log('✅ Enabled audio track');
              });
            }
            
            // Force play
            if (videoRef.current && videoRef.current.paused) {
              videoRef.current.play().then(() => {
                console.log('✅ Manual play succeeded');
              }).catch(err => {
                console.error('❌ Manual play failed:', err);
              });
            }
          }}
        >
          Debug Stream
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
    backgroundColor: '#000',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    border: '3px solid #3b82f6'
  },
  videoWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative'
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    backgroundColor: '#000',
    transform: 'scaleX(-1)',
    display: 'block'
  },
  debugOverlay: {
    position: 'absolute',
    top: '5px',
    right: '5px',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: '5px 10px',
    borderRadius: '4px',
    fontSize: '0.7rem',
    color: 'white',
    fontFamily: 'monospace'
  },
  debugRow: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'space-between'
  },
  errorOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: 'rgba(239, 68, 68, 0.8)',
    padding: '10px',
    borderRadius: '8px',
    color: 'white',
    textAlign: 'center',
    zIndex: 20
  },
  errorText: {
    marginBottom: '10px',
    fontSize: '0.8rem'
  },
  retryButton: {
    padding: '5px 10px',
    backgroundColor: 'white',
    color: '#ef4444',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.7rem'
  },
  noVideoPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e293b',
    color: '#94a3b8'
  },
  avatar: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    backgroundColor: '#8b5cf6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: '2rem',
    fontWeight: '600',
    marginBottom: '10px'
  },
  noVideoText: {
    fontSize: '0.9rem',
    marginBottom: '10px'
  },
  trackInfo: {
    fontSize: '0.8rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: '10px',
    borderRadius: '8px'
  },
  statusOverlay: {
    position: 'absolute',
    top: '10px',
    left: '10px',
    right: '10px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    zIndex: 10
  },
  statusIcons: {
    display: 'flex',
    gap: '5px'
  },
  statusIcon: {
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '0.8rem',
    color: 'white',
    backdropFilter: 'blur(10px)',
    minWidth: '40px',
    textAlign: 'center'
  },
  connectionStatus: {
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '0.7rem',
    color: 'white',
    fontWeight: '600',
    textTransform: 'uppercase',
    backdropFilter: 'blur(10px)',
    backgroundColor: 'rgba(0, 0, 0, 0.5)'
  },
  nameLabel: {
    position: 'absolute',
    bottom: '10px',
    left: '10px',
    padding: '6px 12px',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: 'white',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.9rem',
    fontWeight: '500'
  },
  debugPanel: {
    position: 'absolute',
    bottom: '10px',
    right: '10px',
    zIndex: 20
  },
  debugButton: {
    padding: '6px 12px',
    backgroundColor: 'rgba(59, 130, 246, 0.7)',
    border: '1px solid rgba(59, 130, 246, 0.9)',
    borderRadius: '4px',
    color: 'white',
    fontSize: '0.8rem',
    cursor: 'pointer',
    fontWeight: '500'
  }
};

export default RemoteVideo;