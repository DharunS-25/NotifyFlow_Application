import React, { useState, useEffect } from 'react';
import { ROUTINE_CATEGORIES, PRIORITY_LEVELS } from '../config';

const RoutineManager = ({ 
  routines = [], 
  onAddRoutine, 
  onEditRoutine, 
  onDeleteRoutine, 
  onToggleRoutine 
}) => {
  // Local state for routines with updating status
  const [localRoutines, setLocalRoutines] = useState(routines || []);

  // Update local routines when prop changes
  useEffect(() => {
    setLocalRoutines(routines || []);
  }, [routines]);

  const getCategoryIcon = (category) => {
    const cat = ROUTINE_CATEGORIES.find(c => c.value === category);
    return cat ? cat.icon : '🎯';
  };

  const getPriorityColor = (priority) => {
    const pri = PRIORITY_LEVELS.find(p => p.value === priority);
    return pri ? pri.color : '#607D8B';
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const handleDelete = (routineId, routineTitle) => {
    if (window.confirm(`Are you sure you want to delete "${routineTitle}"?`)) {
      onDeleteRoutine(routineId);
    }
  };

  const handleToggle = async (routineId) => {
    try {
      console.log(`🔄 Toggling routine ${routineId} from RoutineManager`);
      
      // Show loading state
      setLocalRoutines(prev =>
        prev.map(routine =>
          routine._id === routineId 
            ? { ...routine, _isUpdating: true }
            : routine
        )
      );
      
      if (onToggleRoutine) {
        const result = await onToggleRoutine(routineId);
        console.log(`✅ Routine ${routineId} toggled to ${result ? 'active' : 'inactive'}`);
      }
      
    } catch (error) {
      console.error('❌ Error toggling routine in RoutineManager:', error);
      alert(`Failed to toggle routine: ${error.message}`);
      
      // Reset loading state
      setLocalRoutines(prev =>
        prev.map(routine =>
          routine._id === routineId 
            ? { ...routine, _isUpdating: false }
            : routine
        )
      );
    }
  };

  // Calculate statistics
  const activeRoutines = localRoutines.filter(r => r.isActive).length;
  const inactiveRoutines = localRoutines.filter(r => !r.isActive).length;

  return (
    <div className="routine-manager">
      {/* Header */}
      <div className="page-header">
        <h1>Routine Management</h1>
        <button className="btn-primary" onClick={onAddRoutine}>
          ➕ Add New Routine
        </button>
      </div>

      {/* Routines List */}
      <div className="routines-list">
        {localRoutines.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">⏰</div>
            <h3>No Routines Yet</h3>
            <p>Create your first routine to start receiving smart notifications!</p>
            <button className="btn-primary" onClick={onAddRoutine}>
              Create Your First Routine
            </button>
          </div>
        ) : (
          <div className="routines-grid">
            {localRoutines.map(routine => (
              <div key={routine._id} className={`routine-card ${!routine.isActive ? 'inactive' : ''}`}>
                <div className="routine-header">
                  <div className="routine-info">
                    <div className="routine-title">
                      <span className="category-icon">
                        {getCategoryIcon(routine.category)}
                      </span>
                      <h3>{routine.title}</h3>
                      {!routine.isActive && (
                        <span className="inactive-badge">Inactive</span>
                      )}
                      {routine._isUpdating && (
                        <span className="updating-badge">Updating...</span>
                      )}
                    </div>
                    <p className="routine-description">{routine.description}</p>
                  </div>
                  
                  <div className="routine-actions">
                    <button 
                      className={`toggle-btn ${routine.isActive ? 'active' : ''} ${routine._isUpdating ? 'updating' : ''}`}
                      onClick={() => handleToggle(routine._id)}
                      title={routine.isActive ? 'Disable routine' : 'Enable routine'}
                      disabled={routine._isUpdating}
                    >
                      {routine._isUpdating ? '⏳' : (routine.isActive ? '🔔' : '🔕')}
                    </button>
                    <button 
                      className="edit-btn"
                      onClick={() => onEditRoutine && onEditRoutine(routine)}
                      title="Edit routine"
                      disabled={routine._isUpdating}
                    >
                      ✏️
                    </button>
                    <button 
                      className="delete-btn"
                      onClick={() => handleDelete(routine._id, routine.title)}
                      title="Delete routine"
                      disabled={routine._isUpdating}
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <div className="routine-schedule">
                  {routine.schedule && routine.schedule.map((schedule, index) => (
                    <div key={index} className="schedule-display">
                      <span className="schedule-time">{formatTime(schedule.time)}</span>
                      <span className="schedule-days">
                        {schedule.days && schedule.days.map(day => 
                          ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]
                        ).join(', ')}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="routine-footer">
                  <div className="routine-meta">
                    <span 
                      className="priority-badge"
                      style={{ backgroundColor: getPriorityColor(routine.priority) }}
                    >
                      Priority {routine.priority}
                    </span>
                    <span className="sound-badge">
                      🔊 {routine.sound}
                    </span>
                    <span className="volume-badge">
                      Vol: {Math.round((routine.volume || 0.7) * 100)}%
                    </span>
                  </div>
                  
                  {routine.adaptiveTiming?.enabled && (
                    <span className="adaptive-badge" title="Smart timing enabled">
                      🧠 Adaptive
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Stats */}
      {localRoutines.length > 0 && (
        <div className="routine-stats">
          <div className="stat-item">
            <span className="stat-number">{localRoutines.length}</span>
            <span className="stat-label">Total Routines</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{activeRoutines}</span>
            <span className="stat-label">Active</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{inactiveRoutines}</span>
            <span className="stat-label">Inactive</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoutineManager;