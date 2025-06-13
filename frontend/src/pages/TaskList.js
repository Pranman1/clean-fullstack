import React, { useState, useEffect } from 'react';
import axios from 'axios';
import TaskItem from '../components/TaskItem';
import { Link } from 'react-router-dom';

const API_URL = 'http://localhost:8000';

const TaskList = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'active', 'completed'

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/tasks/`);
      setTasks(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError('Failed to load tasks. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTask = async (id) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    
    try {
      await axios.delete(`${API_URL}/tasks/${id}`);
      setTasks(tasks.filter(task => task.id !== id));
    } catch (err) {
      console.error('Error deleting task:', err);
      alert('Failed to delete task. Please try again.');
    }
  };

  const handleToggleComplete = async (id, completed) => {
    try {
      const task = tasks.find(t => t.id === id);
      const updatedData = { ...task, completed };
      
      const response = await axios.put(`${API_URL}/tasks/${id}`, updatedData);
      
      setTasks(tasks.map(t => t.id === id ? response.data : t));
    } catch (err) {
      console.error('Error updating task:', err);
      alert('Failed to update task. Please try again.');
    }
  };

  // Filter tasks based on current filter state
  const filteredTasks = tasks.filter(task => {
    if (filter === 'active') return !task.completed;
    if (filter === 'completed') return task.completed;
    return true; // 'all' filter
  });

  // Task stats
  const completedCount = tasks.filter(t => t.completed).length;
  const activeCount = tasks.length - completedCount;

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '50px 0' }}>
      <i className="fas fa-truck fa-spin" style={{ fontSize: '3rem', color: 'var(--primary)', marginBottom: '20px' }}></i>
      <p>Loading your tasks...</p>
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
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '30px' 
      }}>
        <h2 style={{ 
          color: 'var(--primary)', 
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <i className="fas fa-clipboard-list"></i> LOAD MANIFEST
        </h2>
        
        <Link to="/create">
          <button style={{ 
            backgroundColor: 'var(--secondary)', 
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <i className="fas fa-plus"></i> NEW LOAD
          </button>
        </Link>
      </div>
      
      {/* Dashboard stats */}
      <div style={{ 
        display: 'flex', 
        gap: '20px',
        marginBottom: '30px'
      }}>
        <div style={{ 
          flex: 1, 
          padding: '15px', 
          backgroundColor: 'var(--primary)', 
          color: 'white',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{tasks.length}</div>
          <div style={{ textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '1px' }}>
            Total Loads
          </div>
        </div>
        
        <div style={{ 
          flex: 1, 
          padding: '15px', 
          backgroundColor: 'var(--accent)', 
          color: 'var(--dark)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{activeCount}</div>
          <div style={{ textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '1px' }}>
            In Transit
          </div>
        </div>
        
        <div style={{ 
          flex: 1, 
          padding: '15px', 
          backgroundColor: 'var(--success)', 
          color: 'white',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{completedCount}</div>
          <div style={{ textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '1px' }}>
            Delivered
          </div>
        </div>
      </div>
      
      {/* Filter tabs */}
      <div style={{ 
        display: 'flex', 
        marginBottom: '20px',
        borderBottom: '2px solid var(--chrome)',
        paddingBottom: '10px'
      }}>
        <button 
          onClick={() => setFilter('all')}
          style={{ 
            backgroundColor: filter === 'all' ? 'var(--primary)' : 'transparent',
            color: filter === 'all' ? 'white' : 'var(--dark)',
            border: filter === 'all' ? 'none' : '1px solid var(--chrome)',
            marginRight: '10px'
          }}
        >
          <i className="fas fa-list"></i> All Loads
        </button>
        <button 
          onClick={() => setFilter('active')}
          style={{ 
            backgroundColor: filter === 'active' ? 'var(--accent)' : 'transparent',
            color: filter === 'active' ? 'var(--dark)' : 'var(--dark)',
            border: filter === 'active' ? 'none' : '1px solid var(--chrome)',
            marginRight: '10px'
          }}
        >
          <i className="fas fa-truck-moving"></i> In Transit
        </button>
        <button 
          onClick={() => setFilter('completed')}
          style={{ 
            backgroundColor: filter === 'completed' ? 'var(--success)' : 'transparent',
            color: filter === 'completed' ? 'white' : 'var(--dark)',
            border: filter === 'completed' ? 'none' : '1px solid var(--chrome)'
          }}
        >
          <i className="fas fa-check-circle"></i> Delivered
        </button>
      </div>
      
      {filteredTasks.length === 0 ? (
        <div style={{ 
          padding: '30px', 
          textAlign: 'center',
          backgroundColor: 'var(--light)',
          borderRadius: '8px',
          border: '1px dashed var(--chrome)'
        }}>
          <i className="fas fa-truck" style={{ 
            fontSize: '3rem', 
            color: 'var(--gray)',
            marginBottom: '20px',
            opacity: 0.5
          }}></i>
          <p style={{ color: 'var(--gray)', marginBottom: '20px' }}>
            {filter === 'all' 
              ? "No loads yet. Start by creating your first one!" 
              : filter === 'active' 
                ? "No loads in transit. All caught up!" 
                : "No delivered loads yet."}
          </p>
          {filter !== 'all' && (
            <button onClick={() => setFilter('all')} style={{ backgroundColor: 'var(--gray)' }}>
              View All Loads
            </button>
          )}
        </div>
      ) : (
        filteredTasks.map(task => (
          <TaskItem 
            key={task.id}
            task={task}
            onDelete={handleDeleteTask}
            onToggleComplete={handleToggleComplete}
          />
        ))
      )}
    </div>
  );
};

export default TaskList; 