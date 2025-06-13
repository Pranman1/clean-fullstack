import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/AuthContext';
import LoadSearch from './pages/LoadSearch';
import LoadResults from './pages/LoadResults';
import SavedLoads from './pages/SavedLoads';
import BookedLoads from './pages/BookedLoads';
import AIAssistant from './pages/AIAssistant';
import AIVoiceAgent from './pages/AIVoiceAgent';
import LoadTripPlanner from './pages/LoadTripPlanner';
import Profile from './pages/Profile';
import Pricing from './pages/Pricing';
import SubscriptionSuccess from './pages/SubscriptionSuccess';
import Login from './pages/Login';
import CinesisHeader from './components/CinesisHeader';
import AuthCallback from './components/AuthCallback';
import BackhaulResults from './pages/BackhaulResults';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import ChatBot from './components/ChatBot';

// Protected Route Component
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  return children;
}

function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  useEffect(() => {
    document.body.className = '';
    document.body.classList.add(`theme-${theme}`);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <AuthProvider>
      <div className={`theme-${theme}`} style={{ minHeight: '100vh' }}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/subscription-success" element={
            <div>
              <CinesisHeader theme={theme} onToggleTheme={handleToggleTheme} />
              <SubscriptionSuccess />
            </div>
          } />
          <Route path="/pricing" element={
            <div>
              <CinesisHeader theme={theme} onToggleTheme={handleToggleTheme} />
              <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 16px' }}>
                <Pricing />
              </div>
            </div>
          } />
          
          {/* Protected Routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <div>
                <CinesisHeader theme={theme} onToggleTheme={handleToggleTheme} />
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 16px' }}>
                  <LoadSearch />
                </div>
              </div>
            </ProtectedRoute>
          } />
          
          <Route path="/load-search" element={
            <ProtectedRoute>
              <div>
                <CinesisHeader theme={theme} onToggleTheme={handleToggleTheme} />
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 16px' }}>
                  <LoadSearch />
                </div>
              </div>
            </ProtectedRoute>
          } />
          
          <Route path="/load-results" element={
            <ProtectedRoute>
              <div>
                <CinesisHeader theme={theme} onToggleTheme={handleToggleTheme} />
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 16px' }}>
                  <LoadResults />
                </div>
              </div>
            </ProtectedRoute>
          } />
          
          <Route path="/saved-loads" element={
            <ProtectedRoute>
              <div>
                <CinesisHeader theme={theme} onToggleTheme={handleToggleTheme} />
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 16px' }}>
                  <SavedLoads />
                </div>
              </div>
            </ProtectedRoute>
          } />
          
          <Route path="/booked-loads" element={
            <ProtectedRoute>
              <div>
                <CinesisHeader theme={theme} onToggleTheme={handleToggleTheme} />
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 16px' }}>
                  <BookedLoads />
                </div>
              </div>
            </ProtectedRoute>
          } />
          
          <Route path="/ai-assistant" element={
            <ProtectedRoute>
              <div>
                <CinesisHeader theme={theme} onToggleTheme={handleToggleTheme} />
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 16px' }}>
                  <AIAssistant />
                </div>
              </div>
            </ProtectedRoute>
          } />
          
          <Route path="/ai-voice-agent" element={
            <ProtectedRoute>
              <div>
                <CinesisHeader theme={theme} onToggleTheme={handleToggleTheme} />
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 16px' }}>
                  <AIVoiceAgent />
                </div>
              </div>
            </ProtectedRoute>
          } />
          
          <Route path="/trip-planner" element={
            <ProtectedRoute>
              <div>
                <CinesisHeader theme={theme} onToggleTheme={handleToggleTheme} />
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 16px' }}>
                  <LoadTripPlanner />
                </div>
              </div>
            </ProtectedRoute>
          } />

          <Route path="/profile" element={
            <ProtectedRoute>
              <div>
                <CinesisHeader theme={theme} onToggleTheme={handleToggleTheme} />
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 16px' }}>
                  <Profile />
                </div>
              </div>
            </ProtectedRoute>
          } />
          
          <Route path="/backhaul-results"element={
            <ProtectedRoute>
              <div>
                <CinesisHeader theme={theme} onToggleTheme={handleToggleTheme} />
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 16px' }}>
                  <BackhaulResults />
                </div>
              </div>
            </ProtectedRoute>
          } />
          </Routes>
          <ChatBot />
      </div>
    </AuthProvider>
  );
}

export default App; 