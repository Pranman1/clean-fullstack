import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = 'https://backend-empty-fire-4935.fly.dev';

const ProfileSettings = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    accountType: '',
    memberSince: '',
    truckstop_integration_id: '',
    loadsFound: 0,
    savedLoads: 0
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/user/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setProfile(response.data);
      setLoading(false);
    } catch (err) {
      console.error('Error loading profile:', err);
      setError('Failed to load profile data');
      setLoading(false);
    }
  };
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage('');
    setLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/user/profile`, profile, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      setSuccessMessage('Profile updated successfully');
      setTimeout(() => {
        navigate('/load-search');
      }, 1500);
    } catch (err) {
      setError('Failed to save profile');
      console.error('Error saving profile:', err);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '20px', color: '#fff' }}>
        <i className="fas fa-spinner fa-spin fa-2x"></i>
        <p>Loading profile...</p>
      </div>
    );
  }
  
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <div style={{ 
        backgroundColor: '#25262b', 
        borderRadius: '10px', 
        padding: '20px',
        marginBottom: '30px'
      }}>
        <h2 style={{ margin: '0 0 20px 0', color: '#fff' }}>PROFILE SETTINGS</h2>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '8px',
            color: '#8b949e'
          }}>
            Name
          </label>
          <input
            type="text"
            name="name"
            value={profile.name}
            onChange={handleChange}
            style={{ 
              width: '100%',
              padding: '8px 12px',
              backgroundColor: '#2d2e32',
              border: '1px solid #3f4147',
              borderRadius: '4px',
              color: '#fff',
              fontSize: '1rem'
            }}
            readOnly
          />
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '8px',
            color: '#8b949e'
          }}>
            Email
          </label>
          <input
            type="email"
            name="email"
            value={profile.email}
            onChange={handleChange}
            style={{ 
              width: '100%',
              padding: '8px 12px',
              backgroundColor: '#2d2e32',
              border: '1px solid #3f4147',
              borderRadius: '4px',
              color: '#fff',
              fontSize: '1rem'
            }}
            readOnly
          />
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '8px',
            color: '#8b949e'
          }}>
            Account Type
          </label>
          <input
            type="text"
            name="accountType"
            value={profile.accountType}
            onChange={handleChange}
            style={{ 
              width: '100%',
              padding: '8px 12px',
              backgroundColor: '#2d2e32',
              border: '1px solid #3f4147',
              borderRadius: '4px',
              color: '#fff',
              fontSize: '1rem'
            }}
            readOnly
          />
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '8px',
            color: '#8b949e'
          }}>
            Member Since
          </label>
          <input
            type="text"
            name="memberSince"
            value={profile.memberSince}
            onChange={handleChange}
            style={{ 
              width: '100%',
              padding: '8px 12px',
              backgroundColor: '#2d2e32',
              border: '1px solid #3f4147',
              borderRadius: '4px',
              color: '#fff',
              fontSize: '1rem'
            }}
            readOnly
          />
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '8px',
            color: '#8b949e'
          }}>
            Truckstop Integration ID
            <span style={{ color: '#e74c3c', marginLeft: '5px' }}>*</span>
          </label>
          <input
            type="text"
            name="truckstop_integration_id"
            value={profile.truckstop_integration_id || ''}
            onChange={handleChange}
            placeholder="Enter your Truckstop Integration ID"
            style={{ 
              width: '100%',
              padding: '8px 12px',
              backgroundColor: '#2d2e32',
              border: '1px solid #3f4147',
              borderRadius: '4px',
              color: '#fff',
              fontSize: '1rem'
            }}
          />
          <small style={{ display: 'block', marginTop: '4px', color: '#8b949e' }}>
            Required for using Truckstop API to search loads
          </small>
        </div>

        <button 
          onClick={handleSubmit}
          style={{
            backgroundColor: '#4a90e2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '10px 20px',
            fontSize: '1rem',
            cursor: 'pointer',
            width: '100%',
            marginTop: '20px'
          }}
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </button>

        {error && (
          <div style={{ 
            marginTop: '20px',
            padding: '10px',
            backgroundColor: '#442222',
            color: '#ff4444',
            borderRadius: '4px',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        {successMessage && (
          <div style={{ 
            marginTop: '20px',
            padding: '10px',
            backgroundColor: '#224422',
            color: '#44ff44',
            borderRadius: '4px',
            textAlign: 'center'
          }}>
            {successMessage}
          </div>
        )}
      </div>

      <div style={{ 
        backgroundColor: '#25262b', 
        borderRadius: '10px', 
        padding: '20px',
        marginBottom: '30px'
      }}>
        <h2 style={{ margin: '0 0 20px 0', color: '#fff' }}>ACTIVITY OVERVIEW</h2>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: '20px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ color: '#8b949e', margin: '0 0 10px 0' }}>LOADS FOUND</h3>
            <div style={{ fontSize: '2.5rem', color: '#4a90e2' }}>{profile.loadsFound}</div>
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ color: '#8b949e', margin: '0 0 10px 0' }}>SAVED LOADS</h3>
            <div style={{ fontSize: '2.5rem', color: '#4a90e2' }}>{profile.savedLoads}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSettings; 