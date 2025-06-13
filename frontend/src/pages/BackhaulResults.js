import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import truckstopLogo from '../assets/truckstop-logo.png';
import { API_URL } from '../config';
// Helper function to format currency
const formatCurrency = (amount) => {
  if (!amount) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

// Helper function to format miles
const formatMiles = (miles) => {
  if (!miles) return 'N/A';
  return `${Math.round(miles).toLocaleString()} mi`;
};

// Helper function to get truck type label
const getTruckTypeLabel = (code) => {
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
  return truckTypes[code] || code;
};

const BackhaulResults = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const loadPairs = location.state?.loadPairs || [];
  const searchParams = location.state?.searchParams || {};
  const [savingPairId, setSavingPairId] = useState(null);
  const [savedPairIds, setSavedPairIds] = useState(new Set());

  // Fetch saved loads on component mount
  useEffect(() => {
    const fetchSavedLoads = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) return;

        const response = await axios.get(`${API_URL}/loads/saved`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        // Create a Set of saved pair IDs
        const savedIds = new Set();
        response.data.forEach(load => {
          if (load.is_pair && load.child) {
            const pairId = `${load.origin_city}-${load.origin_state}-to-${load.destination_city}-${load.destination_state}-pair-${load.child.origin_city}-${load.child.origin_state}-to-${load.child.destination_city}-${load.child.destination_state}`;
            savedIds.add(pairId);
          }
        });
        setSavedPairIds(savedIds);
      } catch (error) {
        console.error('Error fetching saved loads:', error);
      }
    };

    fetchSavedLoads();
  }, []);

  // Format date function
  const formatDate = (dateStr) => {
    try {
      if (!dateStr) return 'N/A';
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        timeZone: 'UTC'
      });
    } catch (e) {
      console.error('Error formatting date:', e);
      return dateStr || 'N/A';
    }
  };

  const handleSavePair = async (pair) => {
    const pairId = `${pair.outbound.origin_city}-${pair.outbound.origin_state}-to-${pair.outbound.destination_city}-${pair.outbound.destination_state}-pair-${pair.return.origin_city}-${pair.return.origin_state}-to-${pair.return.destination_city}-${pair.return.destination_state}`;
    setSavingPairId(pairId);

    try {
      const accessToken = localStorage.getItem('access_token');
      if (!accessToken) {
        console.error('No authentication token found');
        return;
      }

      const outboundSaveData = {
        origin_city: pair.outbound.origin_city,
        origin_state: pair.outbound.origin_state,
        destination_city: pair.outbound.destination_city,
        destination_state: pair.outbound.destination_state,
        weight: pair.outbound.weight || 0,
        length: pair.outbound.length || 0,
        equipment_type: pair.outbound.equipment_type || pair.outbound.truck_type || 'V',
        rate_per_mile_est: pair.outbound.rate_per_mile_est || 0,
        distance: pair.outbound.distance || 0,
        ship_date: pair.outbound.ship_date,
        data_source: pair.outbound.data_source || 'truckstop',
        phone_number: pair.outbound.contact_phone,
        is_pair: true,
        child: {
          origin_city: pair.return.origin_city,
          origin_state: pair.return.origin_state,
          destination_city: pair.return.destination_city,
          destination_state: pair.return.destination_state,
          weight: pair.return.weight || 0,
          length: pair.return.length || 0,
          equipment_type: pair.return.equipment_type || pair.return.truck_type || 'V',
          rate_per_mile_est: pair.return.rate_per_mile_est || 0,
          distance: pair.return.distance || 0,
          ship_date: pair.return.ship_date,
          data_source: pair.return.data_source || 'truckstop',
          phone_number: pair.return.contact_phone
        }
      };

      const response = await axios.post(`${API_URL}/loads/save`, outboundSaveData, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('Saved load pair:', response.data);
      setSavedPairIds(prev => new Set([...prev, pairId]));
    } catch (error) {
      console.error('Error saving load pair:', error);
      if (error.response) {
        console.error('Error response data:', error.response.data);
        console.error('Error response status:', error.response.status);
        console.error('Error response headers:', error.response.headers);
      }
    } finally {
      setSavingPairId(null);
    }
  };

  const handleDeletePair = async (pair) => {
    const pairId = `${pair.outbound.origin_city}-${pair.outbound.origin_state}-to-${pair.outbound.destination_city}-${pair.outbound.destination_state}-pair-${pair.return.origin_city}-${pair.return.origin_state}-to-${pair.return.destination_city}-${pair.return.destination_state}`;
    setSavingPairId(pairId);

    try {
      const accessToken = localStorage.getItem('access_token');
      if (!accessToken) {
        console.error('No authentication token found');
        return;
      }

      // Get the user's email from the token
      const tokenPayload = JSON.parse(atob(accessToken.split('.')[1]));
      const userEmail = tokenPayload.email;

      // Construct the entry_id in the same format as the backend
      const entryId = `${userEmail}-${pair.outbound.origin_city}-${pair.outbound.origin_state}-to-${pair.outbound.destination_city}-${pair.outbound.destination_state}-${pair.outbound.ship_date}-truckstop-pair-${pair.return.origin_city}-${pair.return.origin_state}-to-${pair.return.destination_city}-${pair.return.destination_state}`;

      await axios.delete(`${API_URL}/loads/${encodeURIComponent(entryId)}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      setSavedPairIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(pairId);
        return newSet;
      });
    } catch (error) {
      console.error('Error deleting load pair:', error);
    } finally {
      setSavingPairId(null);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h2>
          <i className="fas fa-exchange-alt" style={{ marginRight: '10px' }}></i>
          BACKHAUL LOAD PAIRS
        </h2>
        <button
          onClick={() => navigate('/load-search')}
          style={{
            backgroundColor: 'var(--primary)',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 16px',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer'
          }}
        >
          <i className="fas fa-search"></i>
          New Search
        </button>
      </div>

      {/* Search Parameters Summary */}
      <div style={{
        backgroundColor: 'var(--surface)',
        borderRadius: '8px',
        padding: '15px',
        marginBottom: '20px'
      }}>
        <h5 style={{ marginBottom: '15px' }}>Search Parameters</h5>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <p><strong>Origin:</strong> {searchParams.origin_city}, {searchParams.origin_state}</p>
            <p><strong>Truck Type:</strong> {searchParams.equipment_type || 'Any'}</p>
          </div>
          <div>
            <p><strong>Outbound Date:</strong> {formatDate(searchParams.ship_date)}</p>
            <p><strong>Return Date:</strong> {formatDate(new Date(searchParams.ship_date).getTime() + 86400000)}</p>
          </div>
        </div>
      </div>

      {/* Results Count */}
      <p style={{ marginBottom: '20px' }}>
        <i className="fas fa-info-circle" style={{ marginRight: '8px' }}></i>
        Found {loadPairs.length} load pair(s)
      </p>

      {/* Load Pairs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {loadPairs.map((pair, index) => {
          const pairId = `${pair.outbound.origin_city}-${pair.outbound.origin_state}-to-${pair.outbound.destination_city}-${pair.outbound.destination_state}-pair-${pair.return.origin_city}-${pair.return.origin_state}-to-${pair.return.destination_city}-${pair.return.destination_state}`;
          const isSaved = savedPairIds.has(pairId);

          return (
            <div key={index} style={{
              backgroundColor: 'var(--surface)',
              borderRadius: '8px',
              padding: '20px',
              border: '1px solid var(--border)'
            }}>
              {/* Combined Metrics */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '15px',
                padding: '15px',
                backgroundColor: 'var(--background)',
                borderRadius: '8px',
                marginBottom: '20px'
              }}>
                <div>
                  <h6>Total Revenue</h6>
                  <p style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--success)' }}>
                    {formatCurrency(pair.total_revenue)}
                  </p>
                </div>
                <div>
                  <h6>Total Miles</h6>
                  <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                    {formatMiles(pair.total_miles)}
                  </p>
                </div>
                <div>
                  <h6>Deadhead Miles</h6>
                  <p style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--danger)' }}>
                    {formatMiles(pair.deadhead_miles)}
                  </p>
                </div>
                <div>
                  <h6>Average Rate Per Mile</h6>
                  <p style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                    {pair.average_rate.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Loads Side by Side */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* Outbound Load */}
                <div style={{
                  padding: '15px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--background)'
                }}>
                  <h5 style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '15px'
                  }}>
                    <i className="fas fa-arrow-right" style={{ color: 'var(--success)' }}></i>
                    Outbound Load
                  </h5>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>Route: </strong>
                    {pair.outbound.origin_city}, {pair.outbound.origin_state} →{' '}
                    {pair.outbound.destination_city}, {pair.outbound.destination_state}
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>Distance: </strong>
                    {formatMiles(pair.outbound.distance)}
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>Rate: </strong>
                    ${pair.outbound.rate_per_mile_est?.toFixed(2)}/mi
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>Date: </strong>
                    {formatDate(pair.outbound.ship_date)}
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>Phone Number: </strong>
                    {pair.outbound.contact_phone}
                  </div>
                  <div>
                    <strong>ID: </strong>
                    {pair.outbound.id}
                  </div>
                </div>

                {/* Return Load */}
                <div style={{
                  padding: '15px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--background)'
                }}>
                  <h5 style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '15px'
                  }}>
                    <i className="fas fa-arrow-left" style={{ color: 'var(--primary)' }}></i>
                    Return Load
                  </h5>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>Route: </strong>
                    {pair.return.origin_city}, {pair.return.origin_state} →{' '}
                    {pair.return.destination_city}, {pair.return.destination_state}
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>Distance: </strong>
                    {formatMiles(pair.return.distance)}
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>Rate: </strong>
                    ${pair.return.rate_per_mile_est?.toFixed(2)}/mi
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>Date: </strong>
                    {formatDate(pair.return.ship_date)}
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>Phone Number: </strong>
                    {pair.return.contact_phone}
                  </div>
                  <div>
                    <strong>ID: </strong>
                    {pair.return.id}
                  </div>
                </div>
              </div>

              {/* Save Pair Button */}
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: '20px',
                paddingTop: '15px',
                borderTop: '1px solid var(--border)'
              }}>
                <button
                  onClick={() => isSaved ? handleDeletePair(pair) : handleSavePair(pair)}
                  disabled={savingPairId === pairId}
                  style={{
                    backgroundColor: isSaved ? 'var(--danger)' : 'var(--primary)',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '8px 16px',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: savingPairId === pairId ? 'not-allowed' : 'pointer'
                  }}
                >
                  {savingPairId === pairId ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i>
                      {isSaved ? 'Deleting...' : 'Saving...'}
                    </>
                  ) : isSaved ? (
                    <>
                      <i className="fas fa-trash"></i>
                      Delete Load Pair
                    </>
                  ) : (
                    <>
                      <i className="fas fa-save"></i>
                      Save Load Pair
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BackhaulResults; 