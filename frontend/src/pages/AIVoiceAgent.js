import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AIVoiceAgent.css';
import { useNavigate } from 'react-router-dom';

const AIVoiceAgent = () => {
  const [preferences, setPreferences] = useState({
    is_active: false,
    phone_number: '',
    truck_type: 'V',
    origin_city: '',
    origin_state: '',
    min_rate_per_mile: 0,
    max_deadhead: 0,
    user_id: JSON.parse(localStorage.getItem('user'))?.email || ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  
  // Load existing preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get('https://backend-empty-fire-4935.fly.dev/voice-preferences', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        // Ensure we have the current user_id in the loaded preferences
        const userData = JSON.parse(localStorage.getItem('user'));
        setPreferences({
          ...response.data,
          user_id: userData?.email || ''
        });
      } catch (err) {
        console.error('Failed to load preferences:', err);
      }
    };
    loadPreferences();
  }, []);

  const validateForm = () => {
    // Only validate user-fillable required fields
    const requiredFields = ['phone_number', 'truck_type', 'origin_city', 'origin_state'];
    const emptyFields = requiredFields.filter(field => !preferences[field]);
    
    // Check user_id separately since it's not user-fillable
    if (!preferences.user_id) {
      setError('User ID not found. Please try logging in again.');
      return false;
    }
    
    if (emptyFields.length > 0) {
      setError(`Please fill in all required fields: ${emptyFields.join(', ').replace(/_/g, ' ')}`);
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    // Validate form before submitting
    if (!validateForm()) {
      setLoading(false);
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      
      await axios.post('https://backend-empty-fire-4935.fly.dev/voice-preferences', preferences, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      // Handle validation errors
      if (err.response?.data?.detail) {
        if (Array.isArray(err.response.data.detail)) {
          setError(err.response.data.detail.map(error => error.msg).join(', '));
        } else if (typeof err.response.data.detail === 'object') {
          setError(Object.values(err.response.data.detail).join(', '));
        } else {
          setError(err.response.data.detail);
        }
      } else {
        setError('Failed to save preferences');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setPreferences(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? parseFloat(value) || 0 : value
    }));
    // Clear error when user starts typing
    if (error) setError(null);
  };

  return (
    <div className="ai-voice-container">
      <div className="hero-section">
        <h1>Cinesis AI Load Finder</h1>
        <p>Set up automated load notifications tailored to your preferences</p>
      </div>

      <div className="main-content">
        <div className="preferences-form-container">
          <div className="form-header">
            <h2>Load Search Preferences</h2>
            <p>We'll automatically search and notify you about matching loads</p>
          </div>

          <form onSubmit={handleSubmit} className="preferences-form">
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={preferences.is_active}
                  onChange={handleChange}
                />
                Enable Automated Load Notifications
              </label>
            </div>

            <div className="form-group">
              <label htmlFor="phone_number">Phone Number</label>
              <div className="input-with-icon">
                <i className="fas fa-phone"></i>
                <input
                  id="phone_number"
                  name="phone_number"
                  type="tel"
                  value={preferences.phone_number}
                  onChange={handleChange}
                  placeholder="(555) 555-5555"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="truck_type">Truck Type</label>
              <div className="input-with-icon">
                <i className="fas fa-truck"></i>
                <select
                  id="truck_type"
                  name="truck_type"
                  value={preferences.truck_type}
                  onChange={handleChange}
                >
                  <option value="V">Van</option>
                  <option value="F">Flatbed</option>
                  <option value="R">Reefer</option>
                  <option value="SD">Step Deck</option>
                  <option value="DD">Double Drop</option>
                  <option value="LB">Lowboy</option>
                  <option value="RGN">RGN</option>
                  <option value="TNK">Tanker</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="origin_city">Origin City</label>
              <div className="input-with-icon">
                <i className="fas fa-city"></i>
                <input
                  id="origin_city"
                  name="origin_city"
                  type="text"
                  value={preferences.origin_city}
                  onChange={handleChange}
                  placeholder="Enter city"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="origin_state">Origin State</label>
              <div className="input-with-icon">
                <i className="fas fa-map"></i>
                <input
                  id="origin_state"
                  name="origin_state"
                  type="text"
                  value={preferences.origin_state}
                  onChange={handleChange}
                  placeholder="Enter state (e.g., CA)"
                  required
                  maxLength="2"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="min_rate_per_mile">Minimum Rate per Mile ($)</label>
              <div className="input-with-icon">
                <i className="fas fa-dollar-sign"></i>
                <input
                  id="min_rate_per_mile"
                  name="min_rate_per_mile"
                  type="number"
                  step="0.1"
                  value={preferences.min_rate_per_mile}
                  onChange={handleChange}
                  placeholder="Enter minimum rate"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="max_deadhead">Maximum Deadhead (miles)</label>
              <div className="input-with-icon">
                <i className="fas fa-road"></i>
                <input
                  id="max_deadhead"
                  name="max_deadhead"
                  type="number"
                  value={preferences.max_deadhead}
                  onChange={handleChange}
                  placeholder="Enter max deadhead"
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="submit-button"
            >
              {loading ? 'Saving...' : 'Save Preferences'}
            </button>

            {error && (
              <div className="error-message">
                <i className="fas fa-exclamation-circle"></i>
                {error}
              </div>
            )}

            {success && (
              <div className="success-message">
                <i className="fas fa-check-circle"></i>
                Preferences saved successfully!
              </div>
            )}
          </form>
        </div>

        <div className="info-section">
          <h3>How It Works</h3>
          <div className="info-cards">
            <div className="info-card">
              <div className="info-icon">
                <i className="fas fa-robot"></i>
              </div>
              <h4>AI-Powered Search</h4>
              <p>Our AI continuously searches for loads matching your preferences</p>
            </div>
            <div className="info-card">
              <div className="info-icon">
                <i className="fas fa-phone-alt"></i>
              </div>
              <h4>Instant Notifications</h4>
              <p>Receive voice calls about matching loads as soon as they're available</p>
            </div>
            <div className="info-card">
              <div className="info-icon">
                <i className="fas fa-sliders-h"></i>
              </div>
              <h4>Customizable Settings</h4>
              <p>Fine-tune your preferences to get the most relevant load notifications</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIVoiceAgent; 