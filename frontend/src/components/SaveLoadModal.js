import React, { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

const SaveLoadModal = ({ load, onClose }) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const saveData = {
        origin_city: load.origin_city,
        origin_state: load.origin_state,
        destination_city: load.destination_city,
        destination_state: load.destination_state,
        weight: load.weight || 0,
        length: load.length || 0,
        equipment_type: load.equipment_type,
        rate_per_mile_est: load.rate_per_mile_est || 0,
        distance: load.distance || 0,
        ship_date: load.ship_date,
        delivery_date: load.delivery_date,
        data_source: load.data_source || 'truckstop',
        phone_number: load.contact_phone
      };

      await axios.post(`${API_URL}/loads/save`, saveData);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save load');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'var(--surface)',
        borderRadius: '8px',
        padding: '20px',
        width: '90%',
        maxWidth: '500px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <h3 style={{ marginTop: 0 }}>Save Load</h3>

        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ marginBottom: '10px' }}>Load Details</h4>
          <div style={{
            backgroundColor: 'var(--background)',
            padding: '15px',
            borderRadius: '6px'
          }}>
            <p style={{ margin: '0 0 8px 0' }}>
              <strong>Route:</strong> {load.origin_city}, {load.origin_state} → {load.destination_city}, {load.destination_state}
            </p>
            <p style={{ margin: '0 0 8px 0' }}>
              <strong>Distance:</strong> {load.distance} miles
            </p>
            <p style={{ margin: '0 0 8px 0' }}>
              <strong>Rate:</strong> ${load.rate_per_mile_est}/mile
            </p>
            <p style={{ margin: '0 0 8px 0' }}>
              <strong>Ship Date:</strong> {new Date(load.ship_date).toLocaleDateString()}
            </p>
            {load.delivery_date && (
              <p style={{ margin: '0 0 8px 0' }}>
                <strong>Delivery Date:</strong> {new Date(load.delivery_date).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>

        {error && (
          <div style={{
            backgroundColor: 'var(--danger-light)',
            color: 'var(--danger)',
            padding: '10px',
            borderRadius: '4px',
            marginBottom: '15px'
          }}>
            <i className="fas fa-exclamation-circle" style={{ marginRight: '8px' }}></i>
            {error}
          </div>
        )}

        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px',
          marginTop: '20px'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--primary)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {saving ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                Saving...
              </>
            ) : (
              <>
                <i className="fas fa-save"></i>
                Save Load
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaveLoadModal; 