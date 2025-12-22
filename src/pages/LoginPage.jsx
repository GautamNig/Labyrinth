import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const LoginPage = () => {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await loginWithGoogle();
      navigate('/dashboard');
    } catch (error) {
      console.error('Login failed:', error);
      alert('Login failed. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      background: 'linear-gradient(135deg, var(--primary-darker) 0%, var(--primary-dark) 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-md)'
    }}>
      <div style={{
        background: 'var(--bg-card)',
        backdropFilter: 'blur(20px)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border-medium)',
        padding: 'var(--space-xl)',
        width: '90%',
        maxWidth: '400px',
        boxShadow: 'var(--shadow-xl)',
        margin: '0 auto'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
          <h1 style={{
            fontSize: '3rem',
            fontWeight: '700',
            background: 'linear-gradient(135deg, var(--primary-purple), var(--accent-pink))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: 'var(--space-xs)',
            letterSpacing: '1px'
          }}>
            Labyrinth
          </h1>
          <p style={{ color: 'var(--text-gray)', fontSize: '1.1rem', fontWeight: '300' }}>
            Video Chat Maze
          </p>
        </div>

        <div style={{ textAlign: 'center' }}>
          <h2 style={{
            fontSize: '1.8rem',
            fontWeight: '600',
            marginBottom: 'var(--space-sm)',
            color: 'var(--text-light)'
          }}>
            Welcome to Labyrinth
          </h2>
          <p style={{
            color: 'var(--text-gray)',
            marginBottom: 'var(--space-lg)',
            fontSize: '1rem',
            lineHeight: '1.5'
          }}>
            Enter the maze of conversations. Connect, collaborate, and converse.
          </p>

          <button
            onClick={handleGoogleLogin}
            disabled={isLoggingIn}
            style={{
              width: '100%',
              background: 'white',
              color: '#333',
              border: 'none',
              padding: 'var(--space-md)',
              borderRadius: 'var(--radius-md)',
              fontSize: '1rem',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-sm)',
              transition: 'all 0.2s ease',
              boxShadow: 'var(--shadow-md)',
              opacity: isLoggingIn ? 0.6 : 1
            }}
            onMouseOver={(e) => {
              if (!isLoggingIn) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
              }
            }}
            onMouseOut={(e) => {
              if (!isLoggingIn) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
              }
            }}
          >
            {isLoggingIn ? (
              <>
                <div style={{
                  width: '20px',
                  height: '20px',
                  border: '2px solid rgba(0, 0, 0, 0.1)',
                  borderTopColor: '#333',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          <div style={{
            marginTop: 'var(--space-lg)',
            paddingTop: 'var(--space-md)',
            borderTop: '1px solid var(--border-light)'
          }}>
            <p style={{ color: 'var(--text-gray)', fontSize: '0.9rem', lineHeight: '1.4' }}>
              By signing in, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;