import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import GoogleSignIn from './GoogleSignIn';

const navLinks = [
  { to: '/load-search', label: 'Find Loads', icon: 'fas fa-search' },
  { to: '/saved-loads', label: 'Saved Loads', icon: 'fas fa-bookmark' },
  { to: '/booked-loads', label: 'Booked Loads', icon: 'fas fa-truck-loading' },
  { to: '/trip-planner', label: 'Trip Planner', icon: 'fas fa-route' },
  { to: '/ai-assistant', label: 'AI Assistant', icon: 'fas fa-robot' },
  { to: '/ai-voice-agent', label: 'AI Voice Agent', icon: 'fas fa-phone' },
  { to: '/pricing', label: 'Pricing', icon: 'fas fa-tag' },
];

export default function CinesisHeader({ theme, onToggleTheme }) {
  const location = useLocation();
  const { user, loading, logout } = useAuth();

  return (
    <header style={{
      background: 'var(--surface)',
      color: 'var(--text)',
      padding: '18px 32px 0 32px',
      boxShadow: 'var(--shadow)',
      borderBottom: '2px solid var(--chrome)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        {/* Cinesis Cube Logo SVG */}
        <svg width="38" height="38" viewBox="0 0 100 100" style={{ background: 'transparent' }}>
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
        <h1 style={{ fontWeight: 700, fontSize: 28, margin: 0, color: 'var(--text)' }}>Cinesis</h1>
        <span style={{ color: 'var(--muted)', fontSize: 16, fontWeight: 400, marginLeft: 12 }}>
          Reinventing the Business of Trucking
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center' }}>
          {!loading && (
            user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Link 
                  to="/profile" 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px',
                    textDecoration: 'none',
                    color: 'var(--text)'
                  }}
                >
                  {user.picture && (
                    <img 
                      src={user.picture} 
                      alt={user.name} 
                      style={{ 
                        width: 32, 
                        height: 32, 
                        borderRadius: '50%',
                        border: '2px solid var(--primary)'
                      }} 
                    />
                  )}
                  <span style={{ color: 'var(--text)' }}>{user.name}</span>
                </Link>
                <button
                  onClick={logout}
                  style={{
                    background: 'var(--danger)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 600
                  }}
                >
                  <i className="fas fa-sign-out-alt"></i>
                  Logout
                </button>
              </div>
            ) : (
              <GoogleSignIn />
            )
          )}
          <button
            onClick={onToggleTheme}
            style={{
              background: 'none',
              color: 'var(--primary)',
              border: '2px solid var(--primary)',
              borderRadius: '50%',
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 20,
              padding: 0
            }}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <span role="img" aria-label="Light mode">🌞</span> : <span role="img" aria-label="Dark mode">🌙</span>}
          </button>
        </div>
      </div>
      <nav style={{ marginTop: 18, marginBottom: 8 }}>
        <ul style={{
          display: 'flex',
          gap: 24,
          listStyle: 'none',
          padding: 0,
          margin: 0
        }}>
          {navLinks.map(link => (
            <li key={link.to}>
              <Link
                to={link.to}
                className={location.pathname === link.to ? 'nav-link-active' : ''}
                style={{
                  color: 'var(--text)',
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: 17,
                  padding: '8px 14px',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'background 0.2s, color 0.2s'
                }}
              >
                <i className={link.icon}></i> {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
} 