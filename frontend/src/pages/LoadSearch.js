import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// List of valid truck types for dropdown
const TRUCK_TYPES = [
  { value: "V", label: "Van" },
  { value: "SV", label: "Box Truck" },
  { value: "F", label: "Flatbed" },
  { value: "R", label: "Reefer" },
  { value: "SD", label: "Step Deck" },
  { value: "DD", label: "Double Drop" },
  { value: "LB", label: "Lowboy" },
  { value: "RGN", label: "Removable Gooseneck" },
  { value: "TNK", label: "Tanker" },
  { value: "AC", label: "Auto Carrier" },
  { value: "CONT", label: "Container" },
  { value: "DT", label: "Dump Truck" },
  { value: "HB", label: "Hopper Bottom" },
  { value: "PO", label: "Power Only" }
];

// List of US states for dropdown
const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

const API_URL = 'https://backend-empty-fire-4935.fly.dev';

const LoadSearch = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    origin_city: '',
    origin_state: 'CA',
    destination_city: '',
    destination_state: '',
    max_weight: 45000,
    truck_type: 'V',
    ship_date: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
    origin_range: 50, // Default range for Truckstop
    destination_range: 50 // Default range for Truckstop
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dataSource, setDataSource] = useState('truckstop'); // Default to Truckstop
  const [userProfile, setUserProfile] = useState(null);
  const [isBackhaul, setIsBackhaul] = useState(false);
  
  // Load user profile from API
  const loadUserProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('https://backend-empty-fire-4935.fly.dev/user/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setUserProfile(response.data);
    } catch (err) {
      console.error('Error loading profile:', err);
      setError('Failed to load profile data. Please try again.');
    }
  };

  useEffect(() => {
    loadUserProfile();
  }, []);

  // Reload profile when returning from profile page
  useEffect(() => {
    const handleFocus = () => {
      loadUserProfile();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Special handling for date to ensure correct format
    if (name === 'ship_date') {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
      console.log(`Date set to: ${value}`);
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
    
    // Save integration ID to localStorage when it changes
    if (name === 'truckstop_integration_id') {
      localStorage.setItem('truckstop_integration_id', value);
    }
  };
  
  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Check if we have a user profile and integration ID for Truckstop searches
      if (dataSource === 'truckstop' && !userProfile?.truckstop_integration_id) {
        throw new Error('Please set your Truckstop integration ID in your profile settings');
      }

      const endpoint = isBackhaul ? `${API_URL}/loads/backhaul-search` : `${API_URL}/loads/truckstop-search`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          origin_city: formData.origin_city,
          origin_state: formData.origin_state,
          destination_city: formData.destination_city || undefined,  // Only include if provided
          destination_state: formData.destination_state || undefined,  // Only include if provided
          ship_date: formData.ship_date,
          max_weight: formData.max_weight,
          truck_type: formData.truck_type,
          origin_range: formData.origin_range,
          destination_range: formData.destination_range,  // Include destination range
          user_integration_id: userProfile?.truckstop_integration_id // Use ID from profile
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch loads');
      }

      const data = await response.json();
      
      if (isBackhaul) {
        navigate('/backhaul-results', { 
          state: { 
            loadPairs: data,
            searchParams: {
              origin_city: formData.origin_city,
              origin_state: formData.origin_state,
              ship_date: formData.ship_date,
              equipment_type: formData.truck_type
            }
          }
        });
      } else {
        navigate('/load-results', { 
          state: { 
            searchResults: data.loads,
            searchParams: {
              origin_city: formData.origin_city,
              origin_state: formData.origin_state,
              destination_city: formData.destination_city || undefined,
              destination_state: formData.destination_state || undefined,
              ship_date: formData.ship_date,
              equipment_type: formData.truck_type,
              data_source: 'truckstop'
            }
          }
        });
      }
    } catch (err) {
      console.error('Error fetching loads:', err);
      setError(err.message || 'Failed to fetch loads. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const toggleDataSource = () => {
    setDataSource(prev => prev === 'direct_freight' ? 'truckstop' : 'direct_freight');
    setError(null);
  };
  
  return (
    <div>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        marginBottom: '10px',
        gap: '15px',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <i className="fas fa-search" style={{ fontSize: '2rem', color: 'var(--secondary)' }}></i>
          <h2>FIND AVAILABLE LOADS</h2>
        </div>
        
        <div>
          <button 
            type="button"
            onClick={toggleDataSource}
            style={{ 
              backgroundColor: dataSource === 'truckstop' ? 'var(--success)' : 'var(--secondary)',
              border: 'none',
              borderRadius: '4px',
              padding: '8px 16px',
              color: 'white',
              fontSize: '0.9rem',
              cursor: 'pointer'
            }}
          >
            {dataSource === 'truckstop' ? (
              <>
                <i className="fas fa-truck" style={{ marginRight: '5px' }}></i>
                Using Truckstop API
              </>
            ) : (
              <>
                <i className="fas fa-cloud" style={{ marginRight: '5px' }}></i>
                Using Direct Freight API
              </>
            )}
          </button>
        </div>
      </div>
      
      {dataSource === 'truckstop' && (
        <div style={{ 
          backgroundColor: '#d1ecf1', 
          color: '#0c5460', 
          padding: '10px 15px', 
          borderRadius: '8px', 
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <i className="fas fa-info-circle"></i>
          <span>Using Truckstop API for load search. Results are from Truckstop's database.</span>
        </div>
      )}
      
      {error && (
        <div style={{ 
          backgroundColor: '#f8d7da', 
          color: '#721c24', 
          padding: '10px 15px', 
          borderRadius: '8px', 
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <i className="fas fa-exclamation-circle"></i>
          <span>{error}</span>
        </div>
      )}
        
        <form onSubmit={handleSearch} style={{ maxWidth: '800px', marginLeft: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            {/* Origin Section */}
            <div>
              <h3 style={{ marginBottom: '15px', color: 'var(--primary)' }}>
                <i className="fas fa-map-marker-alt" style={{ marginRight: '10px' }}></i>
                ORIGIN
              </h3>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px',
                  color: 'var(--dark)', 
                  fontWeight: 'bold',
                  fontSize: '0.9rem'
                }}>
                  City:
                </label>
                <input
                  type="text"
                  name="origin_city"
                  placeholder="e.g. Los Angeles"
                  value={formData.origin_city}
                  onChange={handleChange}
                  style={{ width: '100%' }}
                  required
                />
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px',
                  color: 'var(--dark)', 
                  fontWeight: 'bold',
                  fontSize: '0.9rem'
                }}>
                  State:
                </label>
                <select
                  name="origin_state"
                  value={formData.origin_state}
                  onChange={handleChange}
                  style={{ width: '100%' }}
                  required
                >
                  {US_STATES.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
            </div>
            
            {dataSource === 'truckstop' && (
              <div style={{ marginBottom: '15px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px',
                  color: 'var(--dark)', 
                  fontWeight: 'bold',
                  fontSize: '0.9rem'
                }}>
                  Range (miles):
                </label>
                <input
                  type="number"
                  name="origin_range"
                  min="0"
                  max="1000"
                  step="10"
                  value={formData.origin_range}
                  onChange={handleChange}
                  style={{ width: '100%' }}
                  required
                />
              </div>
            )}
          </div>
          
          {/* Destination Section */}
          <div>
            <h3 style={{ marginBottom: '15px', color: 'var(--primary)' }}>
              <i className="fas fa-flag-checkered" style={{ marginRight: '10px' }}></i>
              DESTINATION
            </h3>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px',
                color: 'var(--dark)', 
                fontWeight: 'bold',
                fontSize: '0.9rem'
              }}>
                City:
              </label>
              <input
                type="text"
                name="destination_city"
                placeholder="e.g. Chicago (Optional)"
                value={formData.destination_city}
                onChange={handleChange}
                style={{ width: '100%' }}
                />
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px',
                  color: 'var(--dark)', 
                  fontWeight: 'bold',
                  fontSize: '0.9rem'
                }}>
                  State:
                </label>
                <select
                  name="destination_state"
                  value={formData.destination_state}
                  onChange={handleChange}
                  style={{ width: '100%' }}
                >
                  <option value="">Any State</option>
                  {US_STATES.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>

            {dataSource === 'truckstop' && (
              <div style={{ marginBottom: '15px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px',
                  color: 'var(--dark)', 
                  fontWeight: 'bold',
                  fontSize: '0.9rem'
                }}>
                  Range (miles):
                </label>
                <input
                  type="number"
                  name="destination_range"
                  min="0"
                  max="1000"
                  step="10"
                  value={formData.destination_range}
                  onChange={handleChange}
                  style={{ width: '100%' }}
                  required
                />
              </div>
            )}
            </div>
          </div>
          
          {/* Vehicle Details */}
        <div>
            <h3 style={{ marginBottom: '15px', color: 'var(--primary)' }}>
              <i className="fas fa-truck" style={{ marginRight: '10px' }}></i>
              VEHICLE DETAILS
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px',
                  color: 'var(--dark)', 
                  fontWeight: 'bold',
                  fontSize: '0.9rem'
                }}>
                  Truck Type:
                </label>
                <select
                  name="truck_type"
                  value={formData.truck_type}
                  onChange={handleChange}
                  style={{ width: '100%' }}
                  required
                >
                  {TRUCK_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              
            {dataSource === 'direct_freight' && (
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px',
                  color: 'var(--dark)', 
                  fontWeight: 'bold',
                  fontSize: '0.9rem'
                }}>
                  Max Weight (lbs):
                </label>
                <input
                  type="number"
                  name="max_weight"
                  min="1000"
                  max="80000"
                  step="1000"
                  value={formData.max_weight}
                  onChange={handleChange}
                  style={{ width: '100%' }}
                  required
                />
              </div>
            )}
              
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px',
                  color: 'var(--dark)', 
                  fontWeight: 'bold',
                  fontSize: '0.9rem'
                }}>
                  Ship Date:
                </label>
                <input
                  type="date"
                  name="ship_date"
                  value={formData.ship_date}
                  onChange={handleChange}
                  style={{ width: '100%' }}
                  required
                />
              </div>
            </div>
          </div>
          
        {/* Data Source Selection */}
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ marginBottom: '15px', color: 'var(--primary)' }}>
            <i className="fas fa-database" style={{ marginRight: '10px' }}></i>
            DATA SOURCE
          </h3>
          <div style={{ display: 'flex', gap: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="data_source"
                value="truckstop"
                checked={dataSource === 'truckstop'}
                onChange={(e) => setDataSource(e.target.value)}
              />
              Truckstop
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="data_source"
                value="direct_freight"
                checked={dataSource === 'direct_freight'}
                onChange={(e) => setDataSource(e.target.value)}
              />
              Direct Freight
            </label>
          </div>
          
          {/* Show message if Truckstop is selected but no integration ID is set */}
          {dataSource === 'truckstop' && !userProfile?.truckstop_integration_id && (
            <div style={{ 
              marginTop: '15px',
              padding: '10px',
              backgroundColor: '#fff3cd',
              color: '#856404',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <i className="fas fa-exclamation-triangle"></i>
              <div>
                <span>Please set your Truckstop integration ID in your profile settings to use Truckstop API. </span>
                <button
                  onClick={() => navigate('/profile')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#856404',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    padding: 0,
                    font: 'inherit'
                  }}
                >
                  Go to Profile Settings
                </button>
              </div>
            </div>
          )}
        </div>
        
        <div className="form-group" style={{ marginBottom: '20px' }}>
          <label className="toggle-container" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={isBackhaul}
              onChange={(e) => setIsBackhaul(e.target.checked)}
              style={{ margin: 0 }}
            />
            <span style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px'
            }}>
              <i className="fas fa-exchange-alt"></i>
              Enable Backhaul Search
            </span>
          </label>
          {isBackhaul && (
            <p style={{ 
              marginTop: '8px',
              fontSize: '0.9rem',
              color: 'var(--text-muted)'
            }}>
              <i className="fas fa-info-circle" style={{ marginRight: '5px' }}></i>
              Will find the best return loads for the next day
            </p>
          )}
        </div>
        
        <div className="truck-divider" style={{ margin: '30px 0' }}></div>
          
          <div style={{ textAlign: 'center' }}>
            <button 
              type="submit" 
            className="search-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  Searching...
                </>
              ) : (
                <>
                  <i className="fas fa-search"></i>
                  {isBackhaul ? 'Find Load Pairs' : 'Find Available Loads'}
                </>
              )}
            </button>
          </div>
        </form>
    </div>
  );
};

export default LoadSearch; 