import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SubscriptionSuccess() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to home after 5 seconds
    const timer = setTimeout(() => {
      navigate('/');
    }, 5000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div style={{
      minHeight: '60vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      textAlign: 'center'
    }}>
      <div style={{
        background: 'var(--background)',
        padding: '40px',
        borderRadius: '16px',
        boxShadow: 'var(--shadow)',
        maxWidth: '500px',
        width: '100%'
      }}>
        <i 
          className="fas fa-check-circle" 
          style={{ 
            color: 'var(--primary)', 
            fontSize: '64px',
            marginBottom: '24px'
          }}
        ></i>
        
        <h1 style={{
          fontSize: '32px',
          color: 'var(--text)',
          marginBottom: '16px'
        }}>
          Subscription Successful!
        </h1>
        
        <p style={{
          fontSize: '18px',
          color: 'var(--muted)',
          marginBottom: '24px'
        }}>
          Thank you for subscribing to our Premium plan. Your account has been upgraded with all premium features.
        </p>
        
        <p style={{
          fontSize: '16px',
          color: 'var(--text)'
        }}>
          You will be redirected to the homepage in a few seconds...
        </p>
      </div>
    </div>
  );
} 