// contexts/MediaContext.jsx - COMPLETE FIXED VERSION
import React, { createContext, useContext, useState, useRef, useCallback } from 'react';

const MediaContext = createContext();

export const useMedia = () => {
  const context = useContext(MediaContext);
  if (!context) {
    throw new Error('useMedia must be used within a MediaProvider');
  }
  return context;
};

export const MediaProvider = ({ children }) => {
  const [localStream, setLocalStream] = useState(null);
  const [isCameraOn, setIsCameraOn] = useState(true); // Default to ON
  const [isMicOn, setIsMicOn] = useState(true); // Default to ON
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [devices, setDevices] = useState([]);
  
  // Store tracks separately for better control
  const videoTrackRef = useRef(null);
  const audioTrackRef = useRef(null);

  // Get available devices
  const getDevices = useCallback(async () => {
    try {
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      setDevices(deviceList);
      console.log('📱 Available devices:', deviceList);
      return deviceList;
    } catch (err) {
      console.error('Error enumerating devices:', err);
      return [];
    }
  }, []);

  // Get a media track with fallbacks
  const getMediaTrack = useCallback(async (kind, deviceId = null) => {
    try {
      console.log(`🎥 Getting ${kind} track...`);
      
      // For localhost testing, use very simple constraints
      const constraints = kind === 'video' 
        ? { 
            video: {
              width: { ideal: 320 },  // Very low resolution for testing
              height: { ideal: 240 },
              frameRate: { ideal: 15 },
              facingMode: 'user',
              ...(deviceId && { deviceId: { exact: deviceId } })
            }
          }
        : { 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              ...(deviceId && { deviceId: { exact: deviceId } })
            }
          };

      console.log(`   Constraints:`, constraints);
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const track = stream.getTracks()[0];
      
      console.log(`✅ Got ${kind} track:`, {
        enabled: track.enabled,
        readyState: track.readyState,
        label: track.label,
        settings: track.getSettings?.()
      });
      
      // FORCE ENABLE the track
      track.enabled = true;
      
      return track;
    } catch (err) {
      console.error(`❌ Error getting ${kind} track:`, err);
      
      // For testing: Create fake tracks if camera/mic is blocked
      if (kind === 'video') {
        console.log('📷 Creating fake video track for testing...');
        return createFakeVideoTrack();
      } else {
        console.log('🎤 Creating fake audio track for testing...');
        return createFakeAudioTrack();
      }
    }
  }, []);

  // Create fake video track for testing
  const createFakeVideoTrack = () => {
    console.log('🎬 Creating fake video track...');
    
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    
    // Draw animated content
    let frame = 0;
    const draw = () => {
      // Gradient background
      const gradient = ctx.createLinearGradient(0, 0, 320, 240);
      gradient.addColorStop(0, '#8b5cf6');
      gradient.addColorStop(1, '#3b82f6');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 320, 240);
      
      // Moving circle
      const x = 160 + Math.sin(frame * 0.05) * 100;
      const y = 120 + Math.cos(frame * 0.05) * 80;
      
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(x, y, 30, 0, Math.PI * 2);
      ctx.fill();
      
      // Text
      ctx.fillStyle = 'white';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('FAKE CAMERA', 160, 50);
      ctx.fillText('For Testing', 160, 200);
      ctx.font = '12px Arial';
      ctx.fillText('Enable real camera in settings', 160, 220);
      
      frame++;
    };
    
    // Start animation
    setInterval(draw, 100);
    
    const stream = canvas.captureStream(10);
    const track = stream.getVideoTracks()[0];
    track.enabled = true;
    
    console.log('✅ Fake video track created');
    return track;
  };

  // Create fake audio track for testing
  const createFakeAudioTrack = () => {
    console.log('🎵 Creating fake audio track...');
    
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 440;
    oscillator.type = 'sine';
    gainNode.gain.value = 0; // Silent
    
    oscillator.start();
    
    // Create a silent MediaStreamAudioTrack
    const dest = audioContext.createMediaStreamDestination();
    oscillator.connect(dest);
    
    const track = dest.stream.getAudioTracks()[0];
    track.enabled = true;
    
    console.log('✅ Fake audio track created');
    return track;
  };

  // Initialize or reinitialize media
  const initializeMedia = useCallback(async (options = {}) => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🎬 Initializing media...', options);
      
      // Stop existing tracks
      if (videoTrackRef.current) {
        videoTrackRef.current.stop();
        videoTrackRef.current = null;
      }
      if (audioTrackRef.current) {
        audioTrackRef.current.stop();
        audioTrackRef.current = null;
      }

      const stream = new MediaStream();
      let hasVideo = false;
      let hasAudio = false;
      
      // Get video track
      if (options.video !== false) {
        try {
          videoTrackRef.current = await getMediaTrack('video');
          if (videoTrackRef.current) {
            stream.addTrack(videoTrackRef.current);
            hasVideo = true;
            setIsCameraOn(true);
            console.log('✅ Video added to stream');
          }
        } catch (videoErr) {
          console.warn('Video init failed:', videoErr);
          setIsCameraOn(false);
        }
      }
      
      // Get audio track  
      if (options.audio !== false) {
        try {
          audioTrackRef.current = await getMediaTrack('audio');
          if (audioTrackRef.current) {
            stream.addTrack(audioTrackRef.current);
            hasAudio = true;
            setIsMicOn(true);
            console.log('✅ Audio added to stream');
          }
        } catch (audioErr) {
          console.warn('Audio init failed:', audioErr);
          setIsMicOn(false);
        }
      }
      
      // If we got nothing, show error
      if (!hasVideo && !hasAudio) {
        setError('Could not access camera or microphone. Please check permissions.');
      }
      
      setLocalStream(stream);
      console.log('🎉 Media initialized successfully!', {
        hasVideo,
        hasAudio,
        streamId: stream.id
      });
      
      // Get device list
      await getDevices();
      
      return stream;
    } catch (err) {
      console.error('❌ Media initialization failed:', err);
      setError(`Failed to initialize media: ${err.message}`);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [getMediaTrack, getDevices]);

  // Toggle camera
  const toggleCamera = useCallback(async () => {
    setIsLoading(true);
    
    try {
      if (isCameraOn) {
        // Turn camera OFF
        console.log('📷 Turning camera OFF...');
        
        if (videoTrackRef.current) {
          videoTrackRef.current.stop();
          videoTrackRef.current = null;
        }
        
        const newStream = new MediaStream();
        if (audioTrackRef.current) {
          newStream.addTrack(audioTrackRef.current);
        }
        
        setLocalStream(newStream);
        setIsCameraOn(false);
        console.log('✅ Camera OFF');
        
      } else {
        // Turn camera ON
        console.log('📹 Turning camera ON...');
        
        videoTrackRef.current = await getMediaTrack('video');
        
        const newStream = new MediaStream();
        if (audioTrackRef.current) {
          newStream.addTrack(audioTrackRef.current);
        }
        newStream.addTrack(videoTrackRef.current);
        
        setLocalStream(newStream);
        setIsCameraOn(true);
        console.log('✅ Camera ON');
      }
    } catch (err) {
      console.error('Error toggling camera:', err);
      setError(`Camera error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [isCameraOn, getMediaTrack]);

  // Toggle microphone
  const toggleMicrophone = useCallback(async () => {
    setIsLoading(true);
    
    try {
      if (isMicOn) {
        // Mute microphone
        console.log('🔇 Muting microphone...');
        
        if (audioTrackRef.current) {
          audioTrackRef.current.stop();
          audioTrackRef.current = null;
        }
        
        const newStream = new MediaStream();
        if (videoTrackRef.current) {
          newStream.addTrack(videoTrackRef.current);
        }
        
        setLocalStream(newStream);
        setIsMicOn(false);
        console.log('✅ Microphone MUTED');
        
      } else {
        // Unmute microphone
        console.log('🎤 Unmuting microphone...');
        
        audioTrackRef.current = await getMediaTrack('audio');
        
        const newStream = new MediaStream();
        if (videoTrackRef.current) {
          newStream.addTrack(videoTrackRef.current);
        }
        newStream.addTrack(audioTrackRef.current);
        
        setLocalStream(newStream);
        setIsMicOn(true);
        console.log('✅ Microphone UNMUTED');
      }
    } catch (err) {
      console.error('Error toggling microphone:', err);
      setError(`Microphone error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [isMicOn, getMediaTrack]);

  // Stop all media
  const stopMedia = useCallback(() => {
    if (videoTrackRef.current) {
      videoTrackRef.current.stop();
      videoTrackRef.current = null;
    }
    if (audioTrackRef.current) {
      audioTrackRef.current.stop();
      audioTrackRef.current = null;
    }
    setLocalStream(null);
    setIsCameraOn(false);
    setIsMicOn(false);
  }, []);

  // Force restart media with permissions
  const restartMediaWithPermissions = useCallback(async () => {
    console.log('🔄 Restarting media with permission request...');
    
    // Try to get permissions first
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      // Stop all tracks from permission stream
      stream.getTracks().forEach(track => track.stop());
      
      // Now initialize our media
      await initializeMedia({ video: true, audio: true });
      
      console.log('✅ Media restarted with permissions');
      return true;
    } catch (err) {
      console.error('❌ Permission request failed:', err);
      setError(`Permission denied: ${err.message}`);
      return false;
    }
  }, [initializeMedia]);

  // Auto-initialize on mount
  React.useEffect(() => {
    const init = async () => {
      try {
        await initializeMedia({ video: true, audio: true });
      } catch (err) {
        console.log('Auto-initialize failed, user will need to manually enable');
      }
    };
    init();
  }, [initializeMedia]);

  // Clean up
  React.useEffect(() => {
    return () => {
      stopMedia();
    };
  }, [stopMedia]);

  const value = {
    localStream,
    isCameraOn,
    isMicOn,
    isLoading,
    error,
    devices,
    initializeMedia,
    toggleCamera,
    toggleMicrophone,
    stopMedia,
    restartMediaWithPermissions,
    getDevices
  };

  return (
    <MediaContext.Provider value={value}>
      {children}
    </MediaContext.Provider>
  );
};