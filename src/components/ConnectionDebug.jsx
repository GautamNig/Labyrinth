// components/ConnectionDebug.jsx
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRoom } from '../contexts/RoomContext';
import { usePeer } from '../contexts/PeerContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const ConnectionDebug = () => {
  const { user } = useAuth();
  const { currentRoom } = useRoom();
  const { peers, connectionStatus, activeConnections } = usePeer();
  const [debugInfo, setDebugInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  const checkConnection = async () => {
    setLoading(true);
    setDebugInfo(null);
    
    console.log('=== CONNECTION DEBUG ===');
    
    const info = {
      timestamp: new Date().toISOString(),
      user: {
        id: user?.uid,
        name: user?.displayName
      },
      room: {
        id: currentRoom?.id,
        name: currentRoom?.name
      },
      peers: Object.keys(peers).length,
      connectionStatus,
      activeConnections
    };
    
    console.log('Basic Info:', info);
    
    // Check Firestore for offers
    if (currentRoom?.id && user?.uid) {
      try {
        const offersRef = collection(
          db, 
          'rooms', 
          currentRoom.id, 
          'signaling', 
          user.uid, 
          'offers'
        );
        
        const snapshot = await getDocs(offersRef);
        info.offersCount = snapshot.docs.length;
        info.offers = snapshot.docs.map(doc => ({
          id: doc.id,
          from: doc.data().from,
          timestamp: doc.data().timestamp
        }));
        
        console.log('Offers found:', info.offersCount);
        console.log('Offers details:', info.offers);
        
      } catch (error) {
        console.error('Error checking offers:', error);
        info.offersError = error.message;
      }
    }
    
    setDebugInfo(info);
    setLoading(false);
  };

  return (
    <div style={{
      background: 'rgba(0,0,0,0.9)',
      color: 'white',
      padding: '15px',
      borderRadius: '8px',
      marginTop: '15px',
      fontSize: '12px',
      maxWidth: '400px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <strong style={{ fontSize: '14px' }}>🔌 Connection Debug</strong>
        <button 
          onClick={checkConnection}
          disabled={loading}
          style={{
            padding: '5px 10px',
            background: loading ? '#6b7280' : '#8b5cf6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '11px'
          }}
        >
          {loading ? 'Checking...' : 'Run Test'}
        </button>
      </div>
      
      <div style={{ marginBottom: '8px' }}>
        <span style={{ color: '#93c5fd' }}>Status:</span> {connectionStatus}
      </div>
      
      <div style={{ marginBottom: '8px' }}>
        <span style={{ color: '#93c5fd' }}>Active Peers:</span> {activeConnections}
      </div>
      
      <div style={{ marginBottom: '8px' }}>
        <span style={{ color: '#93c5fd' }}>Room ID:</span> {currentRoom?.id?.substring(0, 10)}...
      </div>
      
      <div style={{ marginBottom: '8px' }}>
        <span style={{ color: '#93c5fd' }}>User ID:</span> {user?.uid?.substring(0, 10)}...
      </div>
      
      {debugInfo && (
        <div style={{
          marginTop: '10px',
          padding: '10px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '4px',
          fontSize: '11px'
        }}>
          <div style={{ marginBottom: '5px' }}>
            <strong>📊 Debug Results:</strong>
          </div>
          
          <div style={{ marginBottom: '3px' }}>
            <span style={{ color: '#86efac' }}>Offers in my collection:</span> {debugInfo.offersCount || 0}
          </div>
          
          {debugInfo.offers && debugInfo.offers.length > 0 && (
            <div style={{ marginTop: '5px' }}>
              <div style={{ color: '#fbbf24', marginBottom: '3px' }}>📨 Offers found:</div>
              {debugInfo.offers.map((offer, index) => (
                <div key={index} style={{ marginLeft: '10px', marginBottom: '2px' }}>
                  From: {offer.from?.substring(0, 10)}...
                </div>
              ))}
            </div>
          )}
          
          {debugInfo.offersError && (
            <div style={{ color: '#f87171', marginTop: '5px' }}>
              Error: {debugInfo.offersError}
            </div>
          )}
          
          <div style={{ marginTop: '5px', fontSize: '10px', opacity: 0.7 }}>
            Last checked: {new Date(debugInfo.timestamp).toLocaleTimeString()}
          </div>
        </div>
      )}
      
      <div style={{ marginTop: '10px', fontSize: '10px', opacity: 0.7 }}>
        <div>User A (Chad): iMKGFzfEF1esEzNogBHreM89MzH2</div>
        <div>User B (Gautam): GuUKvuO8E0goWwF89MK46MLiImt1</div>
      </div>
    </div>
  );
};

export default ConnectionDebug;