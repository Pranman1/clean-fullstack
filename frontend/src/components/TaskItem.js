import React from 'react';
import { Link } from 'react-router-dom';

const TaskItem = ({ task, onDelete, onToggleComplete }) => {
  // Determine appropriate icon based on task title (simulating load types)
  const getTaskIcon = (title) => {
    const titleLower = title.toLowerCase();
    if (titleLower.includes('delivery')) return 'fas fa-box-open';
    if (titleLower.includes('pickup')) return 'fas fa-dolly';
    if (titleLower.includes('maintenance')) return 'fas fa-wrench';
    if (titleLower.includes('fuel')) return 'fas fa-gas-pump';
    if (titleLower.includes('rest') || titleLower.includes('break')) return 'fas fa-bed';
    return 'fas fa-clipboard-check';
  };

  return (
    <div 
      style={{ 
        padding: '20px', 
        border: '1px solid var(--chrome)', 
        marginBottom: '20px', 
        borderRadius: '8px',
        backgroundColor: task.completed ? 'var(--success)' : 'white',
        color: task.completed ? 'white' : 'var(--dark)',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        transition: 'all 0.3s ease',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Route indicator */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '8px',
        height: '100%',
        backgroundColor: task.completed ? '#1b6b5f' : 'var(--secondary)'
      }}></div>
      
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        paddingLeft: '15px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <i className={getTaskIcon(task.title)} style={{ 
              fontSize: '1.5rem', 
              color: task.completed ? 'white' : 'var(--primary)'
            }}></i>
            <h3 style={{ 
              fontFamily: 'Oswald, sans-serif',
              color: task.completed ? 'white' : 'var(--primary)',
              margin: 0
            }}>{task.title}</h3>
          </div>
          
          {task.description && (
            <p style={{ 
              marginBottom: '10px',
              lineHeight: '1.4',
              color: task.completed ? 'rgba(255,255,255,0.9)' : 'var(--dark)'
            }}>{task.description}</p>
          )}
          
          <div style={{ 
            display: 'flex', 
            gap: '15px', 
            marginTop: '10px',
            fontSize: '0.85rem',
            color: task.completed ? 'rgba(255,255,255,0.8)' : 'var(--gray)'
          }}>
            <span>
              <i className="far fa-calendar-alt" style={{ marginRight: '5px' }}></i>
              {new Date(task.created_at).toLocaleDateString()}
            </span>
            <span>
              <i className="far fa-clock" style={{ marginRight: '5px' }}></i>
              {new Date(task.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </span>
          </div>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button 
            onClick={() => onToggleComplete(task.id, !task.completed)}
            style={{ 
              backgroundColor: task.completed ? 'white' : 'var(--accent)',
              color: task.completed ? 'var(--success)' : 'var(--dark)',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '8px 12px'
            }}
          >
            <i className={task.completed ? 'fas fa-check-circle' : 'far fa-circle'}></i>
            {task.completed ? 'Completed' : 'Mark Complete'}
          </button>
          
          <Link to={`/edit/${task.id}`} style={{ width: '100%' }}>
            <button style={{ 
              width: '100%', 
              backgroundColor: task.completed ? 'rgba(255,255,255,0.3)' : 'var(--primary)',
              color: task.completed ? 'white' : 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}>
              <i className="fas fa-edit"></i> Edit
            </button>
          </Link>
          
          <button 
            onClick={() => onDelete(task.id)}
            style={{ 
              backgroundColor: task.completed ? 'rgba(255,255,255,0.3)' : 'var(--danger)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <i className="fas fa-trash-alt"></i> Delete
          </button>
        </div>
      </div>
      
      {/* Status badge */}
      {task.completed && (
        <div style={{
          position: 'absolute',
          bottom: '15px',
          right: '15px',
          backgroundColor: 'white',
          color: 'var(--success)',
          padding: '5px 10px',
          borderRadius: '20px',
          fontSize: '0.8rem',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: '5px'
        }}>
          <i className="fas fa-truck-loading"></i> DELIVERED
        </div>
      )}
    </div>
  );
};

export default TaskItem; 