import React, { useState, useEffect } from 'react';
import './LoadTripPlanner.css';
import TruckAnimation from '../components/TruckAnimation';
import axios from 'axios';

const STORAGE_KEY = 'loadTripPlanner';

const SummaryCard = ({ icon, title, value }) => (
  <div style={{
    backgroundColor: 'var(--surface)',
    borderRadius: '8px',
    padding: '20px',
    textAlign: 'center',
    border: '1px solid var(--border)',
    transition: 'transform 0.2s ease',
    ':hover': {
      transform: 'translateY(-2px)'
    }
  }}>
    <i className={`fas ${icon}`} style={{
      fontSize: '24px',
      color: 'var(--primary)',
      marginBottom: '12px'
    }}></i>
    <h4 style={{
      margin: '8px 0',
      color: 'var(--text-muted)',
      fontSize: '14px',
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    }}>{title}</h4>
    <p style={{
      margin: 0,
      color: 'var(--text)',
      fontSize: '20px',
      fontWeight: '600'
    }}>{value}</p>
  </div>
);

const RouteSegment = ({ segment, index }) => {
  const isDeadhead = segment.is_deadhead;
  
  return (
    <div className="route-segment" style={{
      backgroundColor: 'var(--surface)',
      borderRadius: '8px',
      padding: '20px',
      marginBottom: '16px',
      border: '1px solid var(--border)',
      borderLeft: `4px solid ${isDeadhead ? '#e74c3c' : '#2ecc71'}`
    }}>
      <div className="segment-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px'
      }}>
        <h3 style={{
          margin: 0,
          fontSize: '18px',
          color: 'var(--text)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {isDeadhead ? (
            <>
              <i className="fas fa-truck" style={{ color: '#e74c3c' }}></i>
              Deadhead Move
            </>
          ) : (
            <>
              <i className="fas fa-box" style={{ color: '#2ecc71' }}></i>
              Load #{index + 1}
            </>
          )}
        </h3>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          {segment.ship_date}
        </div>
      </div>

      <div className="segment-route" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '12px'
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: '4px' }}>
            <i className="fas fa-map-marker-alt" style={{ marginRight: '8px', color: '#4a90e2' }}></i>
            {segment.origin_city}, {segment.origin_state}
          </div>
          <div>
            <i className="fas fa-flag-checkered" style={{ marginRight: '8px', color: '#4a90e2' }}></i>
            {segment.destination_city}, {segment.destination_state}
          </div>
        </div>
        
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '4px'
        }}>
          <div>
            <strong>{Math.round(segment.distance)} miles</strong>
          </div>
          {!isDeadhead && (
            <div style={{ color: '#2ecc71' }}>
              ${segment.rate_per_mile_est ? segment.rate_per_mile_est.toFixed(2) : '0.00'}/mile
            </div>
          )}
        </div>
      </div>

      {!isDeadhead && (
        <div className="segment-details" style={{
          display: 'flex',
          gap: '24px',
          fontSize: '0.9rem',
          color: 'var(--text-muted)',
          borderTop: '1px solid var(--border)',
          paddingTop: '12px'
        }}>
          <div>
            <i className="fas fa-weight" style={{ marginRight: '8px' }}></i>
            {segment.weight ? `${Math.round(segment.weight).toLocaleString()} lbs` : 'N/A'}
          </div>
          <div>
            <i className="fas fa-truck-loading" style={{ marginRight: '8px' }}></i>
            {segment.equipment_type || 'N/A'}
          </div>
          <div>
            <i className="fas fa-calendar-alt" style={{ marginRight: '8px' }}></i>
            Delivery: {segment.receive_date}
          </div>
        </div>
      )}
    </div>
  );
};

const LoadTripPlanner = () => {
  // Initialize state from localStorage if available
  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_form`);
    return saved ? JSON.parse(saved) : {
      origin_city: '',
      origin_state: '',
      max_loads: 3,
      truck_type: 'V',
      max_weight: 45000,
      start_date: new Date().toISOString().split('T')[0]
    };
  });

  const [planningStatus, setPlanningStatus] = useState(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_status`);
    return saved ? JSON.parse(saved) : {
      isLoading: false,
      error: null,
      route: null,
      total_revenue: 0,
      total_miles: 0,
      total_deadhead: 0,
      rate_per_mile: 0,
      total_days: 0,
      total_loads: 0
    };
  });

  const [userProfile, setUserProfile] = useState(null);

  // Load user profile to get integration ID
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get('https://backend-empty-fire-4935.fly.dev/user/profile', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setUserProfile(response.data);
      } catch (err) {
        console.error('Error loading profile:', err);
        setPlanningStatus(prev => ({
          ...prev,
          error: 'Failed to load user profile. Please try again.'
        }));
      }
    };
    loadUserProfile();
  }, []);

  // Save to localStorage whenever state changes
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_form`, JSON.stringify(formData));
  }, [formData]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_status`, JSON.stringify(planningStatus));
  }, [planningStatus]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setPlanningStatus(prev => ({ ...prev, isLoading: true, error: null }));

    // Check if we have the integration ID
    if (!userProfile?.truckstop_integration_id) {
      setPlanningStatus(prev => ({
        ...prev,
        isLoading: false,
        error: 'Truckstop integration ID is required. Please set it in your profile settings.'
      }));
      return;
    }

    try {
      const requestData = {
        start_city: formData.origin_city,
        start_state: formData.origin_state,
        start_date: formData.start_date,
        max_weight: parseInt(formData.max_weight),
        truck_types: [formData.truck_type],
        max_loads: parseInt(formData.max_loads),
        user_integration_id: userProfile.truckstop_integration_id
      };
      
      console.log("[TRIP_PLANNER] Sending request:", requestData);
      
      const token = localStorage.getItem('token');
      const response = await axios.post('https://backend-empty-fire-4935.fly.dev/trip/plan', requestData, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = response.data;
      setPlanningStatus({
        isLoading: false,
        error: null,
        route: data.route,
        total_revenue: data.total_revenue,
        total_miles: data.total_miles,
        total_deadhead: data.total_deadhead,
        rate_per_mile: data.rate_per_mile,
        total_days: data.total_days,
        total_loads: data.total_loads
      });
    } catch (error) {
      setPlanningStatus(prev => ({
        ...prev,
        isLoading: false,
        error: error.message
      }));
    }
  };

  const handleReset = () => {
    // Clear localStorage
    localStorage.removeItem(`${STORAGE_KEY}_form`);
    localStorage.removeItem(`${STORAGE_KEY}_status`);
    
    // Reset states to initial values
    setFormData({
      origin_city: '',
      origin_state: '',
      max_loads: 3,
      truck_type: 'V',
      max_weight: 45000,
      start_date: new Date().toISOString().split('T')[0]
    });
    
    setPlanningStatus({
      isLoading: false,
      error: null,
      route: null,
      total_revenue: 0,
      total_miles: 0,
      total_deadhead: 0,
      rate_per_mile: 0,
      total_days: 0,
      total_loads: 0
    });
  };

  const { total_miles, total_revenue, total_loads, total_days, rate_per_mile } = planningStatus;

  return (
    <div className="ai-voice-container">
      <div className="hero-section">
        <h1>Load Trip Planner</h1>
        <p>Plan your multi-day routes with optimized loads and minimize empty miles</p>
      </div>

      <div className="main-content trip-planner-content">
        <div className="planner-form-container">
          <form onSubmit={handleSubmit} className="planner-form">
            <div className="form-group">
              <h3>
                <i className="fas fa-map-marker-alt"></i>
                Starting Point
              </h3>
              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="origin_city">City</label>
                  <input
                    type="text"
                    id="origin_city"
                    name="origin_city"
                    value={formData.origin_city}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter city"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="origin_state">State</label>
                  <input
                    type="text"
                    id="origin_state"
                    name="origin_state"
                    value={formData.origin_state}
                    onChange={handleInputChange}
                    required
                    placeholder="2-letter state code"
                    maxLength="2"
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <h3>
                <i className="fas fa-route"></i>
                Trip Parameters
              </h3>
              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="max_loads">Number of Loads</label>
                  <input
                    type="number"
                    id="max_loads"
                    name="max_loads"
                    value={formData.max_loads}
                    onChange={handleInputChange}
                    required
                    min="1"
                    max="5"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="start_date">Start Date</label>
                  <input
                    type="date"
                    id="start_date"
                    name="start_date"
                    value={formData.start_date}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <h3>
                <i className="fas fa-truck"></i>
                Equipment Details
              </h3>
              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="truck_type">Truck Type</label>
                  <select
                    id="truck_type"
                    name="truck_type"
                    value={formData.truck_type}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="V">Van</option>
                    <option value="R">Reefer</option>
                    <option value="F">Flatbed</option>
                    <option value="SD">Step Deck</option>
                  </select>
                </div>
                <div className="form-field">
                  <label htmlFor="max_weight">Max Weight (lbs)</label>
                  <input
                    type="number"
                    id="max_weight"
                    name="max_weight"
                    value={formData.max_weight}
                    onChange={handleInputChange}
                    required
                    min="1000"
                    max="80000"
                    placeholder="Enter max weight"
                  />
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button 
                type="submit" 
                className="submit-button"
                disabled={planningStatus.isLoading}
              >
                {planningStatus.isLoading ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    Planning Route...
                  </>
                ) : (
                  <>
                    <i className="fas fa-play"></i>
                    Plan My Trip
                  </>
                )}
              </button>
              <button 
                type="button" 
                className="reset-button"
                onClick={handleReset}
              >
                <i className="fas fa-redo"></i>
                Reset
              </button>
            </div>
          </form>
        </div>

        <div className="route-results-container">
          {planningStatus.error && (
            <div className="error-message">
              <i className="fas fa-exclamation-circle"></i>
              {planningStatus.error}
            </div>
          )}

          <TruckAnimation 
            route={planningStatus.route} 
            isLoading={planningStatus.isLoading} 
          />

          {planningStatus.route && (
            <div className="route-results">
              <div className="route-info">
                <h3>Route Details</h3>
                <div style={{ color: '#666', marginBottom: '1rem', fontSize: '0.9rem' }}>
                  Note: All loads are scheduled exactly on their specified dates (no future dates included)
                </div>
              </div>
              <div className="route-summary">
                <div className="summary-card">
                  <i className="fas fa-dollar-sign"></i>
                  <h4>Revenue</h4>
                  <p>${Math.round(total_revenue).toLocaleString()}</p>
                </div>
                <div className="summary-card">
                  <i className="fas fa-road"></i>
                  <h4>Total Miles</h4>
                  <p>{Math.round(total_miles).toLocaleString()}</p>
                </div>
                <div className="summary-card">
                  <i className="fas fa-box"></i>
                  <h4>Total Loads</h4>
                  <p>{total_loads}</p>
                </div>
                <div className="summary-card">
                  <i className="fas fa-calendar-alt"></i>
                  <h4>Days</h4>
                  <p>{total_days}</p>
                </div>
                <div className="summary-card">
                  <i className="fas fa-tachometer-alt"></i>
                  <h4>Rate per Mile</h4>
                  <p>${rate_per_mile.toFixed(2)}</p>
                </div>
              </div>

              <div className="route-segments">
                {planningStatus.route.map((segment, index) => (
                  <RouteSegment key={index} segment={segment} index={index} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoadTripPlanner; 