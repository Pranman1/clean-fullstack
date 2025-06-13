import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import GoogleSignIn from '../components/GoogleSignIn';

export default function Login() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // If user is already logged in, redirect to home
  React.useEffect(() => {
    if (user) {
      navigate('/load-search');
    }
  }, [user, navigate]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--surface)',
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--background)',
        padding: '40px',
        borderRadius: '16px',
        boxShadow: 'var(--shadow)',
        maxWidth: '400px',
        width: '100%',
        textAlign: 'center'
      }}>
        {/* Cinesis Cube Logo SVG */}
        <svg width="80" height="80" viewBox="0 0 100 100" style={{ background: 'transparent', marginBottom: '24px' }}>
          <path
            d="M20 20 L80 20 L80 80 L20 80 Z"
            fill="none"
            stroke="var(--primary)"
            strokeWidth="8"
          />
          <path
            d="M20 20 L35 5 L95 5 L80 20 Z"
            fill="var(--primary)"
            opacity="0.8"
          />
          <path
            d="M80 20 L95 5 L95 65 L80 80 Z"
            fill="var(--primary)"
            opacity="0.6"
          />
        </svg>

        <h1 style={{ 
          fontSize: '32px', 
          marginBottom: '8px',
          color: 'var(--text)'
        }}>
          Welcome to Cinesis
        </h1>
        
        <p style={{ 
          fontSize: '16px', 
          color: 'var(--muted)',
          marginBottom: '32px'
        }}>
          Sign in to access your account
        </p>

        <div style={{ marginBottom: '24px' }}>
          <GoogleSignIn />
        </div>

        <p style={{ 
          fontSize: '14px', 
          color: 'var(--muted)',
          marginTop: '24px'
        }}>
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
} 