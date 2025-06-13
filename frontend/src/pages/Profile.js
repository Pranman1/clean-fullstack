import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import './Profile.css';

export default function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState({
    truckstop_integration_id: '',
    company_name: '',
    phone_number: '',
    mc_number: '',
    dot_number: ''
  });
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:8000/user/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setProfile(response.data);
    } catch (err) {
      console.error('Error loading profile:', err);
      setError('Failed to load profile data');
    }
  };

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSaveProfile = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:8000/user/profile', profile, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setSuccessMessage('Profile saved successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error saving profile:', err);
      setError('Failed to save profile');
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="profile-container">
      {/* User Header */}
      <div className="profile-header">
        {user?.picture && (
          <img
            src={user.picture}
            alt={user.name}
            className="profile-picture"
          />
        )}
        <div className="profile-info">
          <h1>{user?.name || 'User Profile'}</h1>
          <p>{user?.email}</p>
        </div>
      </div>

      {/* Profile Information Section */}
      <section className="profile-section">
        <div className="section-header">
          <h2>Company Information</h2>
          <p>Update your company details and integration settings</p>
        </div>
        <div className="form-container">
          <div className="form-grid">
            <div className="form-group">
              <label>Company Name</label>
              <input
                type="text"
                name="company_name"
                value={profile.company_name}
                onChange={handleProfileChange}
                className="form-input"
                placeholder="Enter company name"
              />
            </div>
            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="tel"
                name="phone_number"
                value={profile.phone_number}
                onChange={handleProfileChange}
                className="form-input"
                placeholder="(555) 555-5555"
              />
            </div>
            <div className="form-group">
              <label>MC Number</label>
              <input
                type="text"
                name="mc_number"
                value={profile.mc_number}
                onChange={handleProfileChange}
                className="form-input"
                placeholder="Enter MC number"
              />
            </div>
            <div className="form-group">
              <label>DOT Number</label>
              <input
                type="text"
                name="dot_number"
                value={profile.dot_number}
                onChange={handleProfileChange}
                className="form-input"
                placeholder="Enter DOT number"
              />
            </div>
            <div className="form-group full-width">
              <label>
                Truckstop Integration ID
                <span style={{ color: 'var(--danger)', marginLeft: '5px' }}>*</span>
                <span style={{ 
                  fontSize: '0.8rem', 
                  color: 'var(--text-muted)',
                  display: 'block',
                  marginTop: '2px'
                }}>
                  Required for using the Truckstop API to search for loads
                </span>
              </label>
              <input
                type="text"
                name="truckstop_integration_id"
                value={profile.truckstop_integration_id}
                onChange={handleProfileChange}
                className="form-input"
                placeholder="Enter your Truckstop integration ID"
                required
              />
            </div>
          </div>
          <button 
            onClick={handleSaveProfile} 
            className={`save-button ${isLoading ? 'loading' : ''}`}
            disabled={isLoading}
          >
            {isLoading ? 'Saving...' : 'Save Company Information'}
          </button>
        </div>
      </section>

      {/* Messages */}
      {successMessage && (
        <div className="success-message">
          <i className="fas fa-check-circle"></i>
          {successMessage}
        </div>
      )}
      {error && (
        <div className="error-message">
          <i className="fas fa-exclamation-circle"></i>
          {error}
        </div>
      )}
    </div>
  );
} 