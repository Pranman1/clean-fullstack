import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // First check localStorage
      const savedUser = localStorage.getItem('user');
      const accessToken = localStorage.getItem('access_token');
      
      if (!accessToken) {
        clearUserData();
        setLoading(false);
        return;
      }

      // Always verify with backend
      try {
        const response = await axios.get('https://backend-empty-fire-4935.fly.dev/auth/me', {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        
        if (response.data) {
          // Update user data from backend
          const userData = {
            email: response.data.email,
            name: response.data.name,
            picture: response.data.picture
          };
          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));
        }
      } catch (error) {
        if (error.response?.status === 401) {
          clearUserData();
        }
        // For other errors, keep existing user data
        console.error('Error verifying auth:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const clearUserData = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
  };

  const logout = async () => {
    try {
      await axios.post('https://backend-empty-fire-4935.fly.dev/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearUserData();
    }
  };

  const updateUser = (userData) => {
    setUser(userData);
    if (userData) {
      localStorage.setItem('user', JSON.stringify(userData));
    } else {
      clearUserData();
    }
  };

  // Add axios interceptor to handle authentication headers
  useEffect(() => {
    const interceptor = axios.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(interceptor);
    };
  }, []);

  // Add response interceptor to handle 401 errors
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Clear user data for any 401 error
          clearUserData();
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, logout, checkAuth, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 