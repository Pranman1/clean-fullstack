import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = 'http://localhost:8000';

// Helper function to get truck type label
const getTruckTypeLabel = (type) => {
  const truckTypes = {
    "V": "Van",
    "SV": "Box Truck",
    "F": "Flatbed",
    "R": "Reefer",
    "SD": "Step Deck",
    "DD": "Double Drop",
    "LB": "Lowboy",
    "RGN": "Removable Gooseneck",
    "TNK": "Tanker",
    "AC": "Auto Carrier",
    "CONT": "Container",
    "DT": "Dump Truck",
    "HB": "Hopper Bottom",
    "PO": "Power Only"
  };
  return truckTypes[type] || type;
};

// Helper function to format distance
const getDistance = (load) => {
  if (load.distance) {
    return `${Math.round(load.distance).toLocaleString()} miles`;
  }
  if (load.length) {
    return `${Math.round(load.length).toLocaleString()} miles`;
  }
  return 'Distance unknown';
};

function formatCurrency(amount) {
  if (isNaN(amount)) return 'N/A';
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

const SavedLoads = () => {
  const navigate = useNavigate();
  const [savedLoads, setSavedLoads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [showReturn, setShowReturn] = useState({});

  useEffect(() => {
    fetchSavedLoads();
  }, []);

  const fetchSavedLoads = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(`${API_URL}/loads/saved`);
      setSavedLoads(response.data);
    } catch (err) {
      console.error('Error fetching saved loads:', err);
      setError('Failed to load saved loads. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLoad = async (load) => {
    if (!window.confirm('Are you sure you want to delete this saved load?')) return;

    try {
      setDeletingId(load.entry_id);

      await axios.delete(`${API_URL}/loads/${load.entry_id}`);

      // Remove from state
      setSavedLoads(savedLoads.filter(l => l.entry_id !== load.entry_id));
    } catch (err) {
      console.error('Error deleting load:', err);
      alert('Failed to delete load. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDiscussLoad = (load) => {
    // Store the selected load in session storage
    sessionStorage.setItem('selectedLoad', JSON.stringify(load));
    // Navigate to the AI Assistant page
    navigate('/ai-assistant');
  };

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '50px 0' }}>
      <i className="fas fa-truck fa-spin" style={{ fontSize: '3rem', color: 'var(--primary)', marginBottom: '20px' }}></i>
      <p>Loading your saved loads...</p>
    </div>
  );

  if (error) return (
    <div style={{
      color: 'var(--danger)',
      padding: '20px',
      border: '1px solid var(--danger)',
      borderRadius: '8px',
      textAlign: 'center'
    }}>
      <i className="fas fa-exclamation-triangle" style={{ fontSize: '2rem', marginBottom: '10px' }}></i>
      <p>{error}</p>
    </div>
  );

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <i className="fas fa-bookmark" style={{ fontSize: '2rem', color: 'var(--secondary)' }}></i>
          <h2>SAVED LOADS</h2>
        </div>

        <Link to="/load-search">
          <button style={{
            backgroundColor: 'var(--primary)',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 16px',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer'
          }}>
            <i className="fas fa-search"></i>
            Find New Loads
          </button>
        </Link>
      </div>

      <p style={{ color: 'var(--text)', marginBottom: '20px' }}>
        <i className="fas fa-info-circle" style={{ marginRight: '8px' }}></i>
        You have {savedLoads.length} saved load(s)
      </p>

      {savedLoads.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '50px 0',
          backgroundColor: 'var(--surface)',
          color: 'var(--text)',
          borderRadius: '8px',
          boxShadow: 'var(--shadow)'
        }}>
          <i className="fas fa-folder-open" style={{
            fontSize: '3rem',
            color: 'var(--muted)',
            marginBottom: '20px',
            opacity: 0.5
          }}></i>
          <h3 style={{ color: 'var(--primary)', marginBottom: '20px' }}>
            No saved loads yet
          </h3>
          <p style={{ color: 'var(--text)', marginBottom: '20px' }}>
            When you find loads you want to keep, save them here for easy access.
          </p>
          <Link to="/load-search">
            <button style={{ backgroundColor: 'var(--primary)' }}>
              <i className="fas fa-search"></i> Search for Loads
            </button>
          </Link>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
          gap: '20px'
        }}>
          {savedLoads.map((load) => {
            const isPair = load.is_pair && load.child;
            const isShowingReturn = showReturn[load.entry_id];
            const displayLoad = isPair && isShowingReturn ? load.child : load;

            return (
              <div
                key={load.entry_id}
                style={{
                  backgroundColor: 'var(--surface)',
                  borderRadius: '8px',
                  boxShadow: 'var(--shadow)',
                  overflow: 'hidden',
                  border: '1px solid var(--chrome)'
                }}
              >
                {/* Header with route info */}
                <div style={{
                  backgroundColor: load.is_pair ? 'var(--accent-purple)' : 'var(--primary)',
                  color: 'var(--text-inverse)',
                  padding: '15px',
                  position: 'relative'
                }}>
                  {/* API Source Badge */}
                  <div style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    backgroundColor: load.data_source === 'truckstop' ? 'var(--accent-green)' : 'var(--accent-blue)',
                    color: 'white'
                  }}>
                    <i className={`fas ${load.data_source === 'truckstop' ? 'fa-truck' : 'fa-cloud'}`} style={{ marginRight: '5px' }}></i>
                    {load.data_source === 'truckstop' ? 'Truckstop' : 'Direct Freight'}
                  </div>

                  <div style={{ marginBottom: '5px' }}>
                    <h3 style={{
                      margin: '0',
                      fontSize: '18px',
                      paddingRight: '100px'
                    }}>
                      {displayLoad.origin_city}, {displayLoad.origin_state} → {displayLoad.destination_city}, {displayLoad.destination_state}
                    </h3>
                  </div>

                  <div style={{
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '15px'
                  }}>
                    <span>
                      <i className="far fa-calendar-alt" style={{ marginRight: '5px' }}></i>
                      Ship Date: {new Date(displayLoad.ship_date).toLocaleDateString()}
                    </span>
                    <span>
                      <i className="fas fa-route" style={{ marginRight: '5px' }}></i>
                      {getDistance(displayLoad)}
                    </span>
                  </div>
                </div>

                {/* Load details */}
                <div style={{ padding: '15px', color: 'var(--text)' }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '15px',
                    marginBottom: '15px'
                  }}>
                    <div>
                      <h6 style={{
                        marginBottom: '8px',
                        fontSize: '0.9rem',
                        textTransform: 'uppercase',
                        fontWeight: '600'
                      }}>Load Details</h6>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <p style={{ margin: 0 }}><strong>Phone:</strong> {displayLoad.phone_number || 'Not specified'}</p>
                        <p style={{ margin: 0 }}><strong>Equipment:</strong> {getTruckTypeLabel(displayLoad.equipment_type || displayLoad.truck_type)}</p>
                        <p style={{ margin: 0 }}><strong>Weight:</strong> {displayLoad.weight ? `${Math.round(displayLoad.weight).toLocaleString()} lbs` : 'Not specified'}</p>
                        <p style={{ margin: 0 }}><strong>Rate:</strong> {displayLoad.rate_per_mile_est ? `$${displayLoad.rate_per_mile_est.toFixed(2)}/mi` : 'Not specified'}</p>
                      </div>
                    </div>
                    <div>
                      <h6 style={{
                        marginBottom: '8px',
                        fontSize: '0.9rem',
                        textTransform: 'uppercase',
                        fontWeight: '600'
                      }}>Value</h6>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <p style={{ margin: 0 }}><strong>Distance:</strong> {getDistance(displayLoad)}</p>
                        <p style={{ margin: 0 }}>
                          <strong>Total:</strong> {displayLoad.rate_per_mile_est && displayLoad.distance
                            ? formatCurrency(displayLoad.rate_per_mile_est * displayLoad.distance)
                            : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{
                    display: 'flex',
                    gap: '10px',
                    justifyContent: 'flex-end',
                    borderTop: '1px solid var(--chrome)',
                    paddingTop: '15px'
                  }}>
                    {isPair && (
                      <button
                        style={{ backgroundColor: 'var(--accent-purple)', color: 'white', border: 'none', borderRadius: 4, padding: '6px 12px', cursor: 'pointer', fontSize: '0.8rem' }}
                        onClick={() => setShowReturn(prev => ({ ...prev, [load.entry_id]: !prev[load.entry_id] }))}
                      >
                        {isShowingReturn ? 'Show Outbound Load' : 'Show Return Load'}
                      </button>
                    )}
                    {/* <button
                      onClick={() => handleDiscussLoad(displayLoad)}
                      style={{
                        backgroundColor: 'var(--secondary)',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '6px 12px',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        fontSize: '0.8rem'
                      }}
                    >
                      <i className="fas fa-comments"></i>
                      Discuss with AI
                    </button> */}
                    <button
                      onClick={() => handleDeleteLoad(displayLoad)}
                      disabled={deletingId === displayLoad.entry_id}
                      style={{
                        backgroundColor: 'var(--danger)',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '6px 12px',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: deletingId === displayLoad.entry_id ? 'not-allowed' : 'pointer',
                        fontSize: '0.8rem'
                      }}
                    >
                      {deletingId === displayLoad.entry_id ? (
                        <>
                          <i className="fas fa-spinner fa-spin"></i>
                          Deleting...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-trash"></i>
                          Delete Load
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SavedLoads; 