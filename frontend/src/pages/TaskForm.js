import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = 'https://backend-empty-fire-4935.fly.dev';

const TaskForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!id;

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    completed: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isEditMode) {
      fetchTask();
    }
  }, [id]);

  const fetchTask = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/tasks/${id}`);
      setFormData(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching task:', err);
      setError('Failed to load task. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      alert('Title is required');
      return;
    }
    
    try {
      setLoading(true);
      
      if (isEditMode) {
        await axios.put(`${API_URL}/tasks/${id}`, formData);
      } else {
        await axios.post(`${API_URL}/tasks/`, formData);
      }
      
      navigate('/');
    } catch (err) {
      console.error('Error saving task:', err);
      setError('Failed to save task. Please try again later.');
      setLoading(false);
    }
  };

  if (loading && isEditMode) return (
    <div style={{ textAlign: 'center', padding: '50px 0' }}>
      <i className="fas fa-truck fa-spin" style={{ fontSize: '3rem', color: 'var(--primary)', marginBottom: '20px' }}></i>
      <p>Loading your load details...</p>
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
    <div>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        marginBottom: '30px',
        gap: '15px'
      }}>
        <i className={isEditMode ? "fas fa-edit" : "fas fa-plus-circle"} 
           style={{ fontSize: '2rem', color: 'var(--secondary)' }}></i>
        <h2>{isEditMode ? 'UPDATE LOAD DETAILS' : 'CREATE NEW LOAD'}</h2>
      </div>
      
      <div style={{ 
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '30px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Side accent */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '8px',
          height: '100%',
          backgroundColor: isEditMode ? 'var(--primary)' : 'var(--secondary)'
        }}></div>
        
        <form onSubmit={handleSubmit} style={{ maxWidth: '600px', marginLeft: '10px' }}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px',
              color: 'var(--dark)', 
              fontWeight: 'bold',
              textTransform: 'uppercase',
              fontSize: '0.9rem',
              letterSpacing: '0.5px'
            }}>
              <i className="fas fa-tag" style={{ marginRight: '8px' }}></i>
              Load Title:
            </label>
            <input
              type="text"
              name="title"
              placeholder="e.g. Delivery to Chicago, IL"
              value={formData.title}
              onChange={handleChange}
              style={{ width: '100%' }}
              required
            />
          </div>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px',
              color: 'var(--dark)', 
              fontWeight: 'bold',
              textTransform: 'uppercase',
              fontSize: '0.9rem',
              letterSpacing: '0.5px'
            }}>
              <i className="fas fa-align-left" style={{ marginRight: '8px' }}></i>
              Load Details:
            </label>
            <textarea
              name="description"
              placeholder="Enter load details, pickup instructions, delivery notes, etc."
              value={formData.description || ''}
              onChange={handleChange}
              style={{ width: '100%', minHeight: '150px' }}
            />
          </div>
          
          {isEditMode && (
            <div style={{ 
              marginBottom: '20px',
              backgroundColor: formData.completed ? 'var(--success)' : 'var(--light)',
              padding: '15px',
              borderRadius: '8px',
              borderLeft: `5px solid ${formData.completed ? 'var(--success)' : 'var(--accent)'}`
            }}>
              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px',
                fontSize: '1rem',
                color: formData.completed ? 'white' : 'var(--dark)',
                fontWeight: 'bold'
              }}>
                <input
                  type="checkbox"
                  name="completed"
                  checked={formData.completed}
                  onChange={handleChange}
                  style={{ width: '20px', height: '20px' }}
                />
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className={formData.completed ? "fas fa-check-circle" : "fas fa-truck-moving"}></i>
                  {formData.completed ? 'LOAD DELIVERED' : 'MARK AS DELIVERED'}
                </span>
              </label>
            </div>
          )}
          
          <div className="truck-divider" style={{ margin: '30px 0' }}></div>
          
          <div style={{ display: 'flex', gap: '15px' }}>
            <button 
              type="submit" 
              disabled={loading}
              style={{ 
                padding: '12px 24px',
                backgroundColor: isEditMode ? 'var(--primary)' : 'var(--secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <i className={isEditMode ? "fas fa-save" : "fas fa-plus"}></i>
              {loading ? 'Saving...' : isEditMode ? 'Update Load' : 'Create Load'}
            </button>
            
            <button 
              type="button" 
              onClick={() => navigate('/')}
              style={{ 
                backgroundColor: 'var(--gray)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <i className="fas fa-times"></i> Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskForm; 