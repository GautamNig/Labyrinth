import React, { useEffect, useRef, useState } from 'react';
import { useMedia } from '../contexts/MediaContext';

const AudioVisualizer = () => {
  const { localStream, isMicOn } = useMedia();
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const [isActive, setIsActive] = useState(false);
  const [volume, setVolume] = useState(0);

  useEffect(() => {
    if (!localStream || !isMicOn) {
      // Clean up if no stream or mic is off
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      setIsActive(false);
      setVolume(0);
      return;
    }

    const audioTrack = localStream.getAudioTracks()[0];
    if (!audioTrack || !audioTrack.enabled) {
      setIsActive(false);
      setVolume(0);
      return;
    }

    const setupAudioVisualizer = async () => {
      try {
        // Create audio context
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext();
        }

        // Create analyser
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        analyserRef.current.minDecibels = -90;
        analyserRef.current.maxDecibels = -10;
        analyserRef.current.smoothingTimeConstant = 0.85;

        // Connect stream to analyser
        sourceRef.current = audioContextRef.current.createMediaStreamSource(localStream);
        sourceRef.current.connect(analyserRef.current);

        // Start visualization
        setIsActive(true);
        visualize();
      } catch (error) {
        console.error('Error setting up audio visualizer:', error);
        setIsActive(false);
      }
    };

    setupAudioVisualizer();

    // Cleanup
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }
      if (analyserRef.current) {
        analyserRef.current.disconnect();
      }
    };
  }, [localStream, isMicOn]);

  const visualize = () => {
    if (!canvasRef.current || !analyserRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      // Get frequency data
      analyserRef.current.getByteFrequencyData(dataArray);

      // Calculate average volume
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const averageVolume = sum / dataArray.length;
      setVolume(averageVolume);

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw volume bars
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2;

        // Create gradient based on volume level
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
        
        if (barHeight < 30) {
          gradient.addColorStop(0, '#10b981'); // Green for low volume
          gradient.addColorStop(1, '#34d399');
        } else if (barHeight < 60) {
          gradient.addColorStop(0, '#f59e0b'); // Yellow for medium
          gradient.addColorStop(1, '#fbbf24');
        } else {
          gradient.addColorStop(0, '#ef4444'); // Red for high
          gradient.addColorStop(1, '#f87171');
        }

        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();
  };

  // Calculate volume percentage for display
  const volumePercentage = Math.min(Math.round((volume / 128) * 100), 100);
  
  // Determine volume level for color coding
  let volumeLevel = 'low';
  let volumeColor = '#10b981';
  if (volumePercentage > 30) {
    volumeLevel = 'medium';
    volumeColor = '#f59e0b';
  }
  if (volumePercentage > 60) {
    volumeLevel = 'high';
    volumeColor = '#ef4444';
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>
          <span style={styles.icon}>🎤</span>
          Microphone Activity
        </div>
        <div style={styles.status}>
          <div style={{
            ...styles.statusDot,
            backgroundColor: isMicOn ? '#10b981' : '#ef4444'
          }}></div>
          <span>{isMicOn ? 'Active' : 'Muted'}</span>
        </div>
      </div>

      {/* Visualizer Canvas */}
      <div style={styles.visualizerContainer}>
        <canvas 
          ref={canvasRef} 
          width={300} 
          height={80}
          style={styles.canvas}
        />
        
        {/* Volume level indicator */}
        <div style={styles.volumeInfo}>
          <div style={styles.volumeBarContainer}>
            <div 
              style={{
                ...styles.volumeBar,
                width: `${volumePercentage}%`,
                backgroundColor: volumeColor
              }}
            ></div>
          </div>
          <div style={styles.volumeText}>
            <span style={{ color: volumeColor, fontWeight: '600' }}>
              {volumeLevel.toUpperCase()}
            </span>
            <span>{volumePercentage}%</span>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div style={styles.instructions}>
        {!isActive && isMicOn ? (
          <div style={styles.warning}>
            <span style={styles.warningIcon}>⚠️</span>
            Speak to see audio activity. Try saying "Testing, 1, 2, 3"
          </div>
        ) : !isMicOn ? (
          <div style={styles.muted}>
            <span style={styles.mutedIcon}>🔇</span>
            Microphone is muted
          </div>
        ) : (
          <div style={styles.active}>
            <span style={styles.activeIcon}>🎯</span>
            Microphone is working! Volume: {volumeLevel}
          </div>
        )}
      </div>

      {/* Test button */}
      <button 
        onClick={() => {
          // Create a simple test tone
          if (isMicOn && audioContextRef.current) {
            const oscillator = audioContextRef.current.createOscillator();
            const gainNode = audioContextRef.current.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContextRef.current.destination);
            
            oscillator.frequency.value = 440; // A4 note
            oscillator.type = 'sine';
            
            // Fade in/out
            gainNode.gain.setValueAtTime(0, audioContextRef.current.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.1, audioContextRef.current.currentTime + 0.1);
            gainNode.gain.linearRampToValueAtTime(0, audioContextRef.current.currentTime + 0.5);
            
            oscillator.start(audioContextRef.current.currentTime);
            oscillator.stop(audioContextRef.current.currentTime + 0.5);
          }
        }}
        style={styles.testButton}
        disabled={!isMicOn}
      >
        🔊 Test Sound
      </button>
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 'var(--radius-lg)',
    padding: '15px',
    border: '1px solid var(--border-light)',
    marginTop: '20px'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px'
  },
  title: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: '600',
    color: 'var(--text-light)',
    fontSize: '1rem'
  },
  icon: {
    fontSize: '1.2rem'
  },
  status: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.85rem',
    color: 'var(--text-gray)'
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%'
  },
  visualizerContainer: {
    position: 'relative',
    marginBottom: '15px'
  },
  canvas: {
    width: '100%',
    height: '80px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'rgba(0, 0, 0, 0.5)'
  },
  volumeInfo: {
    marginTop: '10px'
  },
  volumeBarContainer: {
    width: '100%',
    height: '6px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '3px',
    overflow: 'hidden',
    marginBottom: '5px'
  },
  volumeBar: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.2s ease'
  },
  volumeText: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.8rem',
    color: 'var(--text-gray)'
  },
  instructions: {
    fontSize: '0.85rem',
    textAlign: 'center',
    marginBottom: '15px',
    padding: '10px',
    borderRadius: 'var(--radius-md)'
  },
  warning: {
    color: '#f59e0b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px'
  },
  warningIcon: {
    fontSize: '1rem'
  },
  muted: {
    color: '#ef4444',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px'
  },
  mutedIcon: {
    fontSize: '1rem'
  },
  active: {
    color: '#10b981',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px'
  },
  activeIcon: {
    fontSize: '1rem'
  },
  testButton: {
    width: '100%',
    padding: '10px',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: 'var(--radius-md)',
    color: '#93c5fd',
    fontSize: '0.9rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  testButtonHover: {
    backgroundColor: 'rgba(59, 130, 246, 0.3)'
  },
  testButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed'
  }
};

export default AudioVisualizer;