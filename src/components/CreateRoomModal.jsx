import React, { useState } from 'react';
import { useRoom } from '../contexts/RoomContext';
import { useNavigate } from 'react-router-dom';

const CreateRoomModal = ({ isOpen, onClose }) => {
  const { createRoom, loading } = useRoom();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    name: '',
    maxParticipants: 4
  });
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.maxParticipants < 2 || formData.maxParticipants > 10) {
      setError('Participants must be between 2 and 10');
      return;
    }

    try {
      const room = await createRoom(formData);
      onClose();
      navigate(`/room/${room.id}`);
    } catch (err) {
      setError(err.message || 'Failed to create room');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'maxParticipants' ? parseInt(value) || 2 : value
    }));
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>Create New Room</h2>
          <button 
            onClick={onClose}
            style={styles.closeButton}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>
              Room Name (Optional)
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter room name"
                style={styles.input}
                maxLength={30}
              />
            </label>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>
              Maximum Participants: {formData.maxParticipants}
              <div style={styles.sliderContainer}>
                <input
                  type="range"
                  name="maxParticipants"
                  min="2"
                  max="10"
                  value={formData.maxParticipants}
                  onChange={handleChange}
                  style={styles.slider}
                />
                <div style={styles.sliderLabels}>
                  <span>2</span>
                  <span>10</span>
                </div>
              </div>
              <div style={styles.participantHint}>
                {formData.maxParticipants === 10 
                  ? 'Max capacity (10 participants)' 
                  : `${formData.maxParticipants} participants maximum`
                }
              </div>
            </label>
          </div>

          {error && (
            <div style={styles.error}>
              {error}
            </div>
          )}

          <div style={styles.buttonGroup}>
            <button
              type="button"
              onClick={onClose}
              style={styles.cancelButton}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={styles.createButton}
              disabled={loading}
            >
              {loading ? (
                <>
                  <div style={styles.spinner}></div>
                  Creating...
                </>
              ) : (
                'Create Room'
              )}
            </button>
          </div>
        </form>

        <div style={styles.note}>
          <p style={styles.noteText}>
            <strong>Note:</strong> You'll become the host of this room. 
            You can invite others using the room code that will be generated.
          </p>
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)'
  },
  modal: {
    backgroundColor: 'var(--bg-card)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-medium)',
    width: '90%',
    maxWidth: '500px',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: 'var(--shadow-xl)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 'var(--space-lg)',
    borderBottom: '1px solid var(--border-light)'
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: '600',
    color: 'var(--text-light)',
    margin: 0
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '2rem',
    color: 'var(--text-gray)',
    cursor: 'pointer',
    padding: '0',
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    transition: 'all 0.2s ease'
  },
  closeButtonHover: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)'
  },
  form: {
    padding: 'var(--space-lg)'
  },
  formGroup: {
    marginBottom: 'var(--space-lg)'
  },
  label: {
    display: 'block',
    color: 'var(--text-light)',
    marginBottom: 'var(--space-sm)',
    fontSize: '0.95rem',
    fontWeight: '500'
  },
  input: {
    width: '100%',
    padding: 'var(--space-sm)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid var(--border-light)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-light)',
    fontSize: '1rem',
    marginTop: 'var(--space-xs)',
    transition: 'all 0.2s ease'
  },
  sliderContainer: {
    marginTop: 'var(--space-sm)'
  },
  slider: {
    width: '100%',
    height: '6px',
    borderRadius: '3px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    outline: 'none',
    opacity: '0.7',
    transition: 'opacity 0.2s',
    WebkitAppearance: 'none'
  },
  sliderHover: {
    opacity: 1
  },
  sliderLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: 'var(--space-xs)',
    color: 'var(--text-gray)',
    fontSize: '0.9rem'
  },
  participantHint: {
    marginTop: 'var(--space-xs)',
    color: 'var(--accent-blue)',
    fontSize: '0.9rem',
    fontStyle: 'italic'
  },
  error: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    color: '#f87171',
    padding: 'var(--space-sm)',
    borderRadius: 'var(--radius-md)',
    marginBottom: 'var(--space-md)',
    fontSize: '0.9rem'
  },
  buttonGroup: {
    display: 'flex',
    gap: 'var(--space-md)',
    marginTop: 'var(--space-xl)'
  },
  cancelButton: {
    flex: 1,
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
  cancelButtonHover: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)'
  },
  createButton: {
    flex: 2,
    padding: 'var(--space-md)',
    background: 'linear-gradient(135deg, var(--primary-purple), var(--primary-indigo))',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    color: 'white',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-sm)',
    transition: 'all 0.2s ease'
  },
  createButtonHover: {
    transform: 'translateY(-2px)',
    boxShadow: 'var(--shadow-md)'
  },
  spinner: {
    width: '20px',
    height: '20px',
    border: '2px solid rgba(255, 255, 255, 0.3)',
    borderTopColor: 'white',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  note: {
    padding: 'var(--space-lg)',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderTop: '1px solid rgba(59, 130, 246, 0.3)',
    borderBottomLeftRadius: 'var(--radius-lg)',
    borderBottomRightRadius: 'var(--radius-lg)'
  },
  noteText: {
    margin: 0,
    color: '#93c5fd',
    fontSize: '0.9rem',
    lineHeight: 1.5
  }
};

export default CreateRoomModal;