import React from 'react';
import './GoogleSignIn.css';

const GoogleSignIn = () => {
  const handleGoogleLogin = async () => {
    try {
      const response = await fetch('http://localhost:8000/auth/google/login', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (data.authorization_url) {
        // Instead of displaying the URL, redirect to it
        window.location.assign(data.authorization_url);
      } else {
        console.error('No authorization URL received');
      }
    } catch (error) {
      console.error('Error initiating Google login:', error);
    }
  };

  return (
    <button 
      className="google-signin-button" 
      onClick={handleGoogleLogin}
    >
      <img 
        src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" 
        alt="Google logo" 
        className="google-logo"
      />
      Sign in with Google
    </button>
  );
};

export default GoogleSignIn; 