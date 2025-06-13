import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import './AuthCallback.css';

const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { updateUser } = useAuth();
  const callbackProcessed = useRef(false);

  useEffect(() => {
    const handleCallback = async () => {
      // Prevent double processing
      if (callbackProcessed.current) {
        return;
      }
      callbackProcessed.current = true;

      try {
        // Get the authorization code from URL parameters
        const urlParams = new URLSearchParams(location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');

        if (!code) {
          console.error('No authorization code found in URL');
          navigate('/?error=no_code');
          return;
        }

        console.log('Processing Google callback...');
        
        // Exchange the code for tokens
        const response = await axios.get(`https://backend-empty-fire-4935.fly.dev/auth/google/callback?code=${code}&state=${state}`);
        const data = response.data;

        console.log('Successfully received tokens');

        // Store the user data and tokens in localStorage
        const userData = {
          email: data.email,
          name: data.name,
          picture: data.picture
        };
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('access_token', data.access_token);

        // Update auth context
        updateUser(userData);

        // Show success message
        console.log('Successfully authenticated:', data.email);

        // Redirect to home page or dashboard
        navigate('/', { replace: true });
      } catch (error) {
        console.error('Error processing authentication:', error.response?.data?.detail || error.message);
        navigate('/?error=auth_failed', { replace: true });
      }
    };

    handleCallback();
  }, [navigate, location, updateUser]);

  return (
    <div className="auth-callback">
      <div className="loading-spinner"></div>
      <p>Completing sign in...</p>
    </div>
  );
};

export default AuthCallback; 