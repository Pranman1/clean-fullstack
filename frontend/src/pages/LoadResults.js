import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import truckstopLogo from '../assets/truckstop-logo.png';

const API_URL = 'https://backend-empty-fire-4935.fly.dev';

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
    "VINT": "Van (Interstate)",
    "SD": "Step Deck",
    "MX": "Mixed",
    "HS": "Hot Shot",
    "AC": "Auto Carrier",
    "LB": "Lowboy",
    "F+T": "Flatbed w/ Tarp",
    "F": "Flatbed",
    "FINT": "Flatbed (Interstate)",
    "DD": "Double Drop",
    "V+V": "Van + Van",
    "V+A": "Van + Auto",
    "CRG": "Cargo Van",
    "HB": "Hopper Bottom",
    "LA": "Landoll",
    "PO": "Power Only",
    "R": "Reefer",
    "RINT": "Reefer (Interstate)",
    "RGN": "Removable Gooseneck",
    "CV": "Conestoga Van",
    "DT": "Dump Truck",
    "TNK": "Tanker",
    "F+S": "Flatbed w/ Straps",
    "PNEU": "Pneumatic",
    "CONT": "Container",
    "OTHER": "Other"
  };

  return truckTypes[code] || code;
};

const LoadResults = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchResults, setSearchResults] = useState([]);
  const [searchParams, setSearchParams] = useState({});
  const [savedLoads, setSavedLoads] = useState([]);
  const [savedLoadObjects, setSavedLoadObjects] = useState([]);
  const [savingLoadId, setSavingLoadId] = useState(null);
  const [deletingLoadId, setDeletingLoadId] = useState(null);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveMessageType, setSaveMessageType] = useState('');
  const [showSavedLoads, setShowSavedLoads] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Load data from location state if available
  useEffect(() => {
    const initializeResults = async () => {
      setIsLoading(true);

      if (location.state?.searchResults) {
        console.log('New search results received:', location.state.searchResults);

        // Ensure we have an array of results
        const results = Array.isArray(location.state.searchResults)
          ? location.state.searchResults
          : [];

        // Remove duplicates based on route and date
        const uniqueResults = results.reduce((acc, load) => {
          const key = `${load.origin_city}-${load.origin_state}-to-${load.destination_city}-${load.destination_state}-${load.ship_date}-${load.data_source || 'direct_freight'}`;
          if (!acc.some(existingLoad =>
            `${existingLoad.origin_city}-${existingLoad.origin_state}-to-${existingLoad.destination_city}-${existingLoad.destination_state}-${existingLoad.ship_date}-${existingLoad.data_source || 'direct_freight'}` === key
          )) {
            acc.push(load);
          }
          return acc;
        }, []);

        console.log('Search results after deduplication:', uniqueResults.length);

        // Save to state
        setSearchResults(uniqueResults);
        setSearchParams(location.state.searchParams || {});

        // Save to localStorage as backup
        localStorage.setItem('searchResults', JSON.stringify(uniqueResults));
        localStorage.setItem('searchParams', JSON.stringify(location.state.searchParams || {}));
      } else {
        // Check localStorage as fallback
        const savedResults = localStorage.getItem('searchResults');
        const savedParams = localStorage.getItem('searchParams');

        if (savedResults && savedParams) {
          console.log('Loading saved search results from localStorage');
          setSearchResults(JSON.parse(savedResults));
          setSearchParams(JSON.parse(savedParams));
        } else {
          console.log('No search results found, redirecting to search');
          navigate('/load-search');
          return;
        }
      }

      // Initial load of saved loads
      await fetchSavedLoads();
      setIsLoading(false);
    };

    initializeResults();
  }, [location, navigate]);

  // Re-fetch saved loads when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger > 0) {
      console.log(`Refreshing saved loads (trigger: ${refreshTrigger})`);
      fetchSavedLoads();
    }
  }, [refreshTrigger]);

  // Save updates to localStorage whenever searchResults change
  useEffect(() => {
    localStorage.setItem('searchResults', JSON.stringify(searchResults));
  }, [searchResults]);

  // Save updates to localStorage whenever searchParams change
  useEffect(() => {
    localStorage.setItem('searchParams', JSON.stringify(searchParams));
  }, [searchParams]);

  const fetchSavedLoads = async () => {
    try {
      // Try to fetch saved loads from the API
      console.log('Fetching saved loads...');
      const response = await axios.get(`${API_URL}/loads/saved`);
      console.log('Saved loads response:', response.data);

      // Store the complete saved load objects
      setSavedLoadObjects(response.data);

      // Extract entry_ids to show which loads are saved
      const savedLoadIds = response.data.map(load => load.entry_id);
      console.log('Saved load entry_ids:', savedLoadIds);
      setSavedLoads(savedLoadIds);

      // Mark saved loads in the search results
      if (searchResults.length > 0) {
        const updatedResults = searchResults.map(load => {
          // Generate the same entry_id format as the backend
          const loadEntryId = `${load.origin_city}-${load.origin_state}-to-${load.destination_city}-${load.destination_state}-${load.ship_date}-${load.data_source || 'direct_freight'}`;

          // Check if this load is in the saved loads
          const isSaved = savedLoadIds.includes(loadEntryId);
          if (isSaved) {
            return { ...load, isSaved: true, entry_id: loadEntryId };
          }
          return { ...load, isSaved: false, entry_id: loadEntryId };
        });
        setSearchResults(updatedResults);
      }

      return response.data;
    } catch (error) {
      console.error('Error fetching saved loads:', error);
      setSavedLoads([]);
      setSavedLoadObjects([]);
      return [];
    }
  };

  const handleSaveLoad = async (load) => {
    // Generate the entry_id for this load
    const loadEntryId = `${load.origin_city}-${load.origin_state}-to-${load.destination_city}-${load.destination_state}-${load.ship_date}-${load.data_source || 'direct_freight'}`;

    // Show saving indicator
    setSavingLoadId(loadEntryId);
    setSaveMessage('');

    try {
      console.log('Saving load:', load);

      // Format the load data for saving
      const saveData = {
        origin_city: load.origin_city || '',
        origin_state: load.origin_state || '',
        destination_city: load.destination_city || '',
        destination_state: load.destination_state || '',
        weight: load.weight || 0,
        length: load.length || 0,
        equipment_type: load.equipment_type || load.truck_type || 'V',
        rate_per_mile_est: load.rate_per_mile_est || 0,
        distance: load.distance || 0,
        ship_date: load.ship_date || new Date().toISOString().split('T')[0],
        score: load.score || 0,
        data_source: load.data_source || searchParams.data_source || 'direct_freight',  // Include data source
        phone_number: load.contact_phone || load.phone_number
      };

      console.log('Saving load with data source:', saveData.data_source);

      // Make real API call to save load
      const response = await axios.post(`${API_URL}/loads/save`, saveData);
      console.log('Save load response:', response.data);

      // Get the new entry_id from the response
      const savedEntryId = response.data.entry_id;

      // Update the saved loads state with the new entry_id format
      setSavedLoadObjects(prev => [...prev, response.data]);
      setSavedLoads(prev => [...prev, savedEntryId]);

      // Update the search results to mark this load as saved using the new entry_id
      setSearchResults(prevResults =>
        prevResults.map(result => {
          if (result === load) {
            return { ...result, isSaved: true, entry_id: savedEntryId };
          }
          return result;
        })
      );

      // Show success message
      setSaveMessage('Load saved successfully!');
      setSaveMessageType('success');

      // Increment refresh trigger to update saved loads list
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error saving load:', error);
      setSaveMessage(error.response?.data?.detail || 'Failed to save load');
      setSaveMessageType('error');
    } finally {
      setSavingLoadId(null);
    }
  };

  const handleDeleteLoad = async (load) => {
    // Generate the entry_id for this load
    const loadEntryId = load.entry_id || `${load.origin_city}-${load.origin_state}-to-${load.destination_city}-${load.destination_state}-${load.ship_date}-${load.data_source || 'direct_freight'}`;

    if (!loadEntryId) {
      console.error('Attempted to delete load with undefined entry_id');
      setSaveMessage('Error: Cannot delete load');
      setSaveMessageType('error');
      return;
    }

    setDeletingLoadId(loadEntryId);

    try {
      console.log(`Deleting load with entry_id: ${loadEntryId}`);

      // Call API to delete load
      await axios.delete(`${API_URL}/loads/${loadEntryId}`);
      console.log(`Successfully deleted load with entry_id: ${loadEntryId}`);

      // Update saved loads list
      setSavedLoads(prev => prev.filter(id => id !== loadEntryId));
      setSavedLoadObjects(prev => prev.filter(load => load.entry_id !== loadEntryId));

      // Update search results to remove saved flag
      setSearchResults(prevResults =>
        prevResults.map(result => {
          const resultEntryId = `${result.origin_city}-${result.origin_state}-to-${result.destination_city}-${result.destination_state}-${result.ship_date}-${result.data_source || 'direct_freight'}`;
          if (resultEntryId === loadEntryId) {
            return { ...result, isSaved: false };
          }
          return result;
        })
      );

      // Show success message
      setSaveMessage('Load deleted successfully!');
      setSaveMessageType('success');

      // Increment refresh trigger to update saved loads list
      setRefreshTrigger(prev => prev + 1);

      setTimeout(() => {
        setSaveMessage('');
      }, 3000);
    } catch (error) {
      console.error('Error deleting load:', error);
      setSaveMessage(error.response?.data?.detail || 'Failed to delete load');
      setSaveMessageType('error');
    } finally {
      setDeletingLoadId(null);
    }
  };

  const handleDiscussLoad = (load) => {
    // Store the selected load in session storage
    sessionStorage.setItem('selectedLoad', JSON.stringify(load));
    // Navigate to the AI Assistant page
    navigate('/ai-assistant');
  };

  const toggleSavedLoads = async () => {
    if (showSavedLoads) {
      // If already showing saved loads, switch back to search results
      const previousResults = localStorage.getItem('previousSearchResults');
      if (previousResults) {
        const parsedResults = JSON.parse(previousResults);
        setSearchResults(parsedResults);
      }
    } else {
      // If showing search results, switch to saved loads
      try {
        // Save current search results before switching view
        localStorage.setItem('previousSearchResults', JSON.stringify(searchResults));

        // Force a fresh fetch of saved loads
        const savedLoadsData = await fetchSavedLoads();

        // Update to show saved loads
        setSearchResults(savedLoadsData || []);
      } catch (error) {
        console.error('Error toggling to saved loads:', error);
        setSaveMessage('Failed to load saved loads');
        setSaveMessageType('error');
      }
    }

    // Toggle the view state
    setShowSavedLoads(!showSavedLoads);
  };

  // Format date function
  const formatDate = (dateStr) => {
    try {
      if (!dateStr) return 'N/A';

      console.log('Formatting date:', dateStr);

      // Parse the date string
      const date = new Date(dateStr);

      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date:', dateStr);
        return dateStr || 'N/A';
      }

      // Format using toLocaleDateString with explicit options for better control
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        timeZone: 'UTC' // Add UTC to avoid timezone issues
      });
    } catch (e) {
      console.error('Error formatting date:', e, dateStr);
      return dateStr || 'N/A';
    }
  };

  // Handle missing distance
  const getDistance = (load) => {
    if (!load.distance) return 'Distance unknown';
    return `${Math.round(load.distance)} miles`;
  };

  // Get load score label
  const getScoreLabel = (score) => {
    if (score === undefined || score === null) return 'Not Rated';
    if (score > 0.7) return 'Excellent';
    if (score > 0.4) return 'Good';
    if (score > 0) return 'Average';
    if (score > -0.4) return 'Below Average';
    return 'Poor';
  };

  // Get score color
  const getScoreColor = (score) => {
    if (score === undefined || score === null) return '#6c757d';
    if (score > 0.7) return '#28a745';
    if (score > 0.4) return '#5cb85c';
    if (score > 0) return '#ffc107';
    if (score > -0.4) return '#f0ad4e';
    return '#dc3545';
  };

  // Check if a load is saved
  const isLoadSaved = (load) => {
    if (!load) return false;

    // First check if it's explicitly marked as saved
    if (load.isSaved === true) return true;

    // Then check if it exists in savedLoadObjects by matching properties
    return savedLoadObjects.some(savedLoad =>
      savedLoad.origin_city === load.origin_city &&
      savedLoad.origin_state === load.origin_state &&
      savedLoad.destination_city === load.destination_city &&
      savedLoad.destination_state === load.destination_state &&
      savedLoad.ship_date === load.ship_date &&
      savedLoad.data_source === (load.data_source || 'direct_freight')
    );
  };

  // Add helper function to get data source badge
  const getDataSourceBadge = (dataSource) => {
    const baseStyle = {
      display: 'inline-block',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: 'bold',
      marginLeft: '8px',
      height: '24px',
      display: 'flex',
      alignItems: 'center'
    };

    if (dataSource === 'truckstop') {
      return (
        <div style={{
          ...baseStyle,
          backgroundColor: 'black',
          padding: '4px'
        }}>
          <img
            src={truckstopLogo}
            alt="Truckstop"
            style={{
              height: '100%',
              width: 'auto',
              objectFit: 'contain'
            }}
          />
        </div>
      );
    }

    return (
      <span style={{
        ...baseStyle,
        backgroundColor: '#28a745',
        color: 'white'
      }}>
        Direct Freight
      </span>
    );
  };

  // Debug current view
  console.log(`Current view: ${showSavedLoads ? 'Saved Loads' : 'Search Results'}`);
  console.log(`Displaying ${searchResults.length} loads`);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        color: 'var(--text)'
      }}>
        <h2 style={{ margin: 0 }}>
          <i className="fas fa-truck" style={{ marginRight: '10px' }}></i>
          {showSavedLoads ? 'SAVED LOADS' : 'LOAD RESULTS'}
        </h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={toggleSavedLoads}
            style={{
              backgroundColor: showSavedLoads ? 'var(--secondary)' : '#6c757d',
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
            <i className={`fas ${showSavedLoads ? 'fa-search' : 'fa-bookmark'}`}></i>
            {showSavedLoads ? 'Show Search Results' : 'View Saved Loads'}
          </button>
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
      </div>

      {saveMessage && (
        <div
          style={{
            padding: '10px 15px',
            borderRadius: '5px',
            backgroundColor: saveMessageType === 'success' ? '#d4edda' : '#f8d7da',
            color: saveMessageType === 'success' ? '#155724' : '#721c24',
            marginBottom: '20px'
          }}
        >
          {saveMessageType === 'success' ? (
            <i className="fas fa-check-circle" style={{ marginRight: '10px' }}></i>
          ) : (
            <i className="fas fa-exclamation-circle" style={{ marginRight: '10px' }}></i>
          )}
          {saveMessage}
        </div>
      )}

      {isLoading ? (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          color: 'var(--text)',
          backgroundColor: 'var(--surface)',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <i className="fas fa-spinner fa-spin" style={{ marginRight: '10px' }}></i>
          Loading results...
        </div>
      ) : (
        <>
          {searchResults.length === 0 ? (
            <div style={{
              padding: '15px',
              backgroundColor: 'var(--surface)',
              color: 'var(--text)',
              borderRadius: '8px',
              marginBottom: '20px',
              boxShadow: 'var(--shadow)'
            }}>
              {showSavedLoads ? 'No saved loads found. Save some loads to see them here.' : 'No loads found matching your search criteria. Try adjusting your search parameters.'}
            </div>
          ) : (
            <>
              {!showSavedLoads && (
                <div style={{
                  backgroundColor: 'var(--surface)',
                  borderRadius: '8px',
                  padding: '15px',
                  marginBottom: '20px',
                  boxShadow: 'var(--shadow)'
                }}>
                  <h5 style={{ color: 'var(--text)', marginBottom: '15px' }}>Search Parameters</h5>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', color: 'var(--text)' }}>
                    <div>
                      <p>
                        <strong>Origin:</strong> {searchParams.origin_city}, {searchParams.origin_state}
                      </p>
                      {searchParams.destination_city && searchParams.destination_city !== 'Any' && (
                        <p>
                          <strong>Destination:</strong> {searchParams.destination_city}, {searchParams.destination_state}
                        </p>
                      )}
                    </div>
                    <div>
                      <p>
                        <strong>Truck Type:</strong> {searchParams.equipment_type || 'Any'}
                      </p>
                      <p>
                        <strong>Ship Date:</strong> {formatDate(searchParams.ship_date)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <p style={{ color: 'var(--text)', marginBottom: '20px' }}>
                <i className="fas fa-info-circle" style={{ marginRight: '8px' }}></i>
                {showSavedLoads ? `You have ${searchResults.length} saved load(s)` : `Found ${searchResults.length} loads matching your criteria`}
              </p>

              <div style={{ marginBottom: '20px' }}>
                {searchResults.map((load, index) => (
                  <div
                    key={`${load.id}-${index}`}
                    style={{
                      background: 'var(--surface)',
                      borderRadius: '8px',
                      padding: '20px',
                      marginBottom: '16px',
                      border: '1px solid var(--border)',
                      position: 'relative'
                    }}
                  >
                    {/* Top section with origin/destination */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '16px'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <h3 style={{
                            margin: '0',
                            fontSize: '18px',
                            color: 'var(--text)',
                            display: 'flex',
                            alignItems: 'center'
                          }}>
                            {load.origin_city}, {load.origin_state} → {load.destination_city}, {load.destination_state}
                            {getDataSourceBadge(load.data_source)}
                          </h3>
                        </div>
                        <span style={{
                          backgroundColor: '#ffffff33',
                          padding: '5px 10px',
                          borderRadius: '20px',
                          fontSize: '0.9rem'
                        }}>
                          {getDistance(load)}
                        </span>
                      </div>
                    </div>
                    <div style={{ padding: '15px', color: 'var(--text)' }}>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1fr',
                        gap: '15px',
                        marginBottom: '10px'
                      }}>
                        <div>
                          <h6 style={{
                            color: 'var(--text)',
                            marginBottom: '8px',
                            fontSize: '0.9rem',
                            textTransform: 'uppercase',
                            fontWeight: '600'
                          }}>Route Details</h6>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <p style={{ margin: 0 }}><strong>Origin:</strong> {load.origin_city}, {load.origin_state}</p>
                            <p style={{ margin: 0 }}><strong>Destination:</strong> {load.destination_city}, {load.destination_state}</p>
                            <p style={{ margin: 0 }}><strong>Distance:</strong> {getDistance(load)}</p>
                            {load.id && <p style={{ margin: 0 }}><strong>ID:</strong> {load.id}</p>}
                          </div>
                        </div>
                        <div>
                          <h6 style={{
                            color: 'var(--text)',
                            marginBottom: '8px',
                            fontSize: '0.9rem',
                            textTransform: 'uppercase',
                            fontWeight: '600'
                          }}>Load Details</h6>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <p style={{ margin: 0 }}><strong>Equipment:</strong> {getTruckTypeLabel(load.equipment_type || load.truck_type)}</p>
                            <p style={{ margin: 0 }}><strong>Weight:</strong> {load.weight ? `${Math.round(load.weight).toLocaleString()} lbs` : 'Not specified'}</p>
                            <p style={{ margin: 0 }}><strong>Length:</strong> {load.length ? `${Math.round(load.length)} ft` : 'Not specified'}</p>
                          </div>
                        </div>
                        <div>
                          <h6 style={{
                            color: 'var(--text)',
                            marginBottom: '8px',
                            fontSize: '0.9rem',
                            textTransform: 'uppercase',
                            fontWeight: '600'
                          }}>Rate Information</h6>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <p style={{ margin: 0 }}><strong>Rate/Mile:</strong> ${load.rate_per_mile_est?.toFixed(2) || 'N/A'}</p>
                            <p style={{ margin: 0 }}>
                              <strong>Total:</strong> {load.rate_per_mile_est && load.distance ?
                                formatCurrency(load.rate_per_mile_est * load.distance) : 'N/A'}
                            </p>

                            {load.data_source === 'truckstop' && load.contact_phone && load.contact_phone !== 'N/A' && (
                              <p style={{ margin: 0 }}><strong>Phone:</strong> {load.contact_phone}</p>
                            )}

                            <div style={{ marginTop: '8px' }}>
                              <strong>Score:</strong>
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                marginTop: '4px'
                              }}>
                                <div style={{
                                  flex: 1,
                                  height: '8px',
                                  backgroundColor: '#e9ecef',
                                  borderRadius: '4px',
                                  overflow: 'hidden'
                                }}>
                                  <div style={{
                                    width: `${((load.score || 0) + 1) * 50}%`,
                                    height: '100%',
                                    backgroundColor: getScoreColor(load.score),
                                    transition: 'width 0.3s ease'
                                  }} />
                                </div>
                                <span style={{
                                  color: getScoreColor(load.score),
                                  fontWeight: '500',
                                  fontSize: '0.9rem'
                                }}>
                                  {getScoreLabel(load.score)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Ship date and action buttons in a separate row */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '15px',
                        paddingTop: '15px',
                        borderTop: '1px solid var(--border)',
                        paddingLeft: '15px',
                        paddingRight: '15px'
                      }}>
                        <div>
                          <strong>Ship Date:</strong> {formatDate(load.ship_date)}
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleDiscussLoad(load)}
                            style={{
                              backgroundColor: '#6c757d',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '6px 12px',
                              color: 'white',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              cursor: 'pointer',
                              fontSize: '0.9rem'
                            }}
                          >
                            <i className="fas fa-comments"></i>
                            Discuss With AI
                          </button>

                          {isLoadSaved(load) ? (
                            <button
                              onClick={() => handleDeleteLoad(load)}
                              disabled={deletingLoadId === load.entry_id}
                              style={{
                                backgroundColor: 'var(--danger)',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '6px 12px',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                cursor: deletingLoadId === load.entry_id ? 'not-allowed' : 'pointer',
                                fontSize: '0.9rem'
                              }}
                            >
                              {deletingLoadId === load.entry_id ? (
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
                          ) : (
                            <button
                              onClick={() => handleSaveLoad(load)}
                              disabled={savingLoadId === load.entry_id}
                              style={{
                                backgroundColor: 'var(--primary)',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '6px 12px',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                cursor: savingLoadId === load.entry_id ? 'not-allowed' : 'pointer',
                                fontSize: '0.9rem'
                              }}
                            >
                              {savingLoadId === load.entry_id ? (
                                <>
                                  <i className="fas fa-spinner fa-spin"></i>
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <i className="fas fa-bookmark"></i>
                                  Save Load
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default LoadResults; 